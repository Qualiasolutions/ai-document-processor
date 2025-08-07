/**
 * AI Service Abstraction Layer
 * Provides unified interface for multiple AI providers
 * Eliminates OpenAI dependency issues and improves reliability
 */

// Types for AI service responses
export interface AIAnalysisResult {
  document_type: 'passport' | 'visa' | 'financial' | 'personal' | 'contract' | 'other';
  confidence: number;
  suggested_form: string;
  extracted_data: Record<string, any>;
}

export interface OCRResult {
  text: string;
  confidence: number;
  processing_time_ms: number;
}

// AI Provider interface
export interface AIProvider {
  name: string;
  extractTextFromImage(imageData: string): Promise<OCRResult>;
  analyzeDocument(text: string): Promise<AIAnalysisResult>;
  isAvailable(): Promise<boolean>;
}

// Provider configuration
interface AIServiceConfig {
  ocr_provider: 'mistral' | 'azure' | 'google' | 'openai';
  analysis_provider: 'claude' | 'openai' | 'azure';
  fallback_providers: string[];
  max_retries: number;
  timeout_ms: number;
}

// Default configuration
const DEFAULT_CONFIG: AIServiceConfig = {
  ocr_provider: 'mistral',
  analysis_provider: 'claude',
  fallback_providers: ['openai'],
  max_retries: 3,
  timeout_ms: 30000
};

// Import providers
import { MistralOCRProvider } from './providers/mistral-ocr.ts';
import { ClaudeAnalysisProvider } from './providers/claude-analysis.ts';
import { OpenAIProvider } from './providers/openai-fallback.ts';

export class AIService {
  private providers: Map<string, AIProvider> = new Map();
  private config: AIServiceConfig;

  constructor(config: Partial<AIServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeProviders();
  }

  private initializeProviders() {
    // Initialize all available providers
    this.providers.set('mistral', new MistralOCRProvider());
    this.providers.set('claude', new ClaudeAnalysisProvider());
    this.providers.set('openai', new OpenAIProvider());
  }

  async extractTextFromImage(imageData: string): Promise<OCRResult> {
    const startTime = Date.now();
    
    // Try primary OCR provider
    const primaryProvider = this.providers.get(this.config.ocr_provider);
    if (primaryProvider) {
      try {
        const result = await this.retryOperation(
          () => primaryProvider.extractTextFromImage(imageData),
          this.config.max_retries
        );
        return {
          ...result,
          processing_time_ms: Date.now() - startTime
        };
      } catch (error) {
        console.warn(`Primary OCR provider ${this.config.ocr_provider} failed:`, error);
      }
    }

    // Try fallback providers
    for (const fallbackName of this.config.fallback_providers) {
      const fallbackProvider = this.providers.get(fallbackName);
      if (fallbackProvider) {
        try {
          const result = await this.retryOperation(
            () => fallbackProvider.extractTextFromImage(imageData),
            2 // Fewer retries for fallbacks
          );
          console.log(`Used fallback OCR provider: ${fallbackName}`);
          return {
            ...result,
            processing_time_ms: Date.now() - startTime
          };
        } catch (error) {
          console.warn(`Fallback OCR provider ${fallbackName} failed:`, error);
        }
      }
    }

    throw new Error('All OCR providers failed');
  }

  async analyzeDocument(text: string): Promise<AIAnalysisResult> {
    // Try primary analysis provider
    const primaryProvider = this.providers.get(this.config.analysis_provider);
    if (primaryProvider) {
      try {
        return await this.retryOperation(
          () => primaryProvider.analyzeDocument(text),
          this.config.max_retries
        );
      } catch (error) {
        console.warn(`Primary analysis provider ${this.config.analysis_provider} failed:`, error);
      }
    }

    // Try fallback providers
    for (const fallbackName of this.config.fallback_providers) {
      const fallbackProvider = this.providers.get(fallbackName);
      if (fallbackProvider) {
        try {
          const result = await this.retryOperation(
            () => fallbackProvider.analyzeDocument(text),
            2 // Fewer retries for fallbacks
          );
          console.log(`Used fallback analysis provider: ${fallbackName}`);
          return result;
        } catch (error) {
          console.warn(`Fallback analysis provider ${fallbackName} failed:`, error);
        }
      }
    }

    throw new Error('All analysis providers failed');
  }

  async getProviderStatus(): Promise<Record<string, boolean>> {
    const status: Record<string, boolean> = {};
    
    for (const [name, provider] of this.providers) {
      try {
        status[name] = await provider.isAvailable();
      } catch {
        status[name] = false;
      }
    }
    
    return status;
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await Promise.race([
          operation(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Operation timeout')), this.config.timeout_ms)
          )
        ]);
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on authentication errors
        if (lastError.message.includes('401') || lastError.message.includes('Invalid API key')) {
          throw lastError;
        }
        
        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
        }
      }
    }

    throw lastError!;
  }
}

// Supabase Edge Function handler
Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'false'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();
    const aiService = new AIService();

    switch (action) {
      case 'extract_text':
        if (!params.imageData) {
          throw new Error('imageData is required for text extraction');
        }
        const ocrResult = await aiService.extractTextFromImage(params.imageData);
        return new Response(JSON.stringify(ocrResult), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case 'analyze_document':
        if (!params.text) {
          throw new Error('text is required for document analysis');
        }
        const analysisResult = await aiService.analyzeDocument(params.text);
        return new Response(JSON.stringify(analysisResult), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case 'status':
        const statusResult = await aiService.getProviderStatus();
        return new Response(JSON.stringify(statusResult), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('AI Service error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});