/**
 * Production Document Processor
 * Enhanced document processing with OpenAI Vision API and real-time updates
 */
import { supabase } from './supabase'
import OpenAI from 'openai'
import { readFileContent } from './fileUtils'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || 'demo-key',
  dangerouslyAllowBrowser: true
})

export interface ProcessingProgress {
  documentId: string
  stage: 'uploading' | 'analyzing' | 'extracting' | 'generating' | 'completed' | 'error'
  progress: number
  message: string
  data?: any
  error?: string
}

export interface DocumentAnalysis {
  documentType: string
  confidence: number
  extractedFields: Record<string, any>
  suggestedFormType: string
  ocrText?: string
  metadata: {
    processingTime: number
    aiModel: string
    fileSize: number
    fileType: string
  }
}

export interface ProcessedDocument {
  id: string
  filename: string
  fileUrl: string
  analysis: DocumentAnalysis
  generatedForm?: any
}

export class DocumentProcessor {
  private progressCallbacks: Map<string, (progress: ProcessingProgress) => void> = new Map()
  private subscriptions: Map<string, any> = new Map()

  /**
   * Process a single document with real-time progress updates
   */
  async processDocument(
    file: File,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<ProcessedDocument> {
    const documentId = this.generateDocumentId()
    
    if (onProgress) {
      this.progressCallbacks.set(documentId, onProgress)
    }

    try {
      // Stage 1: Upload document
      this.updateProgress(documentId, 'uploading', 10, 'Uploading document...')
      
      const uploadedDoc = await this.uploadDocument(file, documentId)
      
      // Stage 2: Analyze document with AI
      this.updateProgress(documentId, 'analyzing', 30, 'Analyzing document with AI...')
      
      const analysis = await this.analyzeDocument(file, uploadedDoc)
      
      // Stage 3: Extract structured data
      this.updateProgress(documentId, 'extracting', 60, 'Extracting structured data...')
      
      await this.saveAnalysis(uploadedDoc.id, analysis)
      
      // Stage 4: Generate form if applicable
      this.updateProgress(documentId, 'generating', 80, 'Generating form...')
      
      const generatedForm = await this.generateForm(uploadedDoc, analysis)
      
      // Stage 5: Complete
      this.updateProgress(documentId, 'completed', 100, 'Processing completed!', {
        analysis,
        form: generatedForm
      })

      return {
        id: uploadedDoc.id,
        filename: file.name,
        fileUrl: uploadedDoc.file_url,
        analysis,
        generatedForm
      }

    } catch (error) {
      console.error('Document processing error:', error)
      this.updateProgress(documentId, 'error', 0, 'Processing failed', undefined, error.message)
      throw error
    } finally {
      this.cleanup(documentId)
    }
  }

  /**
   * Process multiple documents concurrently
   */
  async processBatch(
    files: File[],
    onBatchProgress?: (completed: number, total: number, results: ProcessedDocument[]) => void
  ): Promise<ProcessedDocument[]> {
    const results: ProcessedDocument[] = []
    const total = files.length
    let completed = 0

    const promises = files.map(async (file) => {
      try {
        const result = await this.processDocument(file)
        results.push(result)
        completed++
        
        if (onBatchProgress) {
          onBatchProgress(completed, total, results)
        }
        
        return result
      } catch (error) {
        completed++
        console.error(`Failed to process ${file.name}:`, error)
        
        if (onBatchProgress) {
          onBatchProgress(completed, total, results)
        }
        
        throw error
      }
    })

    await Promise.allSettled(promises)
    return results
  }

  /**
   * Upload document to Supabase storage
   */
  private async uploadDocument(file: File, documentId: string) {
    const fileData = await this.fileToBase64(file)
    
    const { data, error } = await supabase.functions.invoke('document-upload', {
      body: {
        fileData,
        fileName: file.name,
        fileType: file.type
      }
    })

    if (error) {
      throw new Error(`Upload failed: ${error.message}`)
    }

    return data.data.document
  }

  /**
   * Analyze document using OpenAI Vision API for images or Chat API for text/PDFs
   */
  private async analyzeDocument(file: File, uploadedDoc: any): Promise<DocumentAnalysis> {
    const startTime = Date.now()
    
    try {
      let analysis: DocumentAnalysis

      if (file.type.startsWith('image/')) {
        // Use Vision API for images
        analysis = await this.analyzeWithVision(file)
      } else if (file.name.toLowerCase().endsWith('.pdf') || 
                 file.name.toLowerCase().endsWith('.docx') ||
                 file.name.toLowerCase().endsWith('.txt') ||
                 file.name.toLowerCase().endsWith('.csv')) {
        // Extract text content from supported documents
        let textContent = uploadedDoc.content
        
        // If no content from backend, extract it on frontend
        if (!textContent || textContent === `File: ${file.name}`) {
          try {
            textContent = await readFileContent(file)
          } catch (error) {
            console.error('Failed to extract text:', error)
            textContent = ''
          }
        }
        
        if (textContent) {
          analysis = await this.analyzeWithText(textContent)
        } else {
          // Fallback to OCR for PDFs that might be image-based
          if (file.name.toLowerCase().endsWith('.pdf')) {
            console.log('PDF text extraction failed, trying OCR...')
            analysis = await this.analyzeWithVision(file)
          } else {
            throw new Error('No text content could be extracted from the document')
          }
        }
      } else {
        // Unsupported file type
        throw new Error(`Unsupported file type: ${file.type}`)
      }

      // Add metadata
      analysis.metadata = {
        processingTime: Date.now() - startTime,
        aiModel: file.type.startsWith('image/') ? 'gpt-4o-vision' : 'gpt-4o',
        fileSize: file.size,
        fileType: file.type
      }

      return analysis

    } catch (error) {
      console.error('AI analysis failed:', error)
      
      // Fallback analysis
      return {
        documentType: 'unknown',
        confidence: 0.1,
        extractedFields: {},
        suggestedFormType: 'generic',
        metadata: {
          processingTime: Date.now() - startTime,
          aiModel: 'fallback',
          fileSize: file.size,
          fileType: file.type
        }
      }
    }
  }

  /**
   * Analyze document using OpenAI Vision API
   */
  private async analyzeWithVision(file: File): Promise<DocumentAnalysis> {
    const base64Data = await this.fileToBase64(file, false) // No data URL prefix
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert document analyzer specializing in extracting structured data from various document types. You must always respond with valid JSON only.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this document image carefully and extract ALL relevant information. Identify the document type and extract every field you can find.

Return a JSON response with this EXACT structure:
{
  "documentType": "passport|visa|bank_statement|employment|medical|legal|financial|personal|contract|invoice|resume|other",
  "confidence": 0.0-1.0,
  "extractedFields": {
    "full_name": "value if found",
    "first_name": "value if found",
    "last_name": "value if found",
    "date_of_birth": "YYYY-MM-DD format if found",
    "nationality": "value if found",
    "passport_number": "value if found",
    "passport_expiry": "YYYY-MM-DD format if found",
    "gender": "value if found",
    "place_of_birth": "value if found",
    "email": "value if found",
    "phone": "value if found",
    "address": "value if found",
    "city": "value if found",
    "state": "value if found",
    "postal_code": "value if found",
    "country": "value if found",
    "account_number": "value if found",
    "bank_name": "value if found",
    "account_balance": "value if found",
    "monthly_income": "value if found",
    "company": "value if found",
    "position": "value if found",
    "employment_date": "YYYY-MM-DD format if found",
    "salary": "value if found",
    "department": "value if found",
    "employee_id": "value if found",
    "visa_type": "value if found",
    "visa_number": "value if found",
    "visa_expiry": "YYYY-MM-DD format if found",
    "issue_date": "YYYY-MM-DD format if found",
    "issuing_authority": "value if found",
    "purpose_of_visit": "value if found",
    "duration_of_stay": "value if found",
    "additional_info": {}
  },
  "suggestedFormType": "visa_application|financial_declaration|personal_information|employment_application|medical_intake|legal_document",
  "ocrText": "full extracted text from the document"
}

CRITICAL RULES:
1. Extract EVERY field you can identify, not just the ones listed
2. Use empty string "" for fields not found in the document
3. Format all dates as YYYY-MM-DD
4. Put any extra fields found in "additional_info" object
5. Be thorough - extract addresses, reference numbers, dates, amounts, names, etc.
6. For financial documents, extract ALL transaction details
7. For legal documents, extract parties, dates, terms
8. Identify document type accurately based on content`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${file.type};base64,${base64Data}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 4000,
      temperature: 0.1
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI Vision API')
    }

    try {
      const result = JSON.parse(content)
      // Clean up empty fields
      if (result.extractedFields) {
        Object.keys(result.extractedFields).forEach(key => {
          if (!result.extractedFields[key] || result.extractedFields[key] === "") {
            delete result.extractedFields[key]
          }
        })
      }
      
      // Convert to consistent DocumentAnalysis format
      return {
        documentType: result.documentType || 'unknown',
        confidence: result.confidence || 0.5,
        extractedFields: result.extractedFields || {},
        suggestedFormType: result.suggestedFormType || 'personal_information',
        ocrText: result.ocrText,
        metadata: {
          processingTime: 0,
          aiModel: 'gpt-4o-vision',
          fileSize: file.size,
          fileType: file.type
        }
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', content)
      // If JSON parsing fails, create a structured response
      return {
        documentType: 'unknown',
        confidence: 0.5,
        extractedFields: { raw_ai_response: content },
        suggestedFormType: 'personal_information',
        ocrText: content,
        metadata: {
          processingTime: 0,
          aiModel: 'gpt-4o-vision',
          fileSize: file.size,
          fileType: file.type
        }
      }
    }
  }

  /**
   * Analyze text document using OpenAI Chat API
   */
  private async analyzeWithText(content: string): Promise<DocumentAnalysis> {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert document analyzer specializing in extracting structured data from text documents. You must ALWAYS respond with valid JSON only - no explanations, no markdown, just pure JSON.`
        },
        {
          role: "user",
          content: `Analyze this document text thoroughly and extract ALL structured information:

${content.substring(0, 8000)}

IMPORTANT: Return ONLY a valid JSON response with this EXACT structure:
{
  "documentType": "passport|visa|bank_statement|employment|financial|personal|legal|contract|medical|invoice|resume|other",
  "confidence": 0.0-1.0,
  "extractedFields": {
    "full_name": "extracted name if found",
    "first_name": "extracted first name if found",
    "last_name": "extracted last name if found",
    "email": "extracted email if found",
    "phone": "extracted phone if found",
    "address": "extracted address if found",
    "city": "extracted city if found",
    "state": "extracted state if found",
    "postal_code": "extracted postal code if found",
    "country": "extracted country if found",
    "date_of_birth": "YYYY-MM-DD format if found",
    "nationality": "extracted nationality if found",
    "passport_number": "extracted passport number if found",
    "passport_expiry": "YYYY-MM-DD format if found",
    "account_number": "extracted account number if found",
    "bank_name": "extracted bank name if found",
    "account_balance": "extracted balance if found",
    "monthly_income": "extracted income if found",
    "company": "extracted company name if found",
    "position": "extracted job title if found",
    "department": "extracted department if found",
    "employee_id": "extracted employee ID if found",
    "salary": "extracted salary if found",
    "employment_date": "YYYY-MM-DD format if found",
    "visa_type": "extracted visa type if found",
    "visa_number": "extracted visa number if found",
    "issue_date": "YYYY-MM-DD format if found",
    "expiry_date": "YYYY-MM-DD format if found",
    "purpose_of_visit": "extracted purpose if found",
    "duration_of_stay": "extracted duration if found",
    "contract_terms": "extracted terms if found",
    "invoice_number": "extracted invoice number if found",
    "invoice_amount": "extracted amount if found",
    "due_date": "YYYY-MM-DD format if found",
    "additional_info": {}
  },
  "suggestedFormType": "visa_application|financial_declaration|personal_information|employment_application|medical_intake|legal_document"
}

CRITICAL EXTRACTION RULES:
1. Identify document type based on keywords and content patterns
2. Extract EVERY piece of structured data you can find
3. Look for: names, dates, numbers, addresses, IDs, amounts, etc.
4. Use empty string "" for missing fields, never null
5. Format ALL dates as YYYY-MM-DD
6. For passport: focus on personal details, document numbers, dates
7. For financial: extract ALL account details, transactions, balances
8. For employment: extract job details, salary, company info
9. For visa: extract travel details, visa info, purpose
10. Put any extra fields not listed above in "additional_info"
11. Match the suggestedFormType to the document content`
        }
      ],
      max_tokens: 2000,
      temperature: 0.1
    })

    const content_response = response.choices[0]?.message?.content
    if (!content_response) {
      throw new Error('No response from OpenAI Chat API')
    }

    try {
      const result = JSON.parse(content_response)
      // Clean up empty fields
      if (result.extractedFields) {
        Object.keys(result.extractedFields).forEach(key => {
          if (!result.extractedFields[key] || result.extractedFields[key] === "") {
            delete result.extractedFields[key]
          }
        })
      }
      
      // Convert to consistent DocumentAnalysis format
      return {
        documentType: result.documentType || 'personal',
        confidence: result.confidence || 0.5,
        extractedFields: result.extractedFields || {},
        suggestedFormType: result.suggestedFormType || 'personal_information',
        metadata: {
          processingTime: 0,
          aiModel: 'gpt-4o',
          fileSize: content.length,
          fileType: 'text'
        }
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', content_response)
      return {
        documentType: 'personal',
        confidence: 0.5,
        extractedFields: { raw_content: content.substring(0, 500) },
        suggestedFormType: 'personal_information',
        metadata: {
          processingTime: 0,
          aiModel: 'gpt-4o',
          fileSize: content.length,
          fileType: 'text'
        }
      }
    }
  }

  /**
   * Save analysis results to database
   */
  private async saveAnalysis(documentId: string, analysis: DocumentAnalysis) {
    const { error } = await supabase
      .from('documents')
      .update({
        document_type: analysis.documentType,
        ai_analysis: analysis,
        processing_status: 'analyzed',
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId)

    if (error) {
      console.error('Failed to save analysis:', error)
      throw new Error(`Failed to save analysis: ${error.message}`)
    }
  }

  /**
   * Generate form based on document analysis using template manager
   */
  private async generateForm(document: any, analysis: DocumentAnalysis) {
    try {
      // Import the form template manager
      const { formTemplateManager } = await import('./formTemplateManager')

      // Find the best template for this document
      const template = await formTemplateManager.findBestTemplate(
        analysis.documentType,
        analysis.extractedFields
      )

      if (!template) {
        console.warn('No suitable template found for document type:', analysis.documentType)
        return null
      }

      // Create form instance
      const formInstance = await formTemplateManager.createFormInstance(
        template.id,
        [document.id],
        analysis,
        `${template.name} - ${document.filename}`
      )

      return {
        form: formInstance,
        template: template,
        confidence: formInstance.confidence,
        mappedFields: Object.keys(formInstance.formData).length
      }

    } catch (error) {
      console.warn('Form generation error:', error)
      
      // Fallback to edge function
      try {
        const { data, error: edgeError } = await supabase.functions.invoke('form-generation', {
          body: {
            documentId: document.id,
            analysis,
            formType: analysis.suggestedFormType
          }
        })

        if (edgeError) {
          console.warn('Edge function form generation failed:', edgeError)
          return null
        }

        return data
      } catch (fallbackError) {
        console.warn('Fallback form generation error:', fallbackError)
        return null
      }
    }
  }

  /**
   * Subscribe to real-time document processing updates
   */
  subscribeToDocumentUpdates(
    documentId: string,
    onUpdate: (document: any) => void
  ): () => void {
    const channel = supabase
      .channel(`document_${documentId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'documents',
        filter: `id=eq.${documentId}`
      }, (payload) => {
        onUpdate(payload.new)
      })
      .subscribe()

    this.subscriptions.set(documentId, channel)

    // Return unsubscribe function
    return () => {
      supabase.removeChannel(channel)
      this.subscriptions.delete(documentId)
    }
  }

  /**
   * Utility methods
   */
  private updateProgress(
    documentId: string,
    stage: ProcessingProgress['stage'],
    progress: number,
    message: string,
    data?: any,
    error?: string
  ) {
    const callback = this.progressCallbacks.get(documentId)
    if (callback) {
      callback({
        documentId,
        stage,
        progress,
        message,
        data,
        error
      })
    }
  }

  private generateDocumentId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private async fileToBase64(file: File, includeDataUrl: boolean = true): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        if (includeDataUrl) {
          resolve(result)
        } else {
          // Remove data URL prefix
          resolve(result.split(',')[1])
        }
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  private async readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsText(file)
    })
  }

  private cleanup(documentId: string) {
    this.progressCallbacks.delete(documentId)
    
    const subscription = this.subscriptions.get(documentId)
    if (subscription) {
      supabase.removeChannel(subscription)
      this.subscriptions.delete(documentId)
    }
  }
}

// Export singleton instance
export const documentProcessor = new DocumentProcessor()