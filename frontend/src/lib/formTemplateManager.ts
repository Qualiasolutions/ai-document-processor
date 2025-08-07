/**
 * Dynamic Form Template Manager
 * Database-driven form template system with AI-powered field mapping
 */
import { supabase } from './supabase'

export interface FormField {
  id: string
  name: string
  label: string
  type: 'text' | 'email' | 'tel' | 'date' | 'number' | 'select' | 'textarea' | 'checkbox' | 'radio'
  required: boolean
  placeholder?: string
  options?: string[] // For select, radio
  validation?: {
    pattern?: string
    min?: number
    max?: number
    minLength?: number
    maxLength?: number
  }
  aiMapping?: {
    keywords: string[] // Keywords to match in AI analysis
    priority: number // Higher priority fields get matched first
    confidence: number // Minimum confidence for auto-population
  }
  groupId?: string // For grouping related fields
}

export interface FormTemplate {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  fields: FormField[]
  isPublic: boolean
  isSystem: boolean
  createdBy?: string
  createdAt: string
  updatedAt: string
  metadata?: {
    version: string
    aiOptimized: boolean
    usage_count: number
    success_rate: number
  }
}

export interface FormInstance {
  id: string
  templateId: string
  documentIds: string[]
  title: string
  formData: Record<string, any>
  status: 'draft' | 'completed' | 'submitted' | 'archived'
  confidence: number
  aiMappings: Record<string, {
    source: string
    confidence: number
    value: any
  }>
  createdAt: string
  updatedAt: string
}

export class FormTemplateManager {
  private templates: Map<string, FormTemplate> = new Map()
  private lastSync: number = 0
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  /**
   * Get all available form templates
   */
  async getTemplates(forceRefresh: boolean = false): Promise<FormTemplate[]> {
    const now = Date.now()
    
    if (!forceRefresh && (now - this.lastSync) < this.CACHE_DURATION && this.templates.size > 0) {
      return Array.from(this.templates.values())
    }

    try {
      const { data, error } = await supabase
        .from('form_templates')
        .select('*')
        .eq('is_public', true)
        .order('name')

      if (error) {
        throw new Error(`Failed to load templates: ${error.message}`)
      }

      // Update cache
      this.templates.clear()
      data.forEach(template => {
        this.templates.set(template.id, {
          id: template.id,
          name: template.name,
          description: template.description || '',
          category: template.category || 'general',
          tags: template.tags || [],
          fields: this.parseFields(template.fields),
          isPublic: template.is_public,
          isSystem: template.is_system,
          createdBy: template.created_by,
          createdAt: template.created_at,
          updatedAt: template.updated_at,
          metadata: {
            version: '1.0',
            aiOptimized: true,
            usage_count: 0,
            success_rate: 0.95
          }
        })
      })

      this.lastSync = now
      return Array.from(this.templates.values())

    } catch (error) {
      console.error('Failed to load form templates:', error)
      return this.getBuiltInTemplates()
    }
  }

  /**
   * Get template by ID
   */
  async getTemplate(id: string): Promise<FormTemplate | null> {
    const templates = await this.getTemplates()
    return templates.find(t => t.id === id) || null
  }

