/**
 * OpenAI Fallback Provider Tests
 * Comprehensive unit tests for OpenAI fallback functionality
 */

import { describe, it, expect, beforeEach, afterEach } from "https://deno.land/std@0.208.0/testing/bdd.ts";
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { assertRejects } from "https://deno.land/std@0.208.0/assert/mod.ts";

// Mock fetch for testing
let originalFetch: typeof globalThis.fetch;
let mockFetch: any;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  mockFetch = (url: string, options?: RequestInit) => {
    return Promise.resolve(new Response('{}', { status: 200 }));
  };
  globalThis.fetch = mockFetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// Mock environment
const mockEnv = {
  OPENAI_API_KEY: 'sk-test-openai-key-789'
};

const originalEnvGet = Deno.env.get;
Deno.env.get = (key: string) => mockEnv[key as keyof typeof mockEnv] || '';

describe('OpenAIFallbackProvider', () => {
  let provider: any;

  beforeEach(async () => {
    const module = await import('../../providers/openai-fallback.ts');
    provider = new module.OpenAIFallbackProvider();
  });

  describe('constructor', () => {
    it('should initialize with correct name and model', () => {
      assertEquals(provider.name, 'openai-fallback');
    });

    it('should warn when API key is missing', async () => {
      Deno.env.get = () => '';
      const module = await import('../../providers/openai-fallback.ts');
      const providerWithoutKey = new module.OpenAIFallbackProvider();
      assertEquals(providerWithoutKey.name, 'openai-fallback');
    });
  });

  describe('isAvailable', () => {
    it('should return true when API key exists and API responds', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Test response' } }]
      };
      
      globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }));
      
      const available = await provider.isAvailable();
      assertEquals(available, true);
    });

    it('should return false when API key is missing', async () => {
      Deno.env.get = () => '';
      const module = await import('../../providers/openai-fallback.ts');
      const providerWithoutKey = new module.OpenAIFallbackProvider();
      
      const available = await providerWithoutKey.isAvailable();
      assertEquals(available, false);
    });

    it('should return false when API request fails', async () => {
      globalThis.fetch = () => Promise.resolve(new Response('Unauthorized', { status: 401 }));
      
      const available = await provider.isAvailable();
      assertEquals(available, false);
    });

    it('should handle network errors gracefully', async () => {
      globalThis.fetch = () => Promise.reject(new Error('Network error'));
      
      const available = await provider.isAvailable();
      assertEquals(available, false);
    });
  });

  describe('extractTextFromImage', () => {
    const testImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    
    it('should successfully extract text from image', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Extracted text from document using OpenAI vision'
          }
        }]
      };
      
      globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }));
      
      const result = await provider.extractTextFromImage(testImageData);
      
      assertEquals(result.text, 'Extracted text from document using OpenAI vision');
      assertEquals(result.confidence, 0.90);
      assertEquals(typeof result.processing_time_ms, 'number');
    });

    it('should handle base64 data URL properly', async () => {
      let capturedRequest: any = null;
      
      globalThis.fetch = (url: string, options?: RequestInit) => {
        capturedRequest = { url, options };
        return Promise.resolve(new Response(JSON.stringify({
          choices: [{ message: { content: 'Test text' } }]
        }), { status: 200 }));
      };
      
      await provider.extractTextFromImage(testImageData);
      
      const body = JSON.parse(capturedRequest.options.body);
      const imageContent = body.messages[0].content.find((c: any) => c.type === 'image_url');
      
      assertEquals(imageContent.image_url.url, testImageData);
    });

    it('should make correct API request', async () => {
      let capturedRequest: any = null;
      
      globalThis.fetch = (url: string, options?: RequestInit) => {
        capturedRequest = { url, options };
        return Promise.resolve(new Response(JSON.stringify({
          choices: [{ message: { content: 'Test text' } }]
        }), { status: 200 }));
      };
      
      await provider.extractTextFromImage(testImageData);
      
      assertEquals(capturedRequest.url, 'https://api.openai.com/v1/chat/completions');
      assertEquals(capturedRequest.options.method, 'POST');
      assertEquals(capturedRequest.options.headers['Authorization'], 'Bearer sk-test-openai-key-789');
      
      const body = JSON.parse(capturedRequest.options.body);
      assertEquals(body.model, 'gpt-4o');
      assertEquals(body.max_tokens, 4000);
    });

    it('should throw error when API key is missing', async () => {
      Deno.env.get = () => '';
      const module = await import('../../providers/openai-fallback.ts');
      const providerWithoutKey = new module.OpenAIFallbackProvider();
      
      await assertRejects(
        () => providerWithoutKey.extractTextFromImage(testImageData),
        Error,
        'OpenAI API key is required'
      );
    });

    it('should handle HTTP errors properly', async () => {
      globalThis.fetch = () => Promise.resolve(new Response('Unauthorized', { status: 401 }));
      
      await assertRejects(
        () => provider.extractTextFromImage(testImageData),
        Error,
        'Invalid OpenAI API key'
      );
    });

    it('should handle rate limiting errors', async () => {
      globalThis.fetch = () => Promise.resolve(new Response('Rate limit exceeded', { status: 429 }));
      
      await assertRejects(
        () => provider.extractTextFromImage(testImageData),
        Error,
        'OpenAI API rate limit exceeded'
      );
    });

    it('should handle empty response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: null
          }
        }]
      };
      
      globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }));
      
      await assertRejects(
        () => provider.extractTextFromImage(testImageData),
        Error,
        'No text content returned from OpenAI'
      );
    });

    it('should handle "no text found" response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'No text found in this image'
          }
        }]
      };
      
      globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }));
      
      await assertRejects(
        () => provider.extractTextFromImage(testImageData),
        Error,
        'No readable text found in the document'
      );
    });
  });

  describe('analyzeDocument', () => {
    const testText = 'John Smith, Passport: P123456789, Date of Birth: May 15, 1990, Nationality: USA';
    
    it('should successfully analyze document', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              document_type: 'passport',
              confidence: 0.88,
              suggested_form: 'visa_application',
              extracted_data: {
                full_name: 'John Smith',
                passport_number: 'P123456789',
                date_of_birth: '1990-05-15',
                nationality: 'USA'
              }
            })
          }
        }]
      };
      
      globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }));
      
      const result = await provider.analyzeDocument(testText);
      
      assertEquals(result.document_type, 'passport');
      assertEquals(result.confidence, 0.88);
      assertEquals(result.suggested_form, 'visa_application');
      assertEquals(result.extracted_data.full_name, 'John Smith');
      assertEquals(result.extracted_data.passport_number, 'P123456789');
    });

    it('should clean JSON from markdown formatting', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '```json\n{"document_type": "passport", "confidence": 0.85, "suggested_form": "visa_application", "extracted_data": {}}\n```'
          }
        }]
      };
      
      globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }));
      
      const result = await provider.analyzeDocument(testText);
      assertEquals(result.document_type, 'passport');
      assertEquals(result.confidence, 0.85);
    });

    it('should handle JSON extraction from mixed content', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Based on the document content, here is the analysis:\n\n{"document_type": "financial", "confidence": 0.82, "suggested_form": "financial_declaration", "extracted_data": {"bank_name": "Test Bank"}}\n\nThis appears to be a bank statement with financial information.'
          }
        }]
      };
      
      globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }));
      
      const result = await provider.analyzeDocument(testText);
      assertEquals(result.document_type, 'financial');
      assertEquals(result.extracted_data.bank_name, 'Test Bank');
    });

    it('should validate and normalize response data', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              document_type: 'contract',
              confidence: 1.3, // Invalid (>1)
              // Missing suggested_form
              extracted_data: {
                full_name: 'John Doe',
                date: '2024-01-01'
              }
            })
          }
        }]
      };
      
      globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }));
      
      const result = await provider.analyzeDocument(testText);
      
      assertEquals(result.document_type, 'contract');
      assertEquals(result.confidence, 1.0); // Clamped
      assertEquals(result.suggested_form, 'personal_information'); // Default
      assertEquals(result.extracted_data.full_name, 'John Doe');
    });

    it('should clean extracted data properly', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              document_type: 'personal',
              confidence: 0.8,
              suggested_form: 'personal_information',
              extracted_data: {
                full_name: '  John Smith  ', // With spaces
                empty_field: '',
                null_field: null,
                undefined_field: undefined,
                valid_field: 'Valid Data'
              }
            })
          }
        }]
      };
      
      globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }));
      
      const result = await provider.analyzeDocument(testText);
      
      assertEquals(result.extracted_data.full_name, 'John Smith'); // Trimmed
      assertEquals(result.extracted_data.valid_field, 'Valid Data');
      // null/undefined fields should be excluded
      assertEquals('null_field' in result.extracted_data, false);
      assertEquals('undefined_field' in result.extracted_data, false);
    });

    it('should handle large text input by truncating', async () => {
      const longText = 'A'.repeat(5000); // Very long text
      let capturedRequest: any = null;
      
      globalThis.fetch = (url: string, options?: RequestInit) => {
        capturedRequest = { url, options };
        return Promise.resolve(new Response(JSON.stringify({
          choices: [{ message: { content: '{"document_type": "other", "confidence": 0.5, "suggested_form": "personal_information", "extracted_data": {}}' } }]
        }), { status: 200 }));
      };
      
      await provider.analyzeDocument(longText);
      
      const body = JSON.parse(capturedRequest.options.body);
      const messageContent = body.messages[0].content;
      
      // Should be truncated but still contain the prompt
      expect(messageContent.length).toBeLessThan(5000);
      expect(messageContent).toContain('Document text (first 4000 characters)');
    });

    it('should make correct API request structure', async () => {
      let capturedRequest: any = null;
      
      globalThis.fetch = (url: string, options?: RequestInit) => {
        capturedRequest = { url, options };
        return Promise.resolve(new Response(JSON.stringify({
          choices: [{ message: { content: '{"document_type": "other", "confidence": 0.5, "suggested_form": "personal_information", "extracted_data": {}}' } }]
        }), { status: 200 }));
      };
      
      await provider.analyzeDocument(testText);
      
      const body = JSON.parse(capturedRequest.options.body);
      
      assertEquals(body.model, 'gpt-3.5-turbo');
      assertEquals(body.max_tokens, 2000);
      assertEquals(body.temperature, 0.1);
      assertEquals(body.messages.length, 1);
      assertEquals(body.messages[0].role, 'user');
      expect(body.messages[0].content).toContain('Return ONLY valid JSON');
    });

    it('should handle invalid JSON response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'This is not valid JSON at all'
          }
        }]
      };
      
      globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }));
      
      await assertRejects(
        () => provider.analyzeDocument(testText),
        Error,
        'No valid JSON found in OpenAI response'
      );
    });

    it('should handle API errors properly', async () => {
      globalThis.fetch = () => Promise.resolve(new Response('Server error', { status: 500 }));
      
      await assertRejects(
        () => provider.analyzeDocument(testText),
        Error,
        'OpenAI analysis failed'
      );
    });

    it('should handle authentication errors', async () => {
      globalThis.fetch = () => Promise.resolve(new Response('Unauthorized', { status: 401 }));
      
      await assertRejects(
        () => provider.analyzeDocument(testText),
        Error,
        'Invalid OpenAI API key'
      );
    });

    it('should handle rate limiting errors', async () => {
      globalThis.fetch = () => Promise.resolve(new Response('Too many requests', { status: 429 }));
      
      await assertRejects(
        () => provider.analyzeDocument(testText),
        Error,
        'OpenAI API rate limit exceeded'
      );
    });
  });
});

// Cleanup
Deno.env.get = originalEnvGet;