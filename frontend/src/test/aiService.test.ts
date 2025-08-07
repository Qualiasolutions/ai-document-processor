import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { aiService } from '@/lib/aiService'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('AI Service Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Set up environment variables
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
  })
  
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('uploadAndProcessDocument', () => {
    it('should successfully upload and process a text document', async () => {
      const mockResponse = {
        success: true,
        data: {
          document: {
            id: 'doc-123',
            filename: 'test.txt',
            status: 'completed'
          },
          processing: {
            status: 'completed',
            content_length: 100
          },
          analysis: {
            document_type: 'passport',
            confidence: 0.95,
            suggested_form: 'visa_application',
            extracted_data: {
              full_name: 'John Smith',
              passport_number: 'P123456789'
            }
          }
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const file = new File(['John Smith\nPassport: P123456789'], 'test.txt', { type: 'text/plain' })
      const result = await aiService.uploadAndProcessDocument(file)

      expect(result).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.supabase.co/functions/v1/document-upload-enhanced',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('fileData')
        })
      )
    })

    it('should handle image files with base64 conversion', async () => {
      const mockResponse = {
        success: true,
        data: {
          document: { id: 'doc-456' },
          processing: { status: 'completed' },
          analysis: { document_type: 'other' }
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      // Create a mock image file
      const imageContent = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]) // PNG header
      const file = new File([imageContent], 'test.png', { type: 'image/png' })

      const result = await aiService.uploadAndProcessDocument(file)

      expect(result).toEqual(mockResponse)
      
      const callArgs = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(callArgs[1].body)
      
      expect(requestBody.fileName).toBe('test.png')
      expect(requestBody.fileType).toBe('image/png')
      expect(requestBody.fileData).toMatch(/^data:image\/png;base64,/)
    })

    it('should handle file size validation', async () => {
      // Create a file larger than 10MB
      const largeContent = new Array(11 * 1024 * 1024).fill('A').join('')
      const file = new File([largeContent], 'large.txt', { type: 'text/plain' })

      await expect(aiService.uploadAndProcessDocument(file)).rejects.toThrow('File too large')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should handle unsupported file types', async () => {
      const file = new File(['executable'], 'virus.exe', { type: 'application/exe' })

      await expect(aiService.uploadAndProcessDocument(file)).rejects.toThrow('Unsupported file type')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error')
      })

      const file = new file(['test'], 'test.txt', { type: 'text/plain' })

      await expect(aiService.uploadAndProcessDocument(file)).rejects.toThrow('Upload failed: Internal Server Error')
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const file = new File(['test'], 'test.txt', { type: 'text/plain' })

      await expect(aiService.uploadAndProcessDocument(file)).rejects.toThrow('Network error')
    })
  })

  describe('getServiceStatus', () => {
    it('should fetch service status successfully', async () => {
      const mockStatus = {
        providers: {
          'mistral-ocr': { available: true, response_time: 120 },
          'claude-analysis': { available: true, response_time: 200 },
          'openai-fallback': { available: false, error: 'Rate limit' }
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStatus)
      })

      const result = await aiService.getServiceStatus()

      expect(result).toEqual(mockStatus)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.supabase.co/functions/v1/ai-service',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'status' })
        }
      )
    })

    it('should handle service status errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: () => Promise.resolve('Service Unavailable')
      })

      await expect(aiService.getServiceStatus()).rejects.toThrow('Failed to get service status')
    })
  })

  describe('analyzeDocument', () => {
    it('should analyze document text successfully', async () => {
      const mockAnalysis = {
        document_type: 'passport',
        confidence: 0.92,
        suggested_form: 'visa_application',
        extracted_data: {
          full_name: 'Jane Doe',
          passport_number: 'P987654321'
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAnalysis)
      })

      const result = await aiService.analyzeDocument('Jane Doe\nPassport: P987654321')

      expect(result).toEqual(mockAnalysis)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.supabase.co/functions/v1/ai-service',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'analyze_document',
            text: 'Jane Doe\nPassport: P987654321'
          })
        }
      )
    })

    it('should handle empty text input', async () => {
      await expect(aiService.analyzeDocument('')).rejects.toThrow('Document text cannot be empty')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should handle analysis errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Invalid input')
      })

      await expect(aiService.analyzeDocument('test')).rejects.toThrow('Document analysis failed')
    })
  })

  describe('extractTextFromImage', () => {
    it('should extract text from image successfully', async () => {
      const mockExtraction = {
        text: 'Extracted passport information',
        confidence: 0.88,
        processing_time_ms: 1500
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockExtraction)
      })

      const result = await aiService.extractTextFromImage('data:image/png;base64,test')

      expect(result).toEqual(mockExtraction)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.supabase.co/functions/v1/ai-service',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'extract_text',
            imageData: 'data:image/png;base64,test'
          })
        }
      )
    })

    it('should handle invalid image data', async () => {
      await expect(aiService.extractTextFromImage('invalid-data')).rejects.toThrow('Invalid image data format')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should handle OCR errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('OCR processing failed')
      })

      await expect(aiService.extractTextFromImage('data:image/png;base64,test')).rejects.toThrow('Text extraction failed')
    })
  })

  describe('File Conversion Utilities', () => {
    it('should convert text file to base64', async () => {
      const file = new File(['Hello World'], 'test.txt', { type: 'text/plain' })
      
      // Mock FileReader
      const mockFileReader = {
        readAsDataURL: vi.fn(),
        result: 'data:text/plain;base64,SGVsbG8gV29ybGQ=',
        onload: null as any,
        onerror: null as any
      }
      
      global.FileReader = vi.fn(() => mockFileReader) as any
      
      const promise = aiService.uploadAndProcessDocument(file)
      
      // Simulate FileReader completion
      mockFileReader.onload({ target: mockFileReader })
      
      // Mock successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: {} })
      })
      
      await promise
      
      expect(mockFileReader.readAsDataURL).toHaveBeenCalledWith(file)
    })

    it('should handle FileReader errors', async () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' })
      
      const mockFileReader = {
        readAsDataURL: vi.fn(),
        result: null,
        onload: null as any,
        onerror: null as any
      }
      
      global.FileReader = vi.fn(() => mockFileReader) as any
      
      const promise = aiService.uploadAndProcessDocument(file)
      
      // Simulate FileReader error
      mockFileReader.onerror({ target: { error: new Error('File read error') } })
      
      await expect(promise).rejects.toThrow('Failed to read file')
    })
  })

  describe('Configuration', () => {
    it('should use correct Supabase URL from environment', async () => {
      vi.stubEnv('VITE_SUPABASE_URL', 'https://custom.supabase.co')
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      })

      await aiService.getServiceStatus()

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom.supabase.co/functions/v1/ai-service',
        expect.any(Object)
      )
    })

    it('should handle missing environment variables', () => {
      vi.stubEnv('VITE_SUPABASE_URL', '')
      
      expect(() => aiService.getServiceStatus()).rejects.toThrow('VITE_SUPABASE_URL environment variable is required')
    })
  })

  describe('Response Validation', () => {
    it('should validate uploadAndProcessDocument response structure', async () => {
      const invalidResponse = {
        success: true,
        // Missing data property
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(invalidResponse)
      })

      const file = new File(['test'], 'test.txt', { type: 'text/plain' })

      await expect(aiService.uploadAndProcessDocument(file)).rejects.toThrow('Invalid response structure')
    })

    it('should validate analysis response structure', async () => {
      const invalidResponse = {
        document_type: 'passport'
        // Missing confidence and other required fields
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(invalidResponse)
      })

      await expect(aiService.analyzeDocument('test')).rejects.toThrow('Invalid analysis response')
    })
  })
})