  /**
   * Create a new form instance from template and AI analysis
   */
  async createFormInstance(
    templateId: string,
    documentIds: string[],
    aiAnalysis: any,
    title?: string
  ): Promise<FormInstance> {
    const template = await this.getTemplate(templateId)
    if (!template) {
      throw new Error(`Template ${templateId} not found`)
    }

    // Map AI analysis to form fields
    const { formData, aiMappings, confidence } = this.mapAIAnalysisToForm(template, aiAnalysis)

    const formInstance: FormInstance = {
      id: this.generateId(),
      templateId,
      documentIds,
      title: title || `${template.name} - ${new Date().toLocaleDateString()}`,
      formData,
      status: 'draft',
      confidence,
      aiMappings,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Save to database  
    const { data, error } = await supabase
      .from('generated_forms')
      .insert({
        user_id: null, // Anonymous
        document_id: documentIds[0], // Use first document ID (table expects singular)
        template_id: templateId,
        form_data: {
          ...formData,
          aiMappings,
          confidence,
          template: template.name,
          document_ids: documentIds // Store all IDs in form_data
        },
        form_type: template.category,
        status: 'draft',
        title: formInstance.title
      })
      .select()
      .single()

    if (error) {
      console.warn('Failed to save form instance (working offline):', error)
      // Return the instance anyway for client-side use with temp ID
      formInstance.id = `temp_${Date.now()}`
    } else {
      formInstance.id = data.id
    }

    return formInstance
  }

  /**
   * Update form instance
   */
  async updateFormInstance(id: string, updates: Partial<FormInstance>): Promise<void> {
    const { error } = await supabase
      .from('generated_forms')
      .update({
        form_data: updates.formData || {},
        status: updates.status || 'draft',
        title: updates.title,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to update form: ${error.message}`)
    }
  }

  /**
   * Get form instances for documents
   */
  async getFormInstances(documentIds?: string[]): Promise<FormInstance[]> {
    let query = supabase
      .from('generated_forms')
      .select('*')
      .order('created_at', { ascending: false })

    if (documentIds && documentIds.length > 0) {
      query = query.overlaps('document_ids', documentIds)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to load form instances: ${error.message}`)
    }

    return data.map(item => ({
      id: item.id,
      templateId: item.template_id || 'unknown',
      documentIds: item.document_ids || [],
      title: item.title || 'Untitled Form',
      formData: item.form_data || {},
      status: item.status || 'draft',
      confidence: item.form_data?.confidence || 0,
      aiMappings: item.form_data?.aiMappings || {},
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }))
  }

  /**
   * Find best template for document type
   */
  async findBestTemplate(documentType: string, extractedFields: Record<string, any>): Promise<FormTemplate | null> {
    // Ensure templates are loaded
    const templates = await this.getTemplates()
    
    let bestMatch: FormTemplate | null = null
    let bestScore = 0

    for (const template of templates) {
      const score = this.calculateTemplateScore(template, documentType, extractedFields)
      if (score > bestScore) {
        bestScore = score
        bestMatch = template
      }
    }

    // If no good match found, try fallback for generic/unknown document types
    if (bestScore < 0.3) {
      const genericTypes = ['text', 'plain_text', 'unknown', 'other', 'document']
      if (genericTypes.includes(documentType.toLowerCase())) {
        // Find generic document template
        const genericTemplate = templates.find(t => 
          t.category === 'general' || 
          t.tags.includes('generic') || 
          t.tags.includes('general') ||
          t.tags.includes('text')
        )
        if (genericTemplate) {
          return genericTemplate
        }
      }
    }

    return bestScore > 0.3 ? bestMatch : null // Minimum 30% match
  }

  /**
   * Map AI analysis to form fields
   */
  private mapAIAnalysisToForm(
    template: FormTemplate,
    aiAnalysis: any
  ): { formData: Record<string, any>, aiMappings: Record<string, any>, confidence: number } {
    const formData: Record<string, any> = {}
    const aiMappings: Record<string, any> = {}
    const confidenceScores: number[] = []

    const extractedFields = aiAnalysis.extractedFields || {}
    const ocrText = aiAnalysis.ocrText || ''

    for (const field of template.fields) {
      const mapping = this.mapFieldValue(field, extractedFields, ocrText)
      
      if (mapping.value !== null && mapping.value !== undefined) {
        formData[field.name] = mapping.value
        aiMappings[field.name] = {
          source: mapping.source,
          confidence: mapping.confidence,
          value: mapping.value
        }
        confidenceScores.push(mapping.confidence)
      }
    }

    const overallConfidence = confidenceScores.length > 0
      ? confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length
      : 0

    return { formData, aiMappings, confidence: overallConfidence }
  }

  /**
   * Map individual field value from AI analysis
   */
  private mapFieldValue(
    field: FormField,
    extractedFields: Record<string, any>,
    ocrText: string
  ): { value: any, source: string, confidence: number } {
    // Direct field mapping
    if (extractedFields[field.name]) {
      return {
        value: extractedFields[field.name],
        source: 'direct_extraction',
        confidence: 0.95
      }
    }

    // AI mapping based on keywords
    if (field.aiMapping?.keywords) {
      for (const keyword of field.aiMapping.keywords) {
        const lowerKeyword = keyword.toLowerCase()
        
        // Check extracted fields for keyword matches
        for (const [key, value] of Object.entries(extractedFields)) {
          if (key.toLowerCase().includes(lowerKeyword) || 
              (typeof value === 'string' && value.toLowerCase().includes(lowerKeyword))) {
            return {
              value: this.formatFieldValue(value, field.type),
              source: `keyword_match:${keyword}`,
              confidence: field.aiMapping.confidence || 0.8
            }
          }
        }

        // Check OCR text for patterns
        const pattern = this.createFieldPattern(field, keyword)
        const match = ocrText.match(pattern)
        if (match && match[1]) {
          return {
            value: this.formatFieldValue(match[1].trim(), field.type),
            source: `pattern_match:${keyword}`,
            confidence: (field.aiMapping.confidence || 0.7) - 0.1 // Slightly lower confidence for pattern matching
          }
        }
      }
    }

    return { value: null, source: 'not_found', confidence: 0 }
  }

  /**
   * Create regex pattern for field extraction
   */
  private createFieldPattern(field: FormField, keyword: string): RegExp {
    const cleanKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    
    switch (field.type) {
      case 'email':
        return new RegExp(`${cleanKeyword}[:\\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})`, 'i')
      case 'tel':
        return new RegExp(`${cleanKeyword}[:\\s]*([+]?[0-9\\s\\-\\(\\)]{10,})`, 'i')
      case 'date':
        return new RegExp(`${cleanKeyword}[:\\s]*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4}|[0-9]{4}[/-][0-9]{1,2}[/-][0-9]{1,2})`, 'i')
      case 'number':
        return new RegExp(`${cleanKeyword}[:\\s]*([0-9,]+(?:\\.[0-9]+)?)`, 'i')
      default:
        return new RegExp(`${cleanKeyword}[:\\s]*([^\\n\\r]{1,100})`, 'i')
    }
  }

  /**
   * Format value according to field type
   */
  private formatFieldValue(value: any, fieldType: string): any {
    if (value === null || value === undefined) return null

    const strValue = String(value).trim()

    switch (fieldType) {
      case 'number':
        const num = parseFloat(strValue.replace(/[^0-9.-]/g, ''))
        return isNaN(num) ? null : num
      case 'email':
        const emailMatch = strValue.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/)
        return emailMatch ? emailMatch[1] : null
      case 'tel':
        return strValue.replace(/[^0-9+\-\(\)\s]/g, '')
      case 'date':
        try {
          const date = new Date(strValue)
          return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0]
        } catch {
          return null
        }
      case 'checkbox':
        return ['yes', 'true', '1', 'checked', 'x'].includes(strValue.toLowerCase())
      default:
        return strValue
    }
  }

  /**
   * Calculate template match score
   */
  private calculateTemplateScore(
    template: FormTemplate,
    documentType: string,
    extractedFields: Record<string, any>
  ): number {
    let score = 0

    // Document type matching
    if (template.category === documentType) {
      score += 0.4
    } else if (template.tags.includes(documentType)) {
      score += 0.3
    }

    // Field matching
    const fieldNames = Object.keys(extractedFields).map(name => name.toLowerCase())
    const templateFieldNames = template.fields.map(f => f.name.toLowerCase())
    
    const matchingFields = templateFieldNames.filter(name => 
      fieldNames.some(extractedName => 
        extractedName.includes(name) || name.includes(extractedName)
      )
    )

    if (template.fields.length > 0) {
      score += (matchingFields.length / template.fields.length) * 0.6
    }

    return Math.min(score, 1.0)
  }

  /**
   * Parse fields from database format
   */
  private parseFields(fieldsData: any): FormField[] {
    if (!fieldsData || !Array.isArray(fieldsData)) {
      return []
    }

    return fieldsData.map((field: any, index: number) => ({
      id: field.id || `field_${index}`,
      name: field.name || `field_${index}`,
      label: field.label || field.name || `Field ${index + 1}`,
      type: field.type || 'text',
      required: field.required === true,
      placeholder: field.placeholder,
      options: field.options,
      validation: field.validation,
      aiMapping: field.aiMapping,
      groupId: field.groupId
    }))
  }

  /**
   * Get built-in templates as fallback
   */
  private getBuiltInTemplates(): FormTemplate[] {
    return [
      {
        id: 'visa_application',
        name: 'Visa Application Form',
        description: 'Standard visa application with personal and travel information',
        category: 'visa',
        tags: ['travel', 'immigration', 'passport'],
        fields: [
          {
            id: 'full_name',
            name: 'full_name',
            label: 'Full Name',
            type: 'text',
            required: true,
            aiMapping: { keywords: ['name', 'full name', 'applicant'], priority: 10, confidence: 0.9 }
          },
          {
            id: 'passport_number',
            name: 'passport_number',
            label: 'Passport Number',
            type: 'text',
            required: true,
            aiMapping: { keywords: ['passport', 'passport number', 'document number'], priority: 9, confidence: 0.95 }
          },
          {
            id: 'date_of_birth',
            name: 'date_of_birth',
            label: 'Date of Birth',
            type: 'date',
            required: true,
            aiMapping: { keywords: ['birth', 'born', 'date of birth'], priority: 8, confidence: 0.9 }
          },
          {
            id: 'nationality',
            name: 'nationality',
            label: 'Nationality',
            type: 'text',
            required: true,
            aiMapping: { keywords: ['nationality', 'country', 'citizen'], priority: 7, confidence: 0.85 }
          }
        ],
        isPublic: true,
        isSystem: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'bank_statement_form',
        name: 'Bank Statement Analysis',
        description: 'Financial information extracted from bank statements',
        category: 'financial',
        tags: ['bank', 'finance', 'statement'],
        fields: [
          {
            id: 'account_holder',
            name: 'account_holder',
            label: 'Account Holder',
            type: 'text',
            required: true,
            aiMapping: { keywords: ['account holder', 'name', 'customer'], priority: 10, confidence: 0.9 }
          },
          {
            id: 'account_number',
            name: 'account_number',
            label: 'Account Number',
            type: 'text',
            required: true,
            aiMapping: { keywords: ['account', 'account number', 'account no'], priority: 9, confidence: 0.95 }
          },
          {
            id: 'balance',
            name: 'balance',
            label: 'Current Balance',
            type: 'number',
            required: false,
            aiMapping: { keywords: ['balance', 'current balance', 'amount'], priority: 8, confidence: 0.8 }
          }
        ],
        isPublic: true,
        isSystem: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]
  }

  private generateId(): string {
    return `form_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

// Export singleton instance
export const formTemplateManager = new FormTemplateManager()