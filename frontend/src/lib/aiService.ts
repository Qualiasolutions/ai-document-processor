/**
 * AI Service Client
 * Replaces OpenAI client with new backend AI service abstraction
 * Provides better reliability and removes browser-side API key issues
 */

import { AIAnalysis } from '@/types';

// API response interfaces
interface OCRResponse {
  text: string;
  confidence: number;
  processing_time_ms: number;
}

interface AnalysisResponse {
  document_type: string;
  confidence: number;
  suggested_form: string;
  extracted_data: Record<string, any>;
}

interface StatusResponse {
  [provider: string]: boolean;
}

interface ProcessingResult {
  status: 'uploaded' | 'processing' | 'completed' | 'failed' | 'unsupported';
  error?: string;
  content_length: number;
}

interface DocumentUploadResponse {
  data: {
    document: any;
    fileUrl: string;
    processing: ProcessingResult;
    analysis?: {
      document_type: string;
      confidence: number;
      suggested_form: string;
      extracted_fields: number;
      preview: string[];
    };
  };
}

class AIServiceClient {
  private readonly baseUrl: string;
  
  constructor() {
    // Use Supabase function URL for AI service
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('VITE_SUPABASE_URL environment variable is required');
    }
    this.baseUrl = `${supabaseUrl}/functions/v1`;
  }

  /**
   * Extract text from image using AI OCR
   */
  async extractTextFromImage(imageBase64: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/ai-service`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'extract_text',
          imageData: imageBase64
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `OCR request failed: ${response.status}`);
      }

      const result: OCRResponse = await response.json();
      return result.text;

    } catch (error) {
      console.error('OCR extraction error:', error);
      throw new Error(`Failed to extract text from image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze document text and extract structured data
   */
  async analyzeDocument(text: string): Promise<AIAnalysis> {
    try {
      const response = await fetch(`${this.baseUrl}/ai-service`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'analyze_document',
          text: text
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Analysis request failed: ${response.status}`);
      }

      const result: AnalysisResponse = await response.json();
      
      // Convert to expected format
      return {
        document_type: result.document_type,
        confidence: result.confidence,
        suggested_form: result.suggested_form,
        extracted_data: result.extracted_data
      };

    } catch (error) {
      console.error('Document analysis error:', error);
      throw new Error(`Failed to analyze document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload and process document in one step (enhanced workflow)
   */
  async uploadAndProcessDocument(
    fileData: string, 
    fileName: string, 
    fileType: string,
    onProgress?: (status: string) => void
  ): Promise<DocumentUploadResponse> {
    try {
      onProgress?.('Uploading document...');

      const response = await fetch(`${this.baseUrl}/document-upload-enhanced`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileData,
          fileName,
          fileType
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Upload failed: ${response.status}`);
      }

      const result: DocumentUploadResponse = await response.json();
      
      // Update progress based on processing status
      switch (result.data.processing.status) {
        case 'processing':
          onProgress?.('Processing with AI...');
          break;
        case 'completed':
          onProgress?.('Processing complete!');
          break;
        case 'failed':
          onProgress?.('Processing failed');
          break;
        case 'unsupported':
          onProgress?.('File type not supported for AI processing');
          break;
        default:
          onProgress?.('Upload complete');
      }

      return result;

    } catch (error) {
      console.error('Document upload and processing error:', error);
      throw new Error(`Failed to upload and process document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get AI provider status
   */
  async getProviderStatus(): Promise<StatusResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/ai-service`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'status'
        })
      });

      if (!response.ok) {
        throw new Error(`Status request failed: ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      console.error('Provider status error:', error);
      return {}; // Return empty status on error
    }
  }

  /**
   * Check if AI service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const status = await this.getProviderStatus();
      return Object.values(status).some(available => available);
    } catch {
      return false;
    }
  }
}

// Create singleton instance
export const aiService = new AIServiceClient();

// Legacy compatibility functions for gradual migration
export async function analyzeDocument(text: string): Promise<AIAnalysis> {
  return aiService.analyzeDocument(text);
}

export async function extractTextFromImage(imageBase64: string): Promise<string> {
  return aiService.extractTextFromImage(imageBase64);
}

// New enhanced function
export async function uploadAndProcessDocument(
  fileData: string, 
  fileName: string, 
  fileType: string,
  onProgress?: (status: string) => void
): Promise<DocumentUploadResponse> {
  return aiService.uploadAndProcessDocument(fileData, fileName, fileType, onProgress);
}

// Utility function to check AI service health
export async function checkAIServiceHealth(): Promise<{
  available: boolean;
  providers: StatusResponse;
  error?: string;
}> {
  try {
    const providers = await aiService.getProviderStatus();
    const available = Object.values(providers).some(status => status);
    
    return {
      available,
      providers
    };
  } catch (error) {
    return {
      available: false,
      providers: {},
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export default aiService;