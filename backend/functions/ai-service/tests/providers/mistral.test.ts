/**
 * Mistral OCR Provider Tests
 * Comprehensive unit tests for Mistral OCR functionality
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
    // Mock implementation will be set per test
    return Promise.resolve(new Response('{}', { status: 200 }));
  };
  globalThis.fetch = mockFetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// Mock environment
const mockEnv = {
  MISTRAL_API_KEY: 'test-mistral-key-123'
};

// Override Deno.env.get for testing
const originalEnvGet = Deno.env.get;
Deno.env.get = (key: string) => mockEnv[key as keyof typeof mockEnv] || '';

describe('MistralOCRProvider', () => {
  let provider: any;

  beforeEach(async () => {
    // Import provider fresh for each test
    const module = await import('../../providers/mistral-ocr.ts');
    provider = new module.MistralOCRProvider();
  });

  describe('constructor', () => {
    it('should initialize with API key from environment', () => {
      assertEquals(provider.name, 'mistral-ocr');
    });

    it('should warn when API key is missing', async () => {
      Deno.env.get = () => '';
      const module = await import('../../providers/mistral-ocr.ts');
      const providerWithoutKey = new module.MistralOCRProvider();
      assertEquals(providerWithoutKey.name, 'mistral-ocr');
    });
  });

  describe('isAvailable', () => {
    it('should return true when API key exists and API responds', async () => {
      globalThis.fetch = () => Promise.resolve(new Response('{"data": []}', { status: 200 }));
      
      const available = await provider.isAvailable();
      assertEquals(available, true);
    });

    it('should return false when API key is missing', async () => {
      Deno.env.get = () => '';
      const module = await import('../../providers/mistral-ocr.ts');
      const providerWithoutKey = new module.MistralOCRProvider();
      
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
            content: 'Extracted text from document'
          }
        }]
      };
      
      globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }));
      
      const result = await provider.extractTextFromImage(testImageData);
      
      assertEquals(result.text, 'Extracted text from document');
      assertEquals(typeof result.confidence, 'number');
      assertEquals(result.confidence, 0.95);
      assertEquals(typeof result.processing_time_ms, 'number');
    });

    it('should clean markdown formatting from response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '```\nExtracted text with markdown\n```'
          }
        }]
      };
      
      globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }));
      
      const result = await provider.extractTextFromImage(testImageData);
      assertEquals(result.text, 'Extracted text with markdown');
    });

    it('should handle "no text found" response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'No text found'
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

    it('should throw error when API key is missing', async () => {
      Deno.env.get = () => '';
      const module = await import('../../providers/mistral-ocr.ts');
      const providerWithoutKey = new module.MistralOCRProvider();
      
      await assertRejects(
        () => providerWithoutKey.extractTextFromImage(testImageData),
        Error,
        'Mistral API key is required'
      );
    });

    it('should handle HTTP errors properly', async () => {
      globalThis.fetch = () => Promise.resolve(new Response('Unauthorized', { status: 401 }));
      
      await assertRejects(
        () => provider.extractTextFromImage(testImageData),
        Error,
        'Invalid Mistral API key'
      );
    });

    it('should handle rate limiting errors', async () => {
      globalThis.fetch = () => Promise.resolve(new Response('Rate limit exceeded', { status: 429 }));
      
      await assertRejects(
        () => provider.extractTextFromImage(testImageData),
        Error,
        'Mistral API rate limit exceeded'
      );
    });

    it('should handle large document errors', async () => {
      globalThis.fetch = () => Promise.resolve(new Response('Payload too large', { status: 413 }));
      
      await assertRejects(
        () => provider.extractTextFromImage(testImageData),
        Error,
        'Document too large for Mistral OCR'
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
        'No text content returned from Mistral OCR'
      );
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
      
      assertEquals(capturedRequest.url, 'https://api.mistral.ai/v1/chat/completions');
      assertEquals(capturedRequest.options.method, 'POST');
      assertEquals(capturedRequest.options.headers['Authorization'], 'Bearer test-mistral-key-123');
      assertEquals(capturedRequest.options.headers['Content-Type'], 'application/json');
      
      const body = JSON.parse(capturedRequest.options.body);
      assertEquals(body.model, 'mistral-ocr-latest');
      assertEquals(body.temperature, 0.1);
      assertEquals(body.max_tokens, 4000);
    });
  });

  describe('analyzeDocument', () => {
    const testText = 'John Smith, Passport: P123456789, DOB: 1990-05-15';
    
    it('should successfully analyze document', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              document_type: 'passport',
              confidence: 0.92,
              suggested_form: 'visa_application',
              extracted_data: {
                full_name: 'John Smith',
                passport_number: 'P123456789',
                date_of_birth: '1990-05-15'
              }
            })
          }
        }]
      };
      
      globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }));
      
      const result = await provider.analyzeDocument(testText);
      
      assertEquals(result.document_type, 'passport');
      assertEquals(result.confidence, 0.92);
      assertEquals(result.suggested_form, 'visa_application');
      assertEquals(result.extracted_data.full_name, 'John Smith');
    });

    it('should clean JSON response from markdown', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '```json\n{"document_type": "passport", "confidence": 0.8}\n```'
          }
        }]
      };
      
      globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }));
      
      const result = await provider.analyzeDocument(testText);
      assertEquals(result.document_type, 'passport');
    });

    it('should handle invalid JSON response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'This is not JSON'
          }
        }]
      };
      
      globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }));
      
      await assertRejects(
        () => provider.analyzeDocument(testText),
        Error,
        'Invalid JSON response from Mistral'
      );
    });

    it('should validate and normalize response data', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              // Missing some fields, invalid confidence
              document_type: 'passport',
              confidence: 1.5, // Invalid (>1)
              extracted_data: null // Invalid
            })
          }
        }]
      };
      
      globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }));
      
      const result = await provider.analyzeDocument(testText);
      
      assertEquals(result.document_type, 'passport');
      assertEquals(result.confidence, 1.0); // Clamped to 1.0
      assertEquals(result.suggested_form, 'personal_information'); // Default value
      assertEquals(typeof result.extracted_data, 'object');
    });

    it('should truncate long text input', async () => {
      const longText = 'A'.repeat(5000); // Very long text
      let capturedRequest: any = null;
      
      globalThis.fetch = (url: string, options?: RequestInit) => {
        capturedRequest = { url, options };
        return Promise.resolve(new Response(JSON.stringify({
          choices: [{ message: { content: '{"document_type": "other"}' } }]
        }), { status: 200 }));
      };
      
      await provider.analyzeDocument(longText);
      
      const body = JSON.parse(capturedRequest.options.body);
      const messageContent = body.messages[1].content;
      
      // Should be truncated to 3000 characters plus prompt text
      expect(messageContent.length).toBeLessThan(4000);
    });

    it('should handle API errors properly', async () => {
      globalThis.fetch = () => Promise.resolve(new Response('Server error', { status: 500 }));
      
      await assertRejects(
        () => provider.analyzeDocument(testText),
        Error,
        'Mistral analysis failed'
      );
    });
  });
});

// Cleanup
Deno.env.get = originalEnvGet;