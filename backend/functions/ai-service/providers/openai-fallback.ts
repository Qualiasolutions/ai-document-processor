/**
 * OpenAI Fallback Provider
 * Simplified OpenAI implementation for fallback scenarios
 * Maintains compatibility while reducing complexity
 */

import { AIProvider, OCRResult, AIAnalysisResult } from '../index.ts';

export class OpenAIProvider implements AIProvider {
  public readonly name = 'openai-fallback';
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.openai.com/v1';

  constructor() {
    this.apiKey = Deno.env.get('OPENAI_API_KEY') || '';
    if (!this.apiKey) {
      console.warn('OPENAI_API_KEY not found in environment variables');
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
      throw new Error('OpenAI API key is required');
    }

    const startTime = Date.now();

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'Extract text from images accurately. Return only the extracted text with no additional formatting or explanations.'
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract ALL text from this image. Return ONLY the extracted text, no explanations or formatting.'
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
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      const extractedText = data.choices?.[0]?.message?.content;

      if (!extractedText) {
        throw new Error('No text content returned from OpenAI');
      }

      const cleanText = extractedText.trim();

      if (cleanText.toLowerCase().includes('no text found') || cleanText.length === 0) {
        throw new Error('No readable text found in the image');
      }

      const processingTime = Date.now() - startTime;

      return {
        text: cleanText,
        confidence: 0.88, // OpenAI OCR is good but not the best
        processing_time_ms: processingTime
      };

    } catch (error) {
      console.error('OpenAI OCR error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('401')) {
          throw new Error('Invalid OpenAI API key');
        }
        if (error.message.includes('429')) {
          throw new Error('OpenAI API rate limit exceeded');
        }
      }
      
      throw new Error(`OpenAI OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async analyzeDocument(text: string): Promise<AIAnalysisResult> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are an expert document analyzer. Extract information accurately and respond with ONLY valid JSON. No explanations, no markdown, no code blocks. Just pure, parseable JSON with proper syntax.'
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
        const errorData = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No analysis content returned from OpenAI');
      }

      // Parse JSON with basic error handling
      let parsedResult;
      try {
        // Try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : content.trim();
        
        // Basic JSON cleanup
        const cleanedJson = jsonString
          .replace(/,\s*}/g, '}')  // Remove trailing commas
          .replace(/,\s*]/g, ']'); // Remove trailing commas in arrays
        
        parsedResult = JSON.parse(cleanedJson);
      } catch (parseError) {
        console.error('Failed to parse OpenAI response:', content);
        throw new Error('Invalid JSON response from OpenAI');
      }

      // Validate and normalize the result
      return {
        document_type: parsedResult.document_type || 'other',
        confidence: Math.max(0, Math.min(1, parsedResult.confidence || 0.5)),
        suggested_form: parsedResult.suggested_form || 'personal_information',
        extracted_data: this.cleanExtractedData(parsedResult.extracted_data || {})
      };

    } catch (error) {
      console.error('OpenAI analysis error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('401')) {
          throw new Error('Invalid OpenAI API key');
        }
        if (error.message.includes('429')) {
          throw new Error('OpenAI API rate limit exceeded');
        }
      }
      
      throw new Error(`OpenAI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private cleanExtractedData(data: any): Record<string, any> {
    if (typeof data !== 'object' || data === null) {
      return {};
    }

    const cleaned: Record<string, any> = {};
    
    Object.entries(data).forEach(([key, value]) => {
      if (key && value !== null && value !== undefined) {
        cleaned[key] = String(value).trim();
      }
    });
    
    return cleaned;
  }
}