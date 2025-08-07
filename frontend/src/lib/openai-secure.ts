import { AIAnalysis } from '@/types';

/**
 * Secure OpenAI integration using Vercel serverless functions
 * All API keys are kept server-side for security
 */

// Use relative URLs for API calls (works with Vercel functions)
const API_BASE = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3000/api'
  : '/api';

// Analyze document text using server-side OpenAI
export async function analyzeDocument(text: string): Promise<AIAnalysis> {
  try {
    const response = await fetch(`${API_BASE}/analyze-document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Server error: ${response.status}`);
    }

    const data = await response.json();
    
    // Map server response to frontend AIAnalysis type
    return {
      document_type: data.document_type,
      confidence: data.confidence,
      suggested_form: data.suggested_form,
      extracted_data: data.extracted_data
    };
  } catch (error) {
    console.error('Error analyzing document:', error);
    
    if (error instanceof Error) {
      // Check for specific error types
      if (error.message.includes('429')) {
        throw new Error('API rate limit exceeded. Please wait a moment and try again.');
      }
      if (error.message.includes('401')) {
        throw new Error('Server configuration error. Please contact support.');
      }
      throw error;
    }
    
    throw new Error('Failed to analyze document. Please try again.');
  }
}

// Extract text from image using server-side OpenAI Vision API
export async function extractTextFromImage(imageBase64: string): Promise<string> {
  try {
    const response = await fetch(`${API_BASE}/extract-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageBase64 })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Server error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    return data.text;
  } catch (error) {
    console.error('Error extracting text from image:', error);
    
    if (error instanceof Error) {
      // Check for specific error types
      if (error.message.includes('429')) {
        throw new Error('API rate limit exceeded. Please wait a moment and try again.');
      }
      if (error.message.includes('401')) {
        throw new Error('Server configuration error. Please contact support.');
      }
      throw error;
    }
    
    throw new Error('Failed to extract text from image. Please try again.');
  }
}

// Check API health status
export async function checkAPIHealth(): Promise<{
  status: string;
  services: {
    openai: string;
    supabase: {
      url: string;
      key: string;
    }
  }
}> {
  try {
    const response = await fetch(`${API_BASE}/health`);
    
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Health check error:', error);
    throw new Error('Unable to connect to API server');
  }
}

// No need for getOpenAIKey or localStorage handling - all secure on server!