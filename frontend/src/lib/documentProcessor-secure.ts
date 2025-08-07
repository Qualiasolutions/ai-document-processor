/**
 * Secure Document Processor
 * Uses server-side API endpoints - no API keys in browser
 */
import { supabase } from './supabase'
import { readFileContent } from './fileUtils'
import { analyzeDocument, extractTextFromImage } from './openai-secure'

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
   * Process a document through the complete pipeline
   * Now secure - all API calls go through our server
   */
  async processDocument(
    file: File,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<ProcessedDocument> {
    const startTime = Date.now()
    const documentId = crypto.randomUUID()
    
    // Progress callback helper
    const updateProgress = (update: Partial<ProcessingProgress>) => {
      const progress: ProcessingProgress = {
        documentId,
        stage: update.stage || 'uploading',
        progress: update.progress || 0,
        message: update.message || '',
        ...update
      }
      onProgress?.(progress)
    }

    try {
      // Step 1: Upload to Supabase storage
      updateProgress({
        stage: 'uploading',
        progress: 20,
        message: 'Uploading document...'
      })

      const fileExt = file.name.split('.').pop()
      const fileName = `${documentId}.${fileExt}`
      const filePath = `anonymous/${fileName}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath)

      // Step 2: Extract text based on file type
      updateProgress({
        stage: 'extracting',
        progress: 40,
        message: 'Extracting text from document...'
      })

      let extractedText = ''
      
      if (file.type.includes('image') || file.type === 'application/pdf') {
        // For images and PDFs, use OCR via our secure API
        const base64 = await fileToBase64(file)
        extractedText = await extractTextFromImage(base64)
      } else {
        // For text files, read directly
        extractedText = await readFileContent(file)
      }

      if (!extractedText) {
        throw new Error('No text could be extracted from the document')
      }

      // Step 3: Analyze with AI (secure server-side)
      updateProgress({
        stage: 'analyzing',
        progress: 60,
        message: 'Analyzing document content...'
      })

      const aiAnalysis = await analyzeDocument(extractedText)

      // Step 4: Store in database
      updateProgress({
        stage: 'generating',
        progress: 80,
        message: 'Saving analysis results...'
      })

      const { data: document, error: dbError } = await supabase
        .from('documents')
        .insert({
          id: documentId,
          user_id: null, // Anonymous processing
          filename: file.name,
          file_url: publicUrl,
          file_size: file.size,
          mime_type: file.type,
          content: extractedText.substring(0, 10000), // Store first 10k chars
          document_type: aiAnalysis.document_type,
          ai_analysis: aiAnalysis,
          processing_status: 'completed'
        })
        .select()
        .single()

      if (dbError) throw dbError

      // Step 5: Generate form
      const analysis: DocumentAnalysis = {
        documentType: aiAnalysis.document_type,
        confidence: aiAnalysis.confidence,
        extractedFields: aiAnalysis.extracted_data,
        suggestedFormType: aiAnalysis.suggested_form,
        ocrText: extractedText,
        metadata: {
          processingTime: Date.now() - startTime,
          aiModel: 'gpt-3.5-turbo', // Using secure server-side model
          fileSize: file.size,
          fileType: file.type
        }
      }

      // Create form entry
      const { data: form, error: formError } = await supabase
        .from('generated_forms')
        .insert({
          user_id: null, // Anonymous
          document_ids: [documentId],
          template_id: null,
          form_data: aiAnalysis.extracted_data,
          form_type: aiAnalysis.suggested_form,
          status: 'draft',
          title: `Form from ${file.name}`
        })
        .select()
        .single()

      if (formError) console.error('Form creation error:', formError)

      updateProgress({
        stage: 'completed',
        progress: 100,
        message: 'Document processed successfully!',
        data: { document, form, analysis }
      })

      return {
        id: documentId,
        filename: file.name,
        fileUrl: publicUrl,
        analysis,
        generatedForm: form
      }

    } catch (error) {
      console.error('Document processing error:', error)
      
      updateProgress({
        stage: 'error',
        progress: 0,
        message: 'Processing failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      throw error
    }
  }

  /**
   * Subscribe to real-time processing updates
   */
  subscribeToUpdates(
    documentId: string,
    callback: (progress: ProcessingProgress) => void
  ) {
    this.progressCallbacks.set(documentId, callback)
    
    // Subscribe to database changes
    const subscription = supabase
      .channel(`document-${documentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'documents',
          filter: `id=eq.${documentId}`
        },
        (payload) => {
          const doc = payload.new
          const progress: ProcessingProgress = {
            documentId,
            stage: doc.processing_status === 'completed' ? 'completed' : 'analyzing',
            progress: doc.processing_status === 'completed' ? 100 : 50,
            message: doc.processing_status === 'completed' 
              ? 'Processing complete!' 
              : 'Processing document...',
            data: doc
          }
          callback(progress)
        }
      )
      .subscribe()
    
    this.subscriptions.set(documentId, subscription)
  }

  /**
   * Unsubscribe from updates
   */
  unsubscribeFromUpdates(documentId: string) {
    const subscription = this.subscriptions.get(documentId)
    if (subscription) {
      subscription.unsubscribe()
      this.subscriptions.delete(documentId)
    }
    this.progressCallbacks.delete(documentId)
  }

  /**
   * Clean up all subscriptions
   */
  cleanup() {
    this.subscriptions.forEach(sub => sub.unsubscribe())
    this.subscriptions.clear()
    this.progressCallbacks.clear()
  }
}

// Helper function to convert file to base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = error => reject(error)
  })
}

// Export singleton instance
export const documentProcessor = new DocumentProcessor()