import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DocumentProcessorEnhanced } from '@/lib/documentProcessorEnhanced'
import { aiService } from '@/lib/aiService'

// Mock the AI service
vi.mock('@/lib/aiService', () => ({
  aiService: {
    uploadAndProcessDocument: vi.fn(),
    getServiceStatus: vi.fn(),
    analyzeDocument: vi.fn(),
    extractTextFromImage: vi.fn()
  }
}))

// Mock file upload helper
const createMockFile = (name: string, size: number = 1024, type: string = 'text/plain') => {
  const content = 'Test file content'.repeat(Math.ceil(size / 17))
  return new File([content.slice(0, size)], name, { type })
}

describe('DocumentProcessorEnhanced', () => {
  let mockOnComplete: ReturnType<typeof vi.fn>
  let mockOnError: ReturnType<typeof vi.fn>
  let mockOnProgress: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockOnComplete = vi.fn()
    mockOnError = vi.fn()
    mockOnProgress = vi.fn()
  })

  describe('Initialization', () => {
    it('should initialize with correct service status', async () => {
      const mockStatus = {
        providers: {
          'mistral-ocr': { available: true },
          'claude-analysis': { available: true },
          'openai-fallback': { available: false }
        }
      }

      vi.mocked(aiService.getServiceStatus).mockResolvedValue(mockStatus)

      const processor = new DocumentProcessorEnhanced({
        onComplete: mockOnComplete,
        onError: mockOnError,
        onProgress: mockOnProgress
      })

      await processor.initialize()

      expect(aiService.getServiceStatus).toHaveBeenCalled()
      expect(processor.getServiceHealth()).toEqual(mockStatus)
    })

    it('should handle service status errors gracefully', async () => {
      vi.mocked(aiService.getServiceStatus).mockRejectedValue(new Error('Service unavailable'))

      const processor = new DocumentProcessorEnhanced({
        onComplete: mockOnComplete,
        onError: mockOnError,
        onProgress: mockOnProgress
      })

      await processor.initialize()

      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Failed to initialize')
        })
      )
    })
  })

  describe('Document Upload and Processing', () => {
    it('should process text document successfully', async () => {
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

      vi.mocked(aiService.uploadAndProcessDocument).mockResolvedValue(mockResponse)

      const processor = new DocumentProcessorEnhanced({
        onComplete: mockOnComplete,
        onError: mockOnError,
        onProgress: mockOnProgress
      })

      const file = createMockFile('passport.txt')
      const result = await processor.processDocument(file)

      expect(result).toEqual(mockResponse.data)
      expect(mockOnProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'uploading',
          progress: 0
        })
      )
      expect(mockOnProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'completed',
          progress: 100
        })
      )
      expect(mockOnComplete).toHaveBeenCalledWith(mockResponse.data)
    })

    it('should handle image documents with OCR', async () => {
      const mockResponse = {
        success: true,
        data: {
          document: { id: 'doc-456', filename: 'scan.png' },
          processing: { status: 'completed', ocr_used: true },
          analysis: {
            document_type: 'identification',
            confidence: 0.88,
            extracted_data: { id_number: '123456789' }
          }
        }
      }

      vi.mocked(aiService.uploadAndProcessDocument).mockResolvedValue(mockResponse)

      const processor = new DocumentProcessorEnhanced({
        onComplete: mockOnComplete,
        onError: mockOnError,
        onProgress: mockOnProgress
      })

      const file = createMockFile('scan.png', 2048, 'image/png')
      const result = await processor.processDocument(file)

      expect(result).toEqual(mockResponse.data)
      expect(mockOnProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'ocr_processing',
          progress: expect.any(Number)
        })
      )
    })

    it('should handle processing failures', async () => {
      const mockResponse = {
        success: true,
        data: {
          document: { id: 'doc-789' },
          processing: {
            status: 'failed',
            error: 'AI processing timeout'
          },
          analysis: null
        }
      }

      vi.mocked(aiService.uploadAndProcessDocument).mockResolvedValue(mockResponse)

      const processor = new DocumentProcessorEnhanced({
        onComplete: mockOnComplete,
        onError: mockOnError,
        onProgress: mockOnProgress
      })

      const file = createMockFile('test.txt')
      const result = await processor.processDocument(file)

      expect(result).toEqual(mockResponse.data)
      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('AI processing timeout')
        })
      )
    })

    it('should handle upload errors', async () => {
      vi.mocked(aiService.uploadAndProcessDocument).mockRejectedValue(
        new Error('Upload failed: File too large')
      )

      const processor = new DocumentProcessorEnhanced({
        onComplete: mockOnComplete,
        onError: mockOnError,
        onProgress: mockOnProgress
      })

      const file = createMockFile('large.txt', 15 * 1024 * 1024) // 15MB
      
      await expect(processor.processDocument(file)).rejects.toThrow('Upload failed: File too large')
      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Upload failed: File too large'
        })
      )
    })
  })

  describe('Progress Tracking', () => {
    it('should track progress through all stages', async () => {
      const mockResponse = {
        success: true,
        data: {
          document: { id: 'doc-123' },
          processing: { status: 'completed' },
          analysis: { document_type: 'passport' }
        }
      }

      // Mock delayed response to test progress tracking
      vi.mocked(aiService.uploadAndProcessDocument).mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve(mockResponse), 100)
        })
      })

      const processor = new DocumentProcessorEnhanced({
        onComplete: mockOnComplete,
        onError: mockOnError,
        onProgress: mockOnProgress
      })

      const file = createMockFile('test.txt')
      await processor.processDocument(file)

      // Verify progress stages were called
      const progressCalls = mockOnProgress.mock.calls.map(call => call[0])
      const stages = progressCalls.map(call => call.stage)

      expect(stages).toContain('uploading')
      expect(stages).toContain('processing')
      expect(stages).toContain('completed')

      // Verify progress increases
      const progressValues = progressCalls.map(call => call.progress)
      expect(Math.max(...progressValues)).toBe(100)
    })

    it('should handle different file types with appropriate progress stages', async () => {
      const mockResponse = {
        success: true,
        data: {
          document: { id: 'doc-456' },
          processing: { status: 'completed', ocr_used: true },
          analysis: { document_type: 'other' }
        }
      }

      vi.mocked(aiService.uploadAndProcessDocument).mockResolvedValue(mockResponse)

      const processor = new DocumentProcessorEnhanced({
        onComplete: mockOnComplete,
        onError: mockOnError,
        onProgress: mockOnProgress
      })

      // Test image file
      const imageFile = createMockFile('image.png', 1024, 'image/png')
      await processor.processDocument(imageFile)

      const progressCalls = mockOnProgress.mock.calls.map(call => call[0])
      const stages = progressCalls.map(call => call.stage)

      expect(stages).toContain('ocr_processing')
    })
  })

  describe('Error Handling', () => {
    it('should handle file validation errors', async () => {
      const processor = new DocumentProcessorEnhanced({
        onComplete: mockOnComplete,
        onError: mockOnError,
        onProgress: mockOnProgress
      })

      // Test unsupported file type
      const unsupportedFile = createMockFile('virus.exe', 1024, 'application/exe')
      
      await expect(processor.processDocument(unsupportedFile)).rejects.toThrow('Unsupported file type')
    })

    it('should handle network errors', async () => {
      vi.mocked(aiService.uploadAndProcessDocument).mockRejectedValue(
        new Error('Network error: fetch failed')
      )

      const processor = new DocumentProcessorEnhanced({
        onComplete: mockOnComplete,
        onError: mockOnError,
        onProgress: mockOnProgress
      })

      const file = createMockFile('test.txt')
      
      await expect(processor.processDocument(file)).rejects.toThrow('Network error: fetch failed')
      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Network error: fetch failed',
          type: 'network_error'
        })
      )
    })

    it('should handle service unavailable errors', async () => {
      vi.mocked(aiService.uploadAndProcessDocument).mockRejectedValue(
        new Error('Service temporarily unavailable')
      )

      const processor = new DocumentProcessorEnhanced({
        onComplete: mockOnComplete,
        onError: mockOnError,
        onProgress: mockOnProgress
      })

      const file = createMockFile('test.txt')
      
      await expect(processor.processDocument(file)).rejects.toThrow('Service temporarily unavailable')
      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Service temporarily unavailable',
          type: 'service_error'
        })
      )
    })
  })

  describe('Service Health Monitoring', () => {
    it('should provide service health information', async () => {
      const mockStatus = {
        providers: {
          'mistral-ocr': { available: true, response_time: 150 },
          'claude-analysis': { available: true, response_time: 200 },
          'openai-fallback': { available: false, error: 'Rate limit exceeded' }
        }
      }

      vi.mocked(aiService.getServiceStatus).mockResolvedValue(mockStatus)

      const processor = new DocumentProcessorEnhanced({
        onComplete: mockOnComplete,
        onError: mockOnError,
        onProgress: mockOnProgress
      })

      await processor.initialize()
      const health = processor.getServiceHealth()

      expect(health).toEqual(mockStatus)
    })

    it('should detect degraded service performance', async () => {
      const mockStatus = {
        providers: {
          'mistral-ocr': { available: true, response_time: 5000 }, // Slow
          'claude-analysis': { available: false, error: 'Timeout' },
          'openai-fallback': { available: true, response_time: 300 }
        }
      }

      vi.mocked(aiService.getServiceStatus).mockResolvedValue(mockStatus)

      const processor = new DocumentProcessorEnhanced({
        onComplete: mockOnComplete,
        onError: mockOnError,
        onProgress: mockOnProgress
      })

      await processor.initialize()
      const health = processor.getServiceHealth()
      const isDegraded = processor.isServiceDegraded()

      expect(health).toEqual(mockStatus)
      expect(isDegraded).toBe(true)
    })
  })

  describe('Configuration and Options', () => {
    it('should respect custom configuration options', async () => {
      const customOptions = {
        maxFileSize: 5 * 1024 * 1024, // 5MB
        allowedTypes: ['text/plain', 'image/png'],
        timeout: 30000
      }

      const processor = new DocumentProcessorEnhanced({
        onComplete: mockOnComplete,
        onError: mockOnError,
        onProgress: mockOnProgress,
        options: customOptions
      })

      // Test file size limit
      const largeFile = createMockFile('large.txt', 6 * 1024 * 1024) // 6MB
      await expect(processor.processDocument(largeFile)).rejects.toThrow('File too large')

      // Test allowed types
      const unsupportedFile = createMockFile('test.pdf', 1024, 'application/pdf')
      await expect(processor.processDocument(unsupportedFile)).rejects.toThrow('Unsupported file type')
    })

    it('should use default configuration when not provided', async () => {
      const processor = new DocumentProcessorEnhanced({
        onComplete: mockOnComplete,
        onError: mockOnError,
        onProgress: mockOnProgress
      })

      const config = processor.getConfiguration()

      expect(config.maxFileSize).toBe(10 * 1024 * 1024) // Default 10MB
      expect(config.allowedTypes).toContain('text/plain')
      expect(config.allowedTypes).toContain('image/png')
      expect(config.allowedTypes).toContain('application/pdf')
    })
  })

  describe('Integration with Legacy System', () => {
    it('should maintain backward compatibility', async () => {
      const mockResponse = {
        success: true,
        data: {
          document: { id: 'doc-123' },
          processing: { status: 'completed' },
          analysis: {
            document_type: 'passport',
            confidence: 0.95,
            extracted_data: { name: 'John Doe' }
          }
        }
      }

      vi.mocked(aiService.uploadAndProcessDocument).mockResolvedValue(mockResponse)

      const processor = new DocumentProcessorEnhanced({
        onComplete: mockOnComplete,
        onError: mockOnError,
        onProgress: mockOnProgress
      })

      const file = createMockFile('test.txt')
      const result = await processor.processDocument(file)

      // Should return same structure as legacy system
      expect(result).toHaveProperty('document')
      expect(result).toHaveProperty('processing')
      expect(result).toHaveProperty('analysis')
      expect(result.analysis).toHaveProperty('document_type')
      expect(result.analysis).toHaveProperty('confidence')
      expect(result.analysis).toHaveProperty('extracted_data')
    })
  })
})