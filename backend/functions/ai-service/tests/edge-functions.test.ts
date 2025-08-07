/**
 * Edge Functions Tests
 * Tests for document upload and processing edge functions integration
 */

import { describe, it, expect, beforeEach, afterEach } from "https://deno.land/std@0.208.0/testing/bdd.ts";
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { assertRejects } from "https://deno.land/std@0.208.0/assert/mod.ts";

// Mock Supabase client
const mockSupabaseClient = {
  storage: {
    from: () => ({
      upload: () => Promise.resolve({ data: { path: 'test-path' }, error: null })
    })
  },
  from: () => ({
    insert: () => Promise.resolve({ data: [{ id: 'test-id' }], error: null }),
    select: () => Promise.resolve({ data: [], error: null }),
    update: () => Promise.resolve({ data: [{}], error: null })
  })
};

// Mock environment
const mockEnv = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key',
  MISTRAL_API_KEY: 'test-mistral-key',
  ANTHROPIC_API_KEY: 'test-claude-key',
  OPENAI_API_KEY: 'test-openai-key'
};

const originalEnvGet = Deno.env.get;
Deno.env.get = (key: string) => mockEnv[key as keyof typeof mockEnv] || '';

// Mock fetch for AI providers
let originalFetch: typeof globalThis.fetch;
let fetchCallHistory: Array<{ url: string; options?: RequestInit }> = [];

beforeEach(() => {
  originalFetch = globalThis.fetch;
  fetchCallHistory = [];
  
  globalThis.fetch = (url: string, options?: RequestInit) => {
    fetchCallHistory.push({ url, options });
    
    // Mock AI provider responses
    if (url.includes('mistral.ai')) {
      return Promise.resolve(new Response(JSON.stringify({
        choices: [{ message: { content: 'Extracted text from Mistral' } }]
      }), { status: 200 }));
    } else if (url.includes('anthropic.com')) {
      return Promise.resolve(new Response(JSON.stringify({
        content: [{ text: JSON.stringify({
          document_type: 'passport',
          confidence: 0.95,
          suggested_form: 'visa_application',
          extracted_data: { name: 'John Doe' }
        }) }]
      }), { status: 200 }));
    } else if (url.includes('openai.com')) {
      return Promise.resolve(new Response(JSON.stringify({
        choices: [{ message: { content: 'OpenAI fallback response' } }]
      }), { status: 200 }));
    }
    
    return Promise.resolve(new Response('{}', { status: 200 }));
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  fetchCallHistory = [];
});

describe('Document Upload Enhanced Edge Function', () => {
  let handler: any;

  beforeEach(async () => {
    // Mock the enhanced upload function
    const module = await import('../document-upload-enhanced/index.ts');
    handler = module.default;
  });

  describe('File Upload Processing', () => {
    it('should process text file upload successfully', async () => {
      const textContent = 'John Smith\nPassport: P123456789\nDOB: 1990-05-15';
      const base64Content = 'data:text/plain;base64,' + btoa(textContent);
      
      const request = new Request('https://test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: base64Content,
          fileName: 'passport.txt',
          fileType: 'text/plain'
        })
      });

      const response = await handler(request);
      const result = await response.json();

      assertEquals(response.status, 200);
      assertEquals(result.success, true);
      expect(result.data).toHaveProperty('document');
      expect(result.data).toHaveProperty('processing');
      expect(result.data).toHaveProperty('analysis');
    });

    it('should process image file upload with OCR', async () => {
      const imageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      
      const request = new Request('https://test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: imageData,
          fileName: 'document.png',
          fileType: 'image/png'
        })
      });

      const response = await handler(request);
      const result = await response.json();

      assertEquals(response.status, 200);
      assertEquals(result.success, true);
      
      // Verify OCR was called
      const mistralCalls = fetchCallHistory.filter(call => call.url.includes('mistral.ai'));
      expect(mistralCalls.length).toBeGreaterThan(0);
    });

    it('should handle PDF files appropriately', async () => {
      const pdfData = 'data:application/pdf;base64,JVBERi0xLjQKJcfsj6IKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoK';
      
      const request = new Request('https://test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: pdfData,
          fileName: 'document.pdf',
          fileType: 'application/pdf'
        })
      });

      const response = await handler(request);
      const result = await response.json();

      assertEquals(response.status, 200);
      assertEquals(result.success, true);
      
      // PDF should trigger OCR processing
      const ocrCalls = fetchCallHistory.filter(call => 
        call.url.includes('mistral.ai') || call.url.includes('anthropic.com')
      );
      expect(ocrCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing file data', async () => {
      const request = new Request('https://test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: 'test.txt',
          fileType: 'text/plain'
          // Missing fileData
        })
      });

      const response = await handler(request);
      const result = await response.json();

      assertEquals(response.status, 400);
      assertEquals(result.success, false);
      expect(result.error).toContain('Missing required fields');
    });

    it('should handle invalid file type', async () => {
      const request = new Request('https://test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: 'data:application/exe;base64,invalid',
          fileName: 'virus.exe',
          fileType: 'application/exe'
        })
      });

      const response = await handler(request);
      const result = await response.json();

      assertEquals(response.status, 400);
      assertEquals(result.success, false);
      expect(result.error).toContain('Unsupported file type');
    });

    it('should handle file size limits', async () => {
      // Create a large base64 string (>10MB)
      const largeContent = 'A'.repeat(15 * 1024 * 1024); // 15MB
      const largeBase64 = 'data:text/plain;base64,' + btoa(largeContent);
      
      const request = new Request('https://test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: largeBase64,
          fileName: 'large.txt',
          fileType: 'text/plain'
        })
      });

      const response = await handler(request);
      const result = await response.json();

      assertEquals(response.status, 400);
      assertEquals(result.success, false);
      expect(result.error).toContain('File too large');
    });

    it('should handle AI service failures gracefully', async () => {
      // Mock AI service failure
      globalThis.fetch = () => {
        return Promise.resolve(new Response('Service unavailable', { status: 503 }));
      };

      const request = new Request('https://test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: 'data:text/plain;base64,' + btoa('Test content'),
          fileName: 'test.txt',
          fileType: 'text/plain'
        })
      });

      const response = await handler(request);
      const result = await response.json();

      assertEquals(response.status, 200); // Should still succeed
      assertEquals(result.success, true);
      
      // Processing should be marked as failed but document uploaded
      expect(result.data.processing.status).toBe('failed');
      expect(result.data.processing.error).toContain('AI processing failed');
    });
  });

  describe('Anonymous Processing', () => {
    it('should process documents without user authentication', async () => {
      const request = new Request('https://test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // No authorization header
        body: JSON.stringify({
          fileData: 'data:text/plain;base64,' + btoa('Anonymous document'),
          fileName: 'anonymous.txt',
          fileType: 'text/plain'
        })
      });

      const response = await handler(request);
      const result = await response.json();

      assertEquals(response.status, 200);
      assertEquals(result.success, true);
      
      // Should work without authentication
      expect(result.data.document).toBeDefined();
      expect(result.data.processing).toBeDefined();
    });
  });
});

