/**
 * Mistral OCR Provider
 * Implements OCR using Mistral's new OCR API (2024)
 * 50x cheaper than OpenAI with better document understanding
 */

import { AIProvider, OCRResult, AIAnalysisResult } from '../index.ts';

export class MistralOCRProvider implements AIProvider {
  public readonly name = 'mistral-ocr';
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.mistral.ai/v1';

  constructor() {
    this.apiKey = Deno.env.get('MISTRAL_API_KEY') || '';
    if (!this.apiKey) {
      console.warn('MISTRAL_API_KEY not found in environment variables');
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async extractTextFromImage(imageData: string): Promise<OCRResult> {
    if (!this.apiKey) {
      throw new Error('Mistral API key is required');
    }

    const startTime = Date.now();

    try {
      // Prepare the request for Mistral OCR
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'mistral-ocr-latest',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract all text from this document. Return only the extracted text with no additional formatting, explanations, or markdown. If there is no readable text, return "No text found".'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageData
                  }
                }
              ]
            }
          ],
          temperature: 0.1,
          max_tokens: 4000
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Mistral API error: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      const extractedText = data.choices?.[0]?.message?.content;

      if (!extractedText) {
        throw new Error('No text content returned from Mistral OCR');
      }

      // Clean up the response
      const cleanText = extractedText.trim()
        .replace(/^```[\w]*\n?/, '') // Remove opening code blocks
        .replace(/\n?```$/, '')     // Remove closing code blocks
        .replace(/^\*\*.*?\*\*/g, '') // Remove bold markdown
        .trim();

      if (cleanText.toLowerCase().includes('no text found') || cleanText.length === 0) {
        throw new Error('No readable text found in the document');
      }

      const processingTime = Date.now() - startTime;

      return {
        text: cleanText,
        confidence: 0.95, // Mistral OCR is highly accurate
        processing_time_ms: processingTime
      };

    } catch (error) {
      console.error('Mistral OCR error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('401')) {
          throw new Error('Invalid Mistral API key');
        }
        if (error.message.includes('429')) {
          throw new Error('Mistral API rate limit exceeded');
        }
        if (error.message.includes('413')) {
          throw new Error('Document too large for Mistral OCR');
        }
      }
      
      throw new Error(`Mistral OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async analyzeDocument(text: string): Promise<AIAnalysisResult> {
    // Mistral OCR primarily handles OCR, but can do basic analysis
    // For full analysis, we'll delegate to Claude or use a simple approach
    
    if (!this.apiKey) {
      throw new Error('Mistral API key is required');
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          messages: [
            {
              role: 'system',
              content: 'You are an expert document analyzer. Analyze documents and return structured data in JSON format only. No explanations, just valid JSON.'
            },
            {
              role: 'user',
              content: `Analyze this document and return ONLY valid JSON with this structure:
{
  "document_type": "passport" | "visa" | "financial" | "personal" | "contract" | "other",
  "confidence": 0.85,
  "suggested_form": "visa_application" | "financial_declaration" | "personal_information",
  "extracted_data": {
    "full_name": "",
    "date_of_birth": "",
    "nationality": "",
    "passport_number": "",
    "account_number": "",
    "bank_name": "",
    "balance": "",
    "address": "",
    "phone": "",
    "email": "",
    "occupation": ""
  }
}

Document text:
${text.substring(0, 3000)}`
            }
          ],
          temperature: 0.1,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        throw new Error(`Mistral API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No analysis content returned from Mistral');
      }

      // Parse the JSON response
      let parsedResult;
      try {
        // Clean the response and parse JSON
        const cleanContent = content.trim()
          .replace(/^```json\n?/, '')
          .replace(/\n?```$/, '')
          .trim();
        
        parsedResult = JSON.parse(cleanContent);
      } catch (parseError) {
        console.error('Failed to parse Mistral response:', content);
        throw new Error('Invalid JSON response from Mistral');
      }

      // Validate and normalize the result
      return {
        document_type: parsedResult.document_type || 'other',
        confidence: Math.max(0, Math.min(1, parsedResult.confidence || 0.5)),
        suggested_form: parsedResult.suggested_form || 'personal_information',
        extracted_data: parsedResult.extracted_data || {}
      };

    } catch (error) {
      console.error('Mistral analysis error:', error);
      throw new Error(`Mistral analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}