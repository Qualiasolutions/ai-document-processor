import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/contexts/AuthContext'
import FileUpload from '@/components/FileUpload'
import DocumentAnalysis from '@/components/DocumentAnalysis'
import FormGenerator from '@/components/FormGenerator'
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

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ data: [], error: null })),
      insert: vi.fn(() => Promise.resolve({ data: [{ id: 'form-123' }], error: null })),
      update: vi.fn(() => Promise.resolve({ data: [{}], error: null }))
    })),
    storage: {
      from: vi.fn(() => ({
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://test.url' } }))
      }))
    }
  }
}))

// Test wrapper component
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

// Helper function to create mock files
const createMockFile = (name: string, content: string, type: string = 'text/plain') => {
  return new File([content], name, { type })
}

describe('End-to-End Document Processing Workflows', () => {
  let mockUser: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockUser = userEvent.setup()
    
    // Mock successful service status
    vi.mocked(aiService.getServiceStatus).mockResolvedValue({
      providers: {
        'mistral-ocr': { available: true },
        'claude-analysis': { available: true },
        'openai-fallback': { available: true }
      }
    })
  })

  describe('Complete Passport Document Workflow', () => {
    it('should process passport document from upload to form generation', async () => {
      // Mock complete successful response
      const mockResponse = {
        success: true,
        data: {
          document: {
            id: 'doc-passport-123',
            filename: 'passport.txt',
            status: 'completed',
            file_path: 'anonymous/passport.txt',
            created_at: new Date().toISOString()
          },
          processing: {
            status: 'completed',
            content_length: 150,
            processing_time_ms: 2500,
            provider_used: 'claude-analysis'
          },
          analysis: {
            document_type: 'passport',
            confidence: 0.95,
            suggested_form: 'visa_application',
            extracted_data: {
              full_name: 'John Michael Smith',
              passport_number: 'P123456789',
              date_of_birth: '1990-05-15',
              nationality: 'United States of America',
              issue_date: '2020-01-15',
              expiry_date: '2030-01-14'
            }
          }
        }
      }

      vi.mocked(aiService.uploadAndProcessDocument).mockResolvedValue(mockResponse)

      // Create complete workflow component
      const WorkflowTest = () => {
        const [uploadResult, setUploadResult] = React.useState(null)
        const [isProcessing, setIsProcessing] = React.useState(false)

        return (
          <div>
            <FileUpload
              onFileSelect={async (files) => {
                setIsProcessing(true)
                try {
                  const result = await aiService.uploadAndProcessDocument(files[0])
                  setUploadResult(result.data)
                } catch (error) {
                  console.error('Upload failed:', error)
                } finally {
                  setIsProcessing(false)
                }
              }}
              disabled={isProcessing}
            />
            
            {isProcessing && (
              <div data-testid="processing-indicator">Processing document...</div>
            )}
            
            {uploadResult && (
              <>
                <DocumentAnalysis
                  document={uploadResult.document}
                  analysis={uploadResult.analysis}
                />
                <FormGenerator
                  documentType={uploadResult.analysis.document_type}
                  extractedData={uploadResult.analysis.extracted_data}
                  suggestedForm={uploadResult.analysis.suggested_form}
                />
              </>
            )}
          </div>
        )
      }

      render(<WorkflowTest />, { wrapper: TestWrapper })

      // Step 1: Upload file
      const fileInput = screen.getByLabelText(/choose files/i)
      const passportFile = createMockFile(
        'passport.txt', 
        'John Michael Smith\nPassport Number: P123456789\nDate of Birth: May 15, 1990\nNationality: United States of America'
      )

      await mockUser.upload(fileInput, passportFile)

      // Step 2: Verify processing starts
      await waitFor(() => {
        expect(screen.getByTestId('processing-indicator')).toBeInTheDocument()
      })

      // Step 3: Wait for processing to complete
      await waitFor(() => {
        expect(screen.queryByTestId('processing-indicator')).not.toBeInTheDocument()
      }, { timeout: 5000 })

      // Step 4: Verify document analysis is displayed
      await waitFor(() => {
        expect(screen.getByText(/document type: passport/i)).toBeInTheDocument()
        expect(screen.getByText(/confidence: 95%/i)).toBeInTheDocument()
        expect(screen.getByText(/john michael smith/i)).toBeInTheDocument()
        expect(screen.getByText(/P123456789/i)).toBeInTheDocument()
      })

      // Step 5: Verify form generation
      await waitFor(() => {
        expect(screen.getByText(/visa application form/i)).toBeInTheDocument()
        
        // Check that form fields are populated
        const nameField = screen.getByDisplayValue('John Michael Smith')
        const passportField = screen.getByDisplayValue('P123456789')
        const dobField = screen.getByDisplayValue('1990-05-15')
        
        expect(nameField).toBeInTheDocument()
        expect(passportField).toBeInTheDocument()
        expect(dobField).toBeInTheDocument()
      })

      // Verify AI service was called correctly
      expect(aiService.uploadAndProcessDocument).toHaveBeenCalledWith(passportFile)
    })
  })

  describe('Bank Statement Processing Workflow', () => {
    it('should process bank statement and generate financial declaration form', async () => {
      const mockResponse = {
        success: true,
        data: {
          document: {
            id: 'doc-bank-456',
            filename: 'bank_statement.pdf',
            status: 'completed'
          },
          processing: {
            status: 'completed',
            ocr_used: true,
            processing_time_ms: 4200,
            provider_used: 'mistral-ocr'
          },
          analysis: {
            document_type: 'bank_statement',
            confidence: 0.88,
            suggested_form: 'financial_declaration',
            extracted_data: {
              account_holder: 'John Michael Smith',
              account_number: '****1234',
              bank_name: 'First National Bank',
              statement_period: '2024-01-01 to 2024-01-31',
              closing_balance: '$15,420.50',
              average_balance: '$12,850.75'
            }
          }
        }
      }

      vi.mocked(aiService.uploadAndProcessDocument).mockResolvedValue(mockResponse)

      const WorkflowTest = () => {
        const [result, setResult] = React.useState(null)
        const [processing, setProcessing] = React.useState(false)
        const [progress, setProgress] = React.useState(0)

        const handleUpload = async (files) => {
          setProcessing(true)
          setProgress(0)
          
          // Simulate progress updates
          const progressInterval = setInterval(() => {
            setProgress(prev => Math.min(prev + 20, 90))
          }, 500)

          try {
            const result = await aiService.uploadAndProcessDocument(files[0])
            setResult(result.data)
            setProgress(100)
          } finally {
            clearInterval(progressInterval)
            setProcessing(false)
          }
        }

        return (
          <div>
            <FileUpload onFileSelect={handleUpload} />
            
            {processing && (
              <div data-testid="progress-bar">
                Processing: {progress}%
              </div>
            )}
            
            {result && (
              <div data-testid="results">
                <DocumentAnalysis 
                  document={result.document}
                  analysis={result.analysis}
                />
                <FormGenerator
                  documentType={result.analysis.document_type}
                  extractedData={result.analysis.extracted_data}
                  suggestedForm={result.analysis.suggested_form}
                />
              </div>
            )}
          </div>
        )
      }

      render(<WorkflowTest />, { wrapper: TestWrapper })

      // Upload bank statement PDF
      const fileInput = screen.getByLabelText(/choose files/i)
      const bankFile = createMockFile('bank_statement.pdf', 'PDF content', 'application/pdf')

      await mockUser.upload(fileInput, bankFile)

      // Verify progress tracking
      await waitFor(() => {
        expect(screen.getByTestId('progress-bar')).toBeInTheDocument()
      })

      // Wait for completion
      await waitFor(() => {
        expect(screen.getByTestId('results')).toBeInTheDocument()
      }, { timeout: 6000 })

      // Verify bank statement analysis
      expect(screen.getByText(/document type: bank_statement/i)).toBeInTheDocument()
      expect(screen.getByText(/first national bank/i)).toBeInTheDocument()
      expect(screen.getByText(/\$15,420\.50/)).toBeInTheDocument()

      // Verify financial declaration form
      expect(screen.getByText(/financial declaration/i)).toBeInTheDocument()
      expect(screen.getByDisplayValue('John Michael Smith')).toBeInTheDocument()
      expect(screen.getByDisplayValue('$15,420.50')).toBeInTheDocument()
    })
  })

  describe('Image Document OCR Workflow', () => {
    it('should process scanned document image through OCR pipeline', async () => {
      const mockResponse = {
        success: true,
        data: {
          document: {
            id: 'doc-image-789',
            filename: 'drivers_license.jpg',
            status: 'completed'
          },
          processing: {
            status: 'completed',
            ocr_used: true,
            extracted_text: 'DRIVERS LICENSE\nJOHN SMITH\nDOB: 05/15/1990\nLIC#: D123456789',
            processing_time_ms: 3800,
            provider_used: 'mistral-ocr'
          },
          analysis: {
            document_type: 'identification',
            confidence: 0.92,
            suggested_form: 'identity_verification',
            extracted_data: {
              full_name: 'John Smith',
              license_number: 'D123456789',
              date_of_birth: '1990-05-15',
              document_type: 'drivers_license'
            }
          }
        }
      }

      vi.mocked(aiService.uploadAndProcessDocument).mockResolvedValue(mockResponse)

      const WorkflowTest = () => {
        const [state, setState] = React.useState({
          processing: false,
          stage: '',
          result: null,
          error: null
        })

        const handleUpload = async (files) => {
          setState({ processing: true, stage: 'uploading', result: null, error: null })
          
          try {
            // Simulate stage progression
            setTimeout(() => setState(prev => ({ ...prev, stage: 'ocr_processing' })), 1000)
            setTimeout(() => setState(prev => ({ ...prev, stage: 'analyzing' })), 2000)
            setTimeout(() => setState(prev => ({ ...prev, stage: 'generating_form' })), 3000)
            
            const result = await aiService.uploadAndProcessDocument(files[0])
            setState({ 
              processing: false, 
              stage: 'completed', 
              result: result.data, 
              error: null 
            })
          } catch (error) {
            setState({ 
              processing: false, 
              stage: 'error', 
              result: null, 
              error: error.message 
            })
          }
        }

        return (
          <div>
            <FileUpload onFileSelect={handleUpload} />
            
            {state.processing && (
              <div data-testid="processing-stages">
                Current stage: {state.stage}
              </div>
            )}
            
            {state.error && (
              <div data-testid="error-message">
                Error: {state.error}
              </div>
            )}
            
            {state.result && (
              <div data-testid="ocr-results">
                <h3>OCR Results</h3>
                <pre data-testid="extracted-text">
                  {state.result.processing.extracted_text}
                </pre>
                
                <DocumentAnalysis 
                  document={state.result.document}
                  analysis={state.result.analysis}
                />
                
                <FormGenerator
                  documentType={state.result.analysis.document_type}
                  extractedData={state.result.analysis.extracted_data}
                  suggestedForm={state.result.analysis.suggested_form}
                />
              </div>
            )}
          </div>
        )
      }

      render(<WorkflowTest />, { wrapper: TestWrapper })

      // Upload image file
      const fileInput = screen.getByLabelText(/choose files/i)
      const imageFile = createMockFile('drivers_license.jpg', 'binary image data', 'image/jpeg')

      await mockUser.upload(fileInput, imageFile)

      // Verify processing stages
      await waitFor(() => {
        expect(screen.getByText(/current stage: uploading/i)).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(screen.getByText(/current stage: ocr_processing/i)).toBeInTheDocument()
      }, { timeout: 2000 })

      await waitFor(() => {
        expect(screen.getByText(/current stage: analyzing/i)).toBeInTheDocument()
      }, { timeout: 3000 })

      // Wait for completion
      await waitFor(() => {
        expect(screen.getByTestId('ocr-results')).toBeInTheDocument()
      }, { timeout: 5000 })

      // Verify OCR text extraction
      const extractedText = screen.getByTestId('extracted-text')
      expect(extractedText).toHaveTextContent('DRIVERS LICENSE')
      expect(extractedText).toHaveTextContent('JOHN SMITH')
      expect(extractedText).toHaveTextContent('D123456789')

      // Verify analysis results
      expect(screen.getByText(/document type: identification/i)).toBeInTheDocument()
      expect(screen.getByText(/confidence: 92%/i)).toBeInTheDocument()

      // Verify form generation
      expect(screen.getByText(/identity verification/i)).toBeInTheDocument()
      expect(screen.getByDisplayValue('John Smith')).toBeInTheDocument()
      expect(screen.getByDisplayValue('D123456789')).toBeInTheDocument()
    })
  })

  describe('Error Recovery Workflows', () => {
    it('should handle AI service failures gracefully with user feedback', async () => {
      // Mock service failure then recovery
      vi.mocked(aiService.uploadAndProcessDocument)
        .mockRejectedValueOnce(new Error('Service temporarily unavailable'))
        .mockResolvedValueOnce({
          success: true,
          data: {
            document: { id: 'doc-recovery-123' },
            processing: { status: 'completed' },
            analysis: { document_type: 'other', confidence: 0.7, extracted_data: {} }
          }
        })

      const WorkflowTest = () => {
        const [state, setState] = React.useState({
          processing: false,
          error: null,
          result: null,
          retryCount: 0
        })

        const handleUpload = async (files, isRetry = false) => {
          if (isRetry) {
            setState(prev => ({ ...prev, retryCount: prev.retryCount + 1 }))
          }
          
          setState(prev => ({ ...prev, processing: true, error: null }))
          
          try {
            const result = await aiService.uploadAndProcessDocument(files[0])
            setState(prev => ({ 
              ...prev, 
              processing: false, 
              result: result.data,
              error: null 
            }))
          } catch (error) {
            setState(prev => ({ 
              ...prev, 
              processing: false, 
              error: error.message 
            }))
          }
        }

        return (
          <div>
            <FileUpload onFileSelect={handleUpload} />
            
            {state.processing && (
              <div data-testid="processing">Processing...</div>
            )}
            
            {state.error && (
              <div data-testid="error-handling">
                <p>Error: {state.error}</p>
                <button 
                  data-testid="retry-button"
                  onClick={() => handleUpload([new File(['retry'], 'retry.txt')], true)}
                >
                  Retry (Attempt {state.retryCount + 1})
                </button>
              </div>
            )}
            
            {state.result && (
              <div data-testid="success-result">
                Document processed successfully after {state.retryCount} retries
              </div>
            )}
          </div>
        )
      }

      render(<WorkflowTest />, { wrapper: TestWrapper })

      // Upload file (will fail first time)
      const fileInput = screen.getByLabelText(/choose files/i)
      const testFile = createMockFile('test.txt', 'test content')

      await mockUser.upload(fileInput, testFile)

      // Verify error handling
      await waitFor(() => {
        expect(screen.getByTestId('error-handling')).toBeInTheDocument()
        expect(screen.getByText(/service temporarily unavailable/i)).toBeInTheDocument()
      })

      // Click retry button
      const retryButton = screen.getByTestId('retry-button')
      await mockUser.click(retryButton)

      // Verify recovery
      await waitFor(() => {
        expect(screen.getByTestId('success-result')).toBeInTheDocument()
        expect(screen.getByText(/after 1 retries/)).toBeInTheDocument()
      })

      // Verify service was called twice
      expect(aiService.uploadAndProcessDocument).toHaveBeenCalledTimes(2)
    })
  })

  describe('Performance and User Experience', () => {
    it('should provide real-time feedback during long processing operations', async () => {
      // Mock slow processing
      vi.mocked(aiService.uploadAndProcessDocument).mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              success: true,
              data: {
                document: { id: 'doc-slow-123' },
                processing: { status: 'completed', processing_time_ms: 8000 },
                analysis: { document_type: 'complex_document', confidence: 0.85, extracted_data: {} }
              }
            })
          }, 3000) // 3 second delay
        })
      })

      const WorkflowTest = () => {
        const [progress, setProgress] = React.useState(0)
        const [timeElapsed, setTimeElapsed] = React.useState(0)
        const [result, setResult] = React.useState(null)

        const handleUpload = async (files) => {
          const startTime = Date.now()
          
          // Simulate progress updates
          const progressInterval = setInterval(() => {
            setProgress(prev => Math.min(prev + 5, 95))
          }, 150)
          
          // Update elapsed time
          const timeInterval = setInterval(() => {
            setTimeElapsed(Math.floor((Date.now() - startTime) / 1000))
          }, 1000)

          try {
            const result = await aiService.uploadAndProcessDocument(files[0])
            setResult(result.data)
            setProgress(100)
          } finally {
            clearInterval(progressInterval)
            clearInterval(timeInterval)
          }
        }

        return (
          <div>
            <FileUpload onFileSelect={handleUpload} />
            
            {progress > 0 && progress < 100 && (
              <div data-testid="progress-feedback">
                <div data-testid="progress-bar" style={{ width: `${progress}%`, height: '4px', backgroundColor: 'blue' }} />
                <p>Processing... {progress}%</p>
                <p>Time elapsed: {timeElapsed}s</p>
              </div>
            )}
            
            {result && (
              <div data-testid="completion-feedback">
                Processing completed in {result.processing.processing_time_ms}ms
              </div>
            )}
          </div>
        )
      }

      render(<WorkflowTest />, { wrapper: TestWrapper })

      const fileInput = screen.getByLabelText(/choose files/i)
      const testFile = createMockFile('complex.txt', 'complex document content')

      await mockUser.upload(fileInput, testFile)

      // Verify progress feedback appears
      await waitFor(() => {
        expect(screen.getByTestId('progress-feedback')).toBeInTheDocument()
      })

      // Verify progress updates
      await waitFor(() => {
        expect(screen.getByText(/processing\.\.\. \d+%/)).toBeInTheDocument()
        expect(screen.getByText(/time elapsed: \d+s/)).toBeInTheDocument()
      })

      // Wait for completion
      await waitFor(() => {
        expect(screen.getByTestId('completion-feedback')).toBeInTheDocument()
      }, { timeout: 5000 })

      expect(screen.getByText(/processing completed in 8000ms/)).toBeInTheDocument()
    })
  })
})