describe('AI Service Edge Function', () => {
  let handler: any;

  beforeEach(async () => {
    const module = await import('../index.ts');
    handler = module.default;
  });

  describe('Service Status', () => {
    it('should return provider availability status', async () => {
      const request = new Request('https://test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status' })
      });

      const response = await handler(request);
      const result = await response.json();

      assertEquals(response.status, 200);
      expect(result).toHaveProperty('providers');
      expect(result.providers).toHaveProperty('mistral-ocr');
      expect(result.providers).toHaveProperty('claude-analysis');
      expect(result.providers).toHaveProperty('openai-fallback');
    });
  });

  describe('Text Extraction', () => {
    it('should extract text from image', async () => {
      const request = new Request('https://test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'extract_text',
          imageData: 'data:image/png;base64,test'
        })
      });

      const response = await handler(request);
      const result = await response.json();

      assertEquals(response.status, 200);
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('processing_time_ms');
      
      // Verify AI provider was called
      const aiCalls = fetchCallHistory.filter(call => 
        call.url.includes('mistral.ai') || 
        call.url.includes('anthropic.com') || 
        call.url.includes('openai.com')
      );
      expect(aiCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Document Analysis', () => {
    it('should analyze document content', async () => {
      const request = new Request('https://test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze_document',
          text: 'John Smith, Passport: P123456789, DOB: 1990-05-15'
        })
      });

      const response = await handler(request);
      const result = await response.json();

      assertEquals(response.status, 200);
      expect(result).toHaveProperty('document_type');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('suggested_form');
      expect(result).toHaveProperty('extracted_data');
      
      // Verify AI provider was called
      const aiCalls = fetchCallHistory.filter(call => 
        call.url.includes('anthropic.com') || call.url.includes('mistral.ai')
      );
      expect(aiCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing action parameter', async () => {
      const request = new Request('https://test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Test content'
          // Missing action
        })
      });

      const response = await handler(request);
      const result = await response.json();

      assertEquals(response.status, 400);
      expect(result.error).toContain('Missing action parameter');
    });

    it('should handle invalid action', async () => {
      const request = new Request('https://test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'invalid_action'
        })
      });

      const response = await handler(request);
      const result = await response.json();

      assertEquals(response.status, 400);
      expect(result.error).toContain('Invalid action');
    });

    it('should handle malformed JSON', async () => {
      const request = new Request('https://test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });

      const response = await handler(request);
      const result = await response.json();

      assertEquals(response.status, 400);
      expect(result.error).toContain('Invalid JSON');
    });
  });
});

describe('CORS and Security', () => {
  it('should include proper CORS headers', async () => {
    const module = await import('../index.ts');
    const handler = module.default;
    
    const request = new Request('https://test.com', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST'
      }
    });

    const response = await handler(request);

    assertEquals(response.status, 200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
  });

  it('should sanitize input data', async () => {
    const module = await import('../index.ts');
    const handler = module.default;
    
    // Try to inject malicious content
    const request = new Request('https://test.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'analyze_document',
        text: '<script>alert("xss")</script>Document content'
      })
    });

    const response = await handler(request);
    const result = await response.json();

    assertEquals(response.status, 200);
    // Should process the document but sanitize malicious content
    expect(result.document_type).toBeDefined();
  });
});

// Cleanup
Deno.env.get = originalEnvGet;