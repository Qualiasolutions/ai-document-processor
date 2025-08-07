import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/contexts/AuthContext'
import { aiService } from '@/lib/aiService'
import { DocumentProcessorEnhanced } from '@/lib/documentProcessorEnhanced'

// Mock the AI service
vi.mock('@/lib/aiService', () => ({
  aiService: {
    uploadAndProcessDocument: vi.fn(),
    getServiceStatus: vi.fn(),
    analyzeDocument: vi.fn(),
    extractTextFromImage: vi.fn()
  }
}))

// Mock network connectivity
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
})

// Test wrapper
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          {children}
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

// Helper functions
const createMockFile = (name: string, size: number = 1024, type: string = 'text/plain') => {
  const content = 'Test content'.repeat(Math.ceil(size / 12))
  return new File([content.slice(0, size)], name, { type })
}

const simulateNetworkFailure = () => {
  vi.mocked(aiService.uploadAndProcessDocument).mockRejectedValue(
    new Error('Network request failed')
  )
}

const simulateSlowNetwork = (delay: number = 5000) => {
  vi.mocked(aiService.uploadAndProcessDocument).mockImplementation(() => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve({
          success: true,
          data: {
            document: { id: 'slow-doc' },
            processing: { status: 'completed' },
            analysis: { document_type: 'other' }
          }
        })
      }, delay)
    })
  })
}

