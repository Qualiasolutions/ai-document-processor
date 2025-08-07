/**
 * AI Service Integration Tests
 * Tests the main AI service orchestration, fallback logic, and retry mechanisms
 */

import { describe, it, expect, beforeEach, afterEach } from "https://deno.land/std@0.208.0/testing/bdd.ts";
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { assertRejects } from "https://deno.land/std@0.208.0/assert/mod.ts";

// Mock fetch for testing
let originalFetch: typeof globalThis.fetch;
let fetchCallHistory: Array<{ url: string; options?: RequestInit; response: Response }> = [];

beforeEach(() => {
  originalFetch = globalThis.fetch;
  fetchCallHistory = [];
  
  globalThis.fetch = (url: string, options?: RequestInit) => {
    const response = new Response('{}', { status: 200 });
    fetchCallHistory.push({ url, options, response });
    return Promise.resolve(response);
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  fetchCallHistory = [];
});

// Mock environment with all providers
const mockEnv = {
  MISTRAL_API_KEY: 'test-mistral-key',
  ANTHROPIC_API_KEY: 'test-claude-key',
  OPENAI_API_KEY: 'test-openai-key'
};

const originalEnvGet = Deno.env.get;
Deno.env.get = (key: string) => mockEnv[key as keyof typeof mockEnv] || '';

describe('AI Service Integration', () => {
  let aiService: any;

  beforeEach(async () => {
    // Import fresh AI service for each test
    const module = await import('../index.ts');
    aiService = module;
  });

  describe('Provider Initialization', () => {
    it('should initialize all available providers', async () => {
      const providers = await aiService.getAvailableProviders();
      
      // Should have all three providers when keys are available
      assertEquals(providers.length, 3);
      
      const providerNames = providers.map((p: any) => p.name);
      expect(providerNames).toContain('mistral-ocr');
      expect(providerNames).toContain('claude-analysis');
      expect(providerNames).toContain('openai-fallback');
    });

    it('should handle missing provider keys gracefully', async () => {
      // Remove one API key
      Deno.env.get = (key: string) => {
        if (key === 'MISTRAL_API_KEY') return '';
        return mockEnv[key as keyof typeof mockEnv] || '';
      };

      const module = await import('../index.ts');
      const providers = await module.getAvailableProviders();
      
      // Should have only 2 providers now
      assertEquals(providers.length, 2);
      
      const providerNames = providers.map((p: any) => p.name);
      expect(providerNames).not.toContain('mistral-ocr');
      expect(providerNames).toContain('claude-analysis');
      expect(providerNames).toContain('openai-fallback');
    });
  });

  describe('Provider Selection Strategy', () => {
    it('should select Mistral for OCR when available', async () => {
      // Mock successful Mistral response
      globalThis.fetch = (url: string, options?: RequestInit) => {
        fetchCallHistory.push({ url, options, response: new Response('', { status: 200 }) });
        
        if (url.includes('mistral.ai')) {
          return Promise.resolve(new Response(JSON.stringify({
            choices: [{ message: { content: 'Extracted text from Mistral' } }]
          }), { status: 200 }));
        }
        
        return Promise.resolve(new Response('{}', { status: 200 }));
      };

      const result = await aiService.extractTextFromImage('data:image/png;base64,test');
      
      assertEquals(result.text, 'Extracted text from Mistral');
      
      // Verify Mistral was called
      const mistralCalls = fetchCallHistory.filter(call => call.url.includes('mistral.ai'));
      assertEquals(mistralCalls.length, 1);
    });

    it('should select Claude for document analysis when available', async () => {
      // Mock successful Claude response
      globalThis.fetch = (url: string, options?: RequestInit) => {
        fetchCallHistory.push({ url, options, response: new Response('', { status: 200 }) });
        
        if (url.includes('anthropic.com')) {
          return Promise.resolve(new Response(JSON.stringify({
            content: [{ text: JSON.stringify({
              document_type: 'passport',
              confidence: 0.95,
              suggested_form: 'visa_application',
              extracted_data: { name: 'John Doe' }
            }) }]
          }), { status: 200 }));
        }
        
        return Promise.resolve(new Response('{}', { status: 200 }));
      };

      const result = await aiService.analyzeDocument('Test document text');
      
      assertEquals(result.document_type, 'passport');
      assertEquals(result.confidence, 0.95);
      
      // Verify Claude was called
      const claudeCalls = fetchCallHistory.filter(call => call.url.includes('anthropic.com'));
      assertEquals(claudeCalls.length, 1);
    });
  });

  describe('Fallback Logic', () => {
    it('should fallback to Claude when Mistral OCR fails', async () => {
      globalThis.fetch = (url: string, options?: RequestInit) => {
        fetchCallHistory.push({ url, options, response: new Response('', { status: 200 }) });
        
        if (url.includes('mistral.ai')) {
          // Mistral fails
          return Promise.resolve(new Response('Rate limit exceeded', { status: 429 }));
        } else if (url.includes('anthropic.com')) {
          // Claude succeeds
          return Promise.resolve(new Response(JSON.stringify({
            content: [{ text: 'Extracted text from Claude fallback' }]
          }), { status: 200 }));
        }
        
        return Promise.resolve(new Response('{}', { status: 200 }));
      };

      const result = await aiService.extractTextFromImage('data:image/png;base64,test');
      
      assertEquals(result.text, 'Extracted text from Claude fallback');
      
      // Verify both Mistral and Claude were called
      const mistralCalls = fetchCallHistory.filter(call => call.url.includes('mistral.ai'));
      const claudeCalls = fetchCallHistory.filter(call => call.url.includes('anthropic.com'));
      
      assertEquals(mistralCalls.length, 1);
      assertEquals(claudeCalls.length, 1);
    });

    it('should fallback to OpenAI when both Mistral and Claude fail', async () => {
      globalThis.fetch = (url: string, options?: RequestInit) => {
        fetchCallHistory.push({ url, options, response: new Response('', { status: 200 }) });
        
        if (url.includes('mistral.ai')) {
          return Promise.resolve(new Response('Service unavailable', { status: 503 }));
        } else if (url.includes('anthropic.com')) {
          return Promise.resolve(new Response('Server error', { status: 500 }));
        } else if (url.includes('openai.com')) {
          return Promise.resolve(new Response(JSON.stringify({
            choices: [{ message: { content: 'Extracted text from OpenAI fallback' } }]
          }), { status: 200 }));
        }
        
        return Promise.resolve(new Response('{}', { status: 200 }));
      };

      const result = await aiService.extractTextFromImage('data:image/png;base64,test');
      
      assertEquals(result.text, 'Extracted text from OpenAI fallback');
      
      // Verify all three providers were tried
      const mistralCalls = fetchCallHistory.filter(call => call.url.includes('mistral.ai'));
      const claudeCalls = fetchCallHistory.filter(call => call.url.includes('anthropic.com'));
      const openaiCalls = fetchCallHistory.filter(call => call.url.includes('openai.com'));
      
      assertEquals(mistralCalls.length, 1);
      assertEquals(claudeCalls.length, 1);
      assertEquals(openaiCalls.length, 1);
    });

    it('should fallback to Mistral when Claude analysis fails', async () => {
      globalThis.fetch = (url: string, options?: RequestInit) => {
        fetchCallHistory.push({ url, options, response: new Response('', { status: 200 }) });
        
        if (url.includes('anthropic.com')) {
          // Claude fails
          return Promise.resolve(new Response('Rate limit exceeded', { status: 429 }));
        } else if (url.includes('mistral.ai')) {
          // Mistral succeeds
          return Promise.resolve(new Response(JSON.stringify({
            choices: [{ message: { content: JSON.stringify({
              document_type: 'financial',
              confidence: 0.88,
              suggested_form: 'financial_declaration',
              extracted_data: { bank_name: 'Test Bank' }
            }) } }]
          }), { status: 200 }));
        }
        
        return Promise.resolve(new Response('{}', { status: 200 }));
      };

      const result = await aiService.analyzeDocument('Bank statement content');
      
      assertEquals(result.document_type, 'financial');
      assertEquals(result.confidence, 0.88);
      
      // Verify both Claude and Mistral were called
      const claudeCalls = fetchCallHistory.filter(call => call.url.includes('anthropic.com'));
      const mistralCalls = fetchCallHistory.filter(call => call.url.includes('mistral.ai'));
      
      assertEquals(claudeCalls.length, 1);
      assertEquals(mistralCalls.length, 1);
    });
  });

  describe('Retry Logic', () => {
    it('should retry on transient failures', async () => {
      let callCount = 0;
      
      globalThis.fetch = (url: string, options?: RequestInit) => {
        callCount++;
        fetchCallHistory.push({ url, options, response: new Response('', { status: 200 }) });
        
        if (url.includes('mistral.ai')) {
          if (callCount === 1) {
            // First call fails with temporary error
            return Promise.resolve(new Response('Temporary unavailable', { status: 503 }));
          } else {
            // Second call succeeds
            return Promise.resolve(new Response(JSON.stringify({
              choices: [{ message: { content: 'Success after retry' } }]
            }), { status: 200 }));
          }
        }
        
        return Promise.resolve(new Response('{}', { status: 200 }));
      };

      const result = await aiService.extractTextFromImage('data:image/png;base64,test');
      
      assertEquals(result.text, 'Success after retry');
      
      // Verify retry occurred
      const mistralCalls = fetchCallHistory.filter(call => call.url.includes('mistral.ai'));
      assertEquals(mistralCalls.length, 2);
    });

    it('should not retry on permanent failures', async () => {
      globalThis.fetch = (url: string, options?: RequestInit) => {
        fetchCallHistory.push({ url, options, response: new Response('', { status: 200 }) });
        
        if (url.includes('mistral.ai')) {
          // Permanent failure (401 unauthorized)
          return Promise.resolve(new Response('Invalid API key', { status: 401 }));
        } else if (url.includes('anthropic.com')) {
          // Claude succeeds as fallback
          return Promise.resolve(new Response(JSON.stringify({
            content: [{ text: 'Fallback after permanent failure' }]
          }), { status: 200 }));
        }
        
        return Promise.resolve(new Response('{}', { status: 200 }));
      };

      const result = await aiService.extractTextFromImage('data:image/png;base64,test');
      
      assertEquals(result.text, 'Fallback after permanent failure');
      
      // Verify no retry for permanent failure
      const mistralCalls = fetchCallHistory.filter(call => call.url.includes('mistral.ai'));
      const claudeCalls = fetchCallHistory.filter(call => call.url.includes('anthropic.com'));
      
      assertEquals(mistralCalls.length, 1); // No retry
      assertEquals(claudeCalls.length, 1); // Fallback called
    });
  });

  describe('Error Handling', () => {
    it('should throw error when all providers fail', async () => {
      globalThis.fetch = () => {
        return Promise.resolve(new Response('All services unavailable', { status: 503 }));
      };

      await assertRejects(
        () => aiService.extractTextFromImage('data:image/png;base64,test'),
        Error,
        'All AI providers failed'
      );
    });

    it('should handle network errors gracefully', async () => {
      globalThis.fetch = () => {
        return Promise.reject(new Error('Network connection failed'));
      };

      await assertRejects(
        () => aiService.analyzeDocument('Test document'),
        Error,
        'All AI providers failed'
      );
    });

    it('should validate input data', async () => {
      await assertRejects(
        () => aiService.extractTextFromImage('invalid-image-data'),
        Error,
        'Invalid image data format'
      );

      await assertRejects(
        () => aiService.analyzeDocument(''),
        Error,
        'Document text cannot be empty'
      );
    });
  });

  describe('Performance Optimization', () => {
    it('should cache provider availability status', async () => {
      let availabilityCheckCount = 0;
      
      globalThis.fetch = (url: string, options?: RequestInit) => {
        // Count availability checks (simple requests)
        if (options?.method === 'POST' && 
            JSON.parse(options.body as string || '{}').messages?.length === 1) {
          availabilityCheckCount++;
        }
        
        return Promise.resolve(new Response(JSON.stringify({
          choices: [{ message: { content: 'Test response' } }]
        }), { status: 200 }));
      };

      // Make multiple requests
      await aiService.extractTextFromImage('data:image/png;base64,test1');
      await aiService.extractTextFromImage('data:image/png;base64,test2');
      
      // Availability should be cached, not checked multiple times
      expect(availabilityCheckCount).toBeLessThanOrEqual(3); // Once per provider initially
    });

    it('should handle concurrent requests efficiently', async () => {
      globalThis.fetch = () => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(new Response(JSON.stringify({
              choices: [{ message: { content: 'Concurrent response' } }]
            }), { status: 200 }));
          }, 100); // Simulate network delay
        });
      };

      const startTime = Date.now();
      
      // Make concurrent requests
      const promises = [
        aiService.extractTextFromImage('data:image/png;base64,test1'),
        aiService.extractTextFromImage('data:image/png;base64,test2'),
        aiService.extractTextFromImage('data:image/png;base64,test3')
      ];
      
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      // All should complete
      assertEquals(results.length, 3);
      results.forEach(result => {
        assertEquals(result.text, 'Concurrent response');
      });
      
      // Should take roughly the same time as a single request (concurrent)
      expect(duration).toBeLessThan(200); // Less than 2x single request time
    });
  });

  describe('Provider Health Monitoring', () => {
    it('should report provider health status', async () => {
      globalThis.fetch = (url: string, options?: RequestInit) => {
        if (url.includes('mistral.ai')) {
          return Promise.resolve(new Response('OK', { status: 200 }));
        } else if (url.includes('anthropic.com')) {
          return Promise.resolve(new Response('Service unavailable', { status: 503 }));
        } else if (url.includes('openai.com')) {
          return Promise.resolve(new Response('OK', { status: 200 }));
        }
        
        return Promise.resolve(new Response('{}', { status: 200 }));
      };

      const healthStatus = await aiService.getProviderHealth();
      
      expect(healthStatus).toHaveProperty('mistral-ocr');
      expect(healthStatus).toHaveProperty('claude-analysis');
      expect(healthStatus).toHaveProperty('openai-fallback');
      
      assertEquals(healthStatus['mistral-ocr'].available, true);
      assertEquals(healthStatus['claude-analysis'].available, false);
      assertEquals(healthStatus['openai-fallback'].available, true);
    });
  });
});

// Cleanup
Deno.env.get = originalEnvGet;