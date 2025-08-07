/**
 * Enhanced Document Processor
 * Uses new AI service abstraction instead of OpenAI directly
 * Provides better reliability and removes browser-side API key issues
 */

import { supabase } from './supabase'
import { aiService, uploadAndProcessDocument } from './aiService'
import { readFileContent } from './fileUtils'

export interface ProcessingProgress {
  documentId: string
  stage: 'uploading' | 'processing' | 'analyzing' | 'extracting' | 'generating' | 'completed' | 'error'
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
    aiProvider: string
    fileSize: number
    fileType: string
    providers: string[]
  }
}

export interface ProcessedDocument {
  id: string
  filename: string
  fileUrl: string
  analysis: DocumentAnalysis
  generatedForm?: any
}

export class EnhancedDocumentProcessor {
  private progressCallbacks: Map<string, (progress: ProcessingProgress) => void> = new Map()
  private subscriptions: Map<string, any> = new Map()

  /**
   * Process document using new enhanced backend
   */
  async processDocument(
    file: File,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<ProcessedDocument> {
    const documentId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    if (onProgress) {
      this.progressCallbacks.set(documentId, onProgress)
    }

    try {
      // Convert file to base64
      this.updateProgress(documentId, 'uploading', 10, 'Converting file...')
      const fileData = await this.fileToBase64(file)
      
      // Upload and process in one step using enhanced backend
      this.updateProgress(documentId, 'uploading', 20, 'Uploading to server...')
      
      const result = await uploadAndProcessDocument(
        fileData,
        file.name,
        file.type,
        (status: string) => {
          // Map backend status to progress stages
          if (status.includes('Uploading')) {
            this.updateProgress(documentId, 'uploading', 40, status)
          } else if (status.includes('Processing') || status.includes('AI')) {
            this.updateProgress(documentId, 'processing', 60, status)
          } else if (status.includes('complete')) {
            this.updateProgress(documentId, 'analyzing', 80, status)
          }
        }
      )

      // Process the response
      const document = result.data.document
      const analysis = result.data.analysis
      const processing = result.data.processing

      // Check processing status
      if (processing.status === 'failed') {
        throw new Error(processing.error || 'Document processing failed')
      }

      if (processing.status === 'unsupported') {
        throw new Error('File type not supported for AI processing')
      }

      // Create analysis object
      const documentAnalysis: DocumentAnalysis = {
        documentType: analysis?.document_type || 'other',
        confidence: analysis?.confidence || 0.5,
        extractedFields: {}, // Will be populated from database
        suggestedFormType: analysis?.suggested_form || 'personal_information',
        metadata: {
          processingTime: 0, // Will be calculated
          aiProvider: 'enhanced-service',
          fileSize: file.size,
          fileType: file.type,
          providers: ['mistral', 'claude'] // Used providers
        }
      }

      // Fetch detailed extraction data from database
      this.updateProgress(documentId, 'analyzing', 85, 'Fetching analysis results...')
      
      try {
        const { data: extractions } = await supabase
          .from('document_extractions')
          .select('*')
          .eq('document_id', document.id)
          .order('created_at', { ascending: false })
          .limit(1)

        if (extractions && extractions.length > 0) {
          const extraction = extractions[0]
          documentAnalysis.extractedFields = extraction.extraction_data || {}
          documentAnalysis.confidence = extraction.confidence_score || documentAnalysis.confidence
          documentAnalysis.documentType = extraction.document_type || documentAnalysis.documentType
          
          if (extraction.processing_metadata?.processing_time) {
            documentAnalysis.metadata.processingTime = extraction.processing_metadata.processing_time
          }
        }
      } catch (extractionError) {
        console.warn('Failed to fetch extraction details:', extractionError)
        // Continue without detailed extraction data
      }

      // Check for generated forms
      this.updateProgress(documentId, 'generating', 90, 'Checking for generated forms...')
      
      let generatedForm = null
      try {
        const { data: forms } = await supabase
          .from('generated_forms')
          .select('*')
          .eq('document_id', document.id)
          .order('created_at', { ascending: false })
          .limit(1)

        if (forms && forms.length > 0) {
          generatedForm = forms[0]
        }
      } catch (formError) {
        console.warn('Failed to fetch generated forms:', formError)
        // Continue without form data
      }

      // Complete processing
      this.updateProgress(documentId, 'completed', 100, 'Processing complete!')

      const processedDocument: ProcessedDocument = {
        id: document.id,
        filename: document.filename,
        fileUrl: result.data.fileUrl,
        analysis: documentAnalysis,
        generatedForm: generatedForm
      }

      // Cleanup progress callback
      this.progressCallbacks.delete(documentId)

      return processedDocument

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      this.updateProgress(documentId, 'error', 0, 'Processing failed', errorMessage)
      
      // Cleanup
      this.progressCallbacks.delete(documentId)
      
      throw new Error(`Document processing failed: ${errorMessage}`)
    }
  }

  /**
   * Process multiple documents
   */
  async processDocuments(
    files: File[],
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<ProcessedDocument[]> {
    const results: ProcessedDocument[] = []
    const totalFiles = files.length

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const overallProgress = Math.floor((i / totalFiles) * 100)
      
      if (onProgress) {
        onProgress({
          documentId: 'batch',
          stage: 'processing',
          progress: overallProgress,
          message: `Processing ${file.name} (${i + 1}/${totalFiles})`,
          data: { currentFile: i + 1, totalFiles }
        })
      }

      try {
        const result = await this.processDocument(file, onProgress)
        results.push(result)
      } catch (error) {
        console.error(`Failed to process ${file.name}:`, error)
        // Continue with other files
      }
    }

    if (onProgress) {
      onProgress({
        documentId: 'batch',
        stage: 'completed',
        progress: 100,
        message: `Processed ${results.length}/${totalFiles} documents`,
        data: { processed: results.length, total: totalFiles }
      })
    }

    return results
  }

  /**
   * Get AI service health status
   */
  async getServiceHealth(): Promise<{
    available: boolean
    providers: Record<string, boolean>
    error?: string
  }> {
    try {
      const status = await aiService.getProviderStatus()
      const available = Object.values(status).some(isAvailable => isAvailable)
      
      return {
        available,
        providers: status
      }
    } catch (error) {
      return {
        available: false,
        providers: {},
        error: error instanceof Error ? error.message : 'Service check failed'
      }
    }
  }

  /**
   * Re-analyze existing document using new AI service
   */
  async reAnalyzeDocument(documentId: string): Promise<DocumentAnalysis | null> {
    try {
      // Get document from database
      const { data: document } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single()

      if (!document) {
        throw new Error('Document not found')
      }

      if (!document.content) {
        throw new Error('Document has no content to analyze')
      }

      // Analyze using new AI service
      const analysis = await aiService.analyzeDocument(document.content)

      // Save new analysis
      const extractionData = {
        document_id: documentId,
        user_id: document.user_id,
        extraction_data: analysis.extracted_data,
        confidence_score: analysis.confidence,
        document_type: analysis.document_type,
        processing_metadata: {
          suggested_form: analysis.suggested_form,
          ai_provider: 'enhanced-service',
          re_analysis: true,
          processing_time: Date.now()
        },
        created_at: new Date().toISOString()
      }

      await supabase.from('document_extractions').insert(extractionData)

      return {
        documentType: analysis.document_type,
        confidence: analysis.confidence,
        extractedFields: analysis.extracted_data,
        suggestedFormType: analysis.suggested_form,
        metadata: {
          processingTime: 0,
          aiProvider: 'enhanced-service',
          fileSize: document.file_size || 0,
          fileType: document.file_type || 'unknown',
          providers: ['mistral', 'claude']
        }
      }

    } catch (error) {
      console.error('Re-analysis failed:', error)
      throw new Error(`Failed to re-analyze document: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private updateProgress(
    documentId: string, 
    stage: ProcessingProgress['stage'], 
    progress: number, 
    message: string, 
    error?: string
  ) {
    const callback = this.progressCallbacks.get(documentId)
    if (callback) {
      callback({
        documentId,
        stage,
        progress,
        message,
        error
      })
    }
  }

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result)
        } else {
          reject(new Error('Failed to convert file to base64'))
        }
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }

  /**
   * Cleanup method to remove progress callbacks and subscriptions
   */
  cleanup() {
    this.progressCallbacks.clear()
    this.subscriptions.forEach(subscription => {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe()
      }
    })
    this.subscriptions.clear()
  }
}

// Create singleton instance
export const enhancedDocumentProcessor = new EnhancedDocumentProcessor()

// Legacy compatibility export
export const documentProcessor = enhancedDocumentProcessor

export default enhancedDocumentProcessor