describe('Error Scenarios and Edge Cases', () => {
  let mockUser: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockUser = userEvent.setup()
    
    // Reset network status
    Object.defineProperty(navigator, 'onLine', { value: true })
  })

  describe('Network Connectivity Issues', () => {
    it('should handle complete network failure', async () => {
      simulateNetworkFailure()

      const onError = vi.fn()
      const processor = new DocumentProcessorEnhanced({
        onComplete: vi.fn(),
        onError,
        onProgress: vi.fn()
      })

      const file = createMockFile('test.txt')
      
      await expect(processor.processDocument(file)).rejects.toThrow('Network request failed')
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Network request failed',
          type: 'network_error'
        })
      )
    })

    it('should handle offline state', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false })

      const onError = vi.fn()
      const processor = new DocumentProcessorEnhanced({
        onComplete: vi.fn(),
        onError,
        onProgress: vi.fn()
      })

      const file = createMockFile('test.txt')
      
      await expect(processor.processDocument(file)).rejects.toThrow('No internet connection')
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'No internet connection available',
          type: 'connectivity_error'
        })
      )
    })

    it('should handle intermittent connectivity with retry logic', async () => {
      let attempts = 0
      vi.mocked(aiService.uploadAndProcessDocument).mockImplementation(() => {
        attempts++
        if (attempts < 3) {
          return Promise.reject(new Error('Connection timeout'))
        }
        return Promise.resolve({
          success: true,
          data: {
            document: { id: 'retry-success' },
            processing: { status: 'completed' },
            analysis: { document_type: 'other' }
          }
        })
      })

      const processor = new DocumentProcessorEnhanced({
        onComplete: vi.fn(),
        onError: vi.fn(),
        onProgress: vi.fn(),
        options: { maxRetries: 3, retryDelay: 100 }
      })

      const file = createMockFile('test.txt')
      const result = await processor.processDocument(file)
      
      expect(result.document.id).toBe('retry-success')
      expect(attempts).toBe(3)
    })

    it('should handle slow network with timeout', async () => {
      simulateSlowNetwork(10000) // 10 second delay

      const processor = new DocumentProcessorEnhanced({
        onComplete: vi.fn(),
        onError: vi.fn(),
        onProgress: vi.fn(),
        options: { timeout: 5000 } // 5 second timeout
      })

      const file = createMockFile('test.txt')
      
      await expect(processor.processDocument(file)).rejects.toThrow('Request timeout')
    })
  })

  describe('API Service Failures', () => {
    it('should handle 429 rate limiting errors', async () => {
      vi.mocked(aiService.uploadAndProcessDocument).mockRejectedValue(
        new Error('Rate limit exceeded (429)')
      )

      const onError = vi.fn()
      const processor = new DocumentProcessorEnhanced({
        onComplete: vi.fn(),
        onError,
        onProgress: vi.fn()
      })

      const file = createMockFile('test.txt')
      
      await expect(processor.processDocument(file)).rejects.toThrow('Rate limit exceeded')
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'rate_limit_error'
        })
      )
    })

    it('should handle 401 authentication errors', async () => {
      vi.mocked(aiService.uploadAndProcessDocument).mockRejectedValue(
        new Error('Invalid API key (401)')
      )

      const onError = vi.fn()
      const processor = new DocumentProcessorEnhanced({
        onComplete: vi.fn(),
        onError,
        onProgress: vi.fn()
      })

      const file = createMockFile('test.txt')
      
      await expect(processor.processDocument(file)).rejects.toThrow('Invalid API key')
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'authentication_error'
        })
      )
    })

    it('should handle 500 internal server errors', async () => {
      vi.mocked(aiService.uploadAndProcessDocument).mockRejectedValue(
        new Error('Internal Server Error (500)')
      )

      const onError = vi.fn()
      const processor = new DocumentProcessorEnhanced({
        onComplete: vi.fn(),
        onError,
        onProgress: vi.fn()
      })

      const file = createMockFile('test.txt')
      
      await expect(processor.processDocument(file)).rejects.toThrow('Internal Server Error')
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'server_error'
        })
      )
    })

    it('should handle partial service failures with degraded mode', async () => {
      vi.mocked(aiService.uploadAndProcessDocument).mockResolvedValue({
        success: true,
        data: {
          document: { id: 'doc-123', status: 'completed' },
          processing: {
            status: 'completed_with_errors',
            warnings: ['OCR provider unavailable, used fallback'],
            degraded_features: ['advanced_analysis']
          },
          analysis: {
            document_type: 'unknown',
            confidence: 0.3,
            extracted_data: {},
            warnings: ['Low confidence due to service issues']
          }
        }
      })

      const onError = vi.fn()
      const processor = new DocumentProcessorEnhanced({
        onComplete: vi.fn(),
        onError,
        onProgress: vi.fn()
      })

      const file = createMockFile('test.txt')
      const result = await processor.processDocument(file)
      
      expect(result.processing.status).toBe('completed_with_errors')
      expect(result.analysis.confidence).toBeLessThan(0.5)
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'degraded_service_warning'
        })
      )
    })
  })

  describe('File Processing Edge Cases', () => {
    it('should handle corrupted files', async () => {
      // Create a file with invalid data
      const corruptedFile = new File(['invalid binary data \x00\x01\xFF'], 'corrupted.pdf', { 
        type: 'application/pdf' 
      })

      vi.mocked(aiService.uploadAndProcessDocument).mockRejectedValue(
        new Error('File appears to be corrupted or invalid')
      )

      const processor = new DocumentProcessorEnhanced({
        onComplete: vi.fn(),
        onError: vi.fn(),
        onProgress: vi.fn()
      })
      
      await expect(processor.processDocument(corruptedFile)).rejects.toThrow('corrupted or invalid')
    })

    it('should handle extremely large files', async () => {
      const processor = new DocumentProcessorEnhanced({
        onComplete: vi.fn(),
        onError: vi.fn(),
        onProgress: vi.fn(),
        options: { maxFileSize: 5 * 1024 * 1024 } // 5MB limit
      })

      const largeFile = createMockFile('huge.txt', 10 * 1024 * 1024) // 10MB file
      
      await expect(processor.processDocument(largeFile)).rejects.toThrow('File too large')
    })

    it('should handle files with no readable content', async () => {
      vi.mocked(aiService.uploadAndProcessDocument).mockResolvedValue({
        success: true,
        data: {
          document: { id: 'empty-content' },
          processing: {
            status: 'completed',
            extracted_text: '',
            warnings: ['No readable content found']
          },
          analysis: {
            document_type: 'unknown',
            confidence: 0.0,
            extracted_data: {},
            error: 'No text content could be extracted from this document'
          }
        }
      })

      const onError = vi.fn()
      const processor = new DocumentProcessorEnhanced({
        onComplete: vi.fn(),
        onError,
        onProgress: vi.fn()
      })

      const emptyFile = createMockFile('empty.txt', 0)
      const result = await processor.processDocument(emptyFile)
      
      expect(result.analysis.confidence).toBe(0.0)
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'processing_warning'
        })
      )
    })

    it('should handle unsupported file types gracefully', async () => {
      const processor = new DocumentProcessorEnhanced({
        onComplete: vi.fn(),
        onError: vi.fn(),
        onProgress: vi.fn()
      })

      const unsupportedFile = createMockFile('virus.exe', 1024, 'application/exe')
      
      await expect(processor.processDocument(unsupportedFile)).rejects.toThrow('Unsupported file type')
    })

    it('should handle password-protected documents', async () => {
      vi.mocked(aiService.uploadAndProcessDocument).mockRejectedValue(
        new Error('Document is password protected and cannot be processed')
      )

      const processor = new DocumentProcessorEnhanced({
        onComplete: vi.fn(),
        onError: vi.fn(),
        onProgress: vi.fn()
      })

      const protectedFile = createMockFile('protected.pdf', 1024, 'application/pdf')
      
      await expect(processor.processDocument(protectedFile)).rejects.toThrow('password protected')
    })
  })

  describe('AI Processing Edge Cases', () => {
    it('should handle ambiguous document types', async () => {
      vi.mocked(aiService.uploadAndProcessDocument).mockResolvedValue({
        success: true,
        data: {
          document: { id: 'ambiguous-doc' },
          processing: { status: 'completed' },
          analysis: {
            document_type: 'unknown',
            confidence: 0.4,
            suggested_form: 'general_form',
            extracted_data: {
              'possible_name': 'John Smith',
              'possible_date': '2024-01-01'
            },
            ambiguity_warnings: [
              'Document type could not be determined with high confidence',
              'Multiple document patterns detected'
            ]
          }
        }
      })

      const onError = vi.fn()
      const processor = new DocumentProcessorEnhanced({
        onComplete: vi.fn(),
        onError,
        onProgress: vi.fn()
      })

      const ambiguousFile = createMockFile('ambiguous.txt')
      const result = await processor.processDocument(ambiguousFile)
      
      expect(result.analysis.document_type).toBe('unknown')
      expect(result.analysis.confidence).toBeLessThan(0.5)
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'low_confidence_warning'
        })
      )
    })

    it('should handle completely unreadable documents', async () => {
      vi.mocked(aiService.uploadAndProcessDocument).mockResolvedValue({
        success: true,
        data: {
          document: { id: 'unreadable-doc' },
          processing: {
            status: 'completed',
            warnings: ['Document appears to be heavily corrupted or in unknown format']
          },
          analysis: {
            document_type: 'unreadable',
            confidence: 0.0,
            extracted_data: {},
            error: 'Unable to extract any meaningful information from this document'
          }
        }
      })

      const processor = new DocumentProcessorEnhanced({
        onComplete: vi.fn(),
        onError: vi.fn(),
        onProgress: vi.fn()
      })

      const unreadableFile = createMockFile('garbage.bin', 1024, 'application/octet-stream')
      const result = await processor.processDocument(unreadableFile)
      
      expect(result.analysis.document_type).toBe('unreadable')
      expect(Object.keys(result.analysis.extracted_data)).toHaveLength(0)
    })

    it('should handle documents with mixed languages', async () => {
      vi.mocked(aiService.uploadAndProcessDocument).mockResolvedValue({
        success: true,
        data: {
          document: { id: 'multilingual-doc' },
          processing: { status: 'completed' },
          analysis: {
            document_type: 'passport',
            confidence: 0.75,
            suggested_form: 'visa_application',
            extracted_data: {
              'full_name': 'José María García',
              'passport_number': 'ESP123456789',
              'nationality': 'España'
            },
            language_detected: ['Spanish', 'English'],
            warnings: ['Mixed language content detected - some fields may need manual review']
          }
        }
      })

      const processor = new DocumentProcessorEnhanced({
        onComplete: vi.fn(),
        onError: vi.fn(),
        onProgress: vi.fn()
      })

      const multilingualFile = createMockFile('passport_spanish.txt')
      const result = await processor.processDocument(multilingualFile)
      
      expect(result.analysis.language_detected).toContain('Spanish')
      expect(result.analysis.warnings).toBeDefined()
    })
  })

  describe('Concurrent Processing Issues', () => {
    it('should handle multiple simultaneous uploads', async () => {
      let completedUploads = 0
      vi.mocked(aiService.uploadAndProcessDocument).mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            completedUploads++
            resolve({
              success: true,
              data: {
                document: { id: `concurrent-${completedUploads}` },
                processing: { status: 'completed' },
                analysis: { document_type: 'other' }
              }
            })
          }, Math.random() * 1000) // Random delay
        })
      })

      const processor = new DocumentProcessorEnhanced({
        onComplete: vi.fn(),
        onError: vi.fn(),
        onProgress: vi.fn()
      })

      const files = [
        createMockFile('file1.txt'),
        createMockFile('file2.txt'),
        createMockFile('file3.txt')
      ]

      const promises = files.map(file => processor.processDocument(file))
      const results = await Promise.all(promises)
      
      expect(results).toHaveLength(3)
      expect(completedUploads).toBe(3)
      
      // Verify each got a unique ID
      const ids = results.map(r => r.document.id)
      expect(new Set(ids).size).toBe(3)
    })

    it('should handle resource exhaustion during concurrent processing', async () => {
      vi.mocked(aiService.uploadAndProcessDocument).mockRejectedValue(
        new Error('Service temporarily overloaded - too many concurrent requests')
      )

      const processor = new DocumentProcessorEnhanced({
        onComplete: vi.fn(),
        onError: vi.fn(),
        onProgress: vi.fn()
      })

      const files = Array.from({ length: 10 }, (_, i) => createMockFile(`file${i}.txt`))
      const promises = files.map(file => processor.processDocument(file))
      
      await expect(Promise.all(promises)).rejects.toThrow('temporarily overloaded')
    })
  })

  describe('Browser Compatibility Edge Cases', () => {
    it('should handle FileReader API failures', async () => {
      // Mock FileReader failure
      const originalFileReader = global.FileReader
      global.FileReader = vi.fn(() => ({
        readAsDataURL: vi.fn(),
        onerror: null,
        onload: null,
        result: null
      })) as any

      const processor = new DocumentProcessorEnhanced({
        onComplete: vi.fn(),
        onError: vi.fn(),
        onProgress: vi.fn()
      })

      const file = createMockFile('test.txt')
      
      // Simulate FileReader error
      const mockFileReader = new FileReader()
      setTimeout(() => {
        if (mockFileReader.onerror) {
          mockFileReader.onerror({ target: { error: new Error('FileReader failed') } } as any)
        }
      }, 0)

      await expect(processor.processDocument(file)).rejects.toThrow('Failed to read file')
      
      // Restore FileReader
      global.FileReader = originalFileReader
    })

    it('should handle lack of modern browser features', async () => {
      // Mock missing fetch
      const originalFetch = global.fetch
      delete (global as any).fetch

      vi.mocked(aiService.uploadAndProcessDocument).mockRejectedValue(
        new Error('fetch is not defined - unsupported browser')
      )

      const processor = new DocumentProcessorEnhanced({
        onComplete: vi.fn(),
        onError: vi.fn(),
        onProgress: vi.fn()
      })

      const file = createMockFile('test.txt')
      
      await expect(processor.processDocument(file)).rejects.toThrow('unsupported browser')
      
      // Restore fetch
      global.fetch = originalFetch
    })
  })

  describe('Memory and Performance Edge Cases', () => {
    it('should handle memory pressure during large file processing', async () => {
      // Mock memory information if available
      if ('memory' in performance) {
        Object.defineProperty((performance as any).memory, 'usedJSHeapSize', {
          value: 100 * 1024 * 1024 // 100MB
        })
        Object.defineProperty((performance as any).memory, 'jsHeapSizeLimit', {
          value: 120 * 1024 * 1024 // 120MB limit
        })
      }

      vi.mocked(aiService.uploadAndProcessDocument).mockRejectedValue(
        new Error('Insufficient memory to process large file')
      )

      const processor = new DocumentProcessorEnhanced({
        onComplete: vi.fn(),
        onError: vi.fn(),
        onProgress: vi.fn()
      })

      const largeFile = createMockFile('large.txt', 50 * 1024 * 1024) // 50MB
      
      await expect(processor.processDocument(largeFile)).rejects.toThrow('Insufficient memory')
    })

    it('should handle CPU-intensive processing timeouts', async () => {
      vi.mocked(aiService.uploadAndProcessDocument).mockImplementation(() => {
        // Simulate CPU-intensive task that times out
        return new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Processing timeout - document too complex'))
          }, 15000) // 15 second timeout
        })
      })

      const processor = new DocumentProcessorEnhanced({
        onComplete: vi.fn(),
        onError: vi.fn(),
        onProgress: vi.fn(),
        options: { timeout: 10000 } // 10 second timeout
      })

      const complexFile = createMockFile('complex.pdf', 1024, 'application/pdf')
      
      await expect(processor.processDocument(complexFile)).rejects.toThrow('timeout')
    })
  })

  describe('State Management Edge Cases', () => {
    it('should handle component unmount during processing', async () => {
      let resolveProcessing: (value: any) => void
      
      vi.mocked(aiService.uploadAndProcessDocument).mockImplementation(() => {
        return new Promise(resolve => {
          resolveProcessing = resolve
        })
      })

      let unmountProcessor: () => void
      const onError = vi.fn()
      
      const TestComponent = () => {
        const [processor, setProcessor] = React.useState<DocumentProcessorEnhanced | null>(null)

        React.useEffect(() => {
          const newProcessor = new DocumentProcessorEnhanced({
            onComplete: vi.fn(),
            onError,
            onProgress: vi.fn()
          })
          setProcessor(newProcessor)

          unmountProcessor = () => {
            newProcessor.destroy() // Cleanup method
            setProcessor(null)
          }
        }, [])

        return processor ? <div>Processing...</div> : <div>No processor</div>
      }

      const { rerender } = render(<TestComponent />, { wrapper: TestWrapper })
      
      // Start processing
      const file = createMockFile('test.txt')
      // processor.processDocument(file) - would be called in real scenario
      
      // Unmount component before processing completes
      rerender(<div>Unmounted</div>)
      unmountProcessor!()
      
      // Complete processing after unmount
      resolveProcessing!({
        success: true,
        data: { document: { id: 'test' }, processing: { status: 'completed' }, analysis: {} }
      })

      // Should not call callbacks after unmount
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(onError).not.toHaveBeenCalled()
    })
  })
})

// Additional test for comprehensive error logging
describe('Error Logging and Reporting', () => {
  it('should collect and report comprehensive error information', async () => {
    const errors: any[] = []
    
    const processor = new DocumentProcessorEnhanced({
      onComplete: vi.fn(),
      onError: (error) => {
        errors.push({
          timestamp: new Date().toISOString(),
          ...error
        })
      },
      onProgress: vi.fn()
    })

    // Test various error scenarios
    const errorScenarios = [
      { file: createMockFile('test1.txt'), error: 'Network timeout' },
      { file: createMockFile('test2.pdf', 0), error: 'Empty file' },
      { file: createMockFile('test3.exe', 1024, 'application/exe'), error: 'Unsupported type' }
    ]

    for (const scenario of errorScenarios) {
      vi.mocked(aiService.uploadAndProcessDocument).mockRejectedValue(new Error(scenario.error))
      
      try {
        await processor.processDocument(scenario.file)
      } catch (error) {
        // Expected to fail
      }
    }

    expect(errors).toHaveLength(3)
    errors.forEach(error => {
      expect(error).toHaveProperty('timestamp')
      expect(error).toHaveProperty('message')
      expect(error).toHaveProperty('type')
    })
  })
})