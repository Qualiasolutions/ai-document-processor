/**
 * Claude Analysis Provider
 * Implements document analysis using Anthropic's Claude 3.5 Sonnet
 * Better structured data extraction and more reliable JSON output
 */

import { AIProvider, OCRResult, AIAnalysisResult } from '../index.ts';

export class ClaudeAnalysisProvider implements AIProvider {
  public readonly name = 'claude-analysis';
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.anthropic.com/v1';
  private readonly model = 'claude-3-5-sonnet-20241022';

  constructor() {
    this.apiKey = Deno.env.get('ANTHROPIC_API_KEY') || '';
    if (!this.apiKey) {
      console.warn('ANTHROPIC_API_KEY not found in environment variables');
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    
    try {
      // Test with a simple request
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hello' }]
        })
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async extractTextFromImage(imageData: string): Promise<OCRResult> {
    // Claude has vision capabilities, but primarily used for analysis
    if (!this.apiKey) {
      throw new Error('Claude API key is required');
    }

    const startTime = Date.now();

    try {
      // Convert base64 data URL to proper format for Claude
      const base64Data = imageData.split(',')[1];
      const mimeType = imageData.split(';')[0].split(':')[1] || 'image/jpeg';

      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 4000,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract all text from this document image. Return only the extracted text with no additional formatting, explanations, or commentary. If there is no readable text, return "No text found".'
                },
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: mimeType,
                    data: base64Data
                  }
                }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Claude API error: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      const extractedText = data.content?.[0]?.text;

      if (!extractedText) {
        throw new Error('No text content returned from Claude');
      }

      const cleanText = extractedText.trim();

      if (cleanText.toLowerCase().includes('no text found') || cleanText.length === 0) {
        throw new Error('No readable text found in the document');
      }

      const processingTime = Date.now() - startTime;

      return {
        text: cleanText,
        confidence: 0.92, // Claude has good OCR accuracy
        processing_time_ms: processingTime
      };

    } catch (error) {
      console.error('Claude OCR error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('401')) {
          throw new Error('Invalid Claude API key');
        }
        if (error.message.includes('429')) {
          throw new Error('Claude API rate limit exceeded');
        }
      }
      
      throw new Error(`Claude OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async analyzeDocument(text: string): Promise<AIAnalysisResult> {
    if (!this.apiKey) {
      throw new Error('Claude API key is required');
    }

    try {
      // Claude is better at following structured instructions
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 2000,
          messages: [
            {
              role: 'user',
              content: `Analyze the following document text and extract structured information. Return ONLY valid JSON with no additional text, explanations, or markdown formatting.

Required JSON structure:
{
  "document_type": "passport" | "visa" | "financial" | "personal" | "contract" | "other",
  "confidence": 0.85,
  "suggested_form": "visa_application" | "financial_declaration" | "personal_information",
  "extracted_data": {
    "full_name": "string or empty string",
    "date_of_birth": "YYYY-MM-DD format or empty string",
    "nationality": "string or empty string",
    "passport_number": "string or empty string",
    "account_number": "string or empty string",
    "bank_name": "string or empty string",
    "balance": "string or empty string",
    "monthly_income": "string or empty string",
    "address": "string or empty string",
    "phone": "string or empty string",
    "email": "string or empty string",
    "occupation": "string or empty string"
  }
}

Rules:
- Include only fields that are clearly found in the document
- Use empty string "" for missing fields, never null
- Confidence must be between 0 and 1
- All dates in YYYY-MM-DD format
- No trailing commas
- Valid JSON only, no explanations

Document text (first 4000 characters):
${text.substring(0, 4000)}`
            }
          ],
          temperature: 0.1
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Claude API error: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      const content = data.content?.[0]?.text;

      if (!content) {
        throw new Error('No analysis content returned from Claude');
      }

      // Claude typically returns cleaner JSON, but let's still validate
      let parsedResult;
      try {
        // Clean any potential markdown or extra formatting
        const cleanContent = content.trim()
          .replace(/^```json\n?/, '')
          .replace(/\n?```$/, '')
          .replace(/^```\n?/, '')
          .replace(/\n?```$/, '')
          .trim();
        
        parsedResult = JSON.parse(cleanContent);
      } catch (parseError) {
        console.error('Failed to parse Claude response:', content);
        
        // Try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsedResult = JSON.parse(jsonMatch[0]);
          } catch {
            throw new Error('Invalid JSON response from Claude');
          }
        } else {
          throw new Error('No valid JSON found in Claude response');
        }
      }

      // Validate and normalize the result
      return {
        document_type: parsedResult.document_type || 'other',
        confidence: Math.max(0, Math.min(1, parsedResult.confidence || 0.5)),
        suggested_form: parsedResult.suggested_form || 'personal_information',
        extracted_data: this.cleanExtractedData(parsedResult.extracted_data || {})
      };

    } catch (error) {
      console.error('Claude analysis error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('401')) {
          throw new Error('Invalid Claude API key');
        }
        if (error.message.includes('429')) {
          throw new Error('Claude API rate limit exceeded');
        }
      }
      
      throw new Error(`Claude analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private cleanExtractedData(data: any): Record<string, any> {
    if (typeof data !== 'object' || data === null) {
      return {};
    }

    const cleaned: Record<string, any> = {};
    
    Object.entries(data).forEach(([key, value]) => {
      if (key && value !== null && value !== undefined) {
        // Convert all values to strings and trim whitespace
        cleaned[key] = String(value).trim();
      }
    });
    
    return cleaned;
  }
}