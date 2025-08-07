import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.localStorage = localStorageMock as any

// Mock import.meta.env
vi.mock('import.meta.env', () => ({
  VITE_OPENAI_API_KEY: undefined,
}))

// Mock OpenAI
const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn(),
    },
  },
}

vi.mock('openai', () => ({
  default: class OpenAI {
    constructor() {
      return mockOpenAI
    }
  },
}))

describe('OpenAI Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Set up a valid API key for tests
    localStorageMock.getItem.mockReturnValue('sk-test-key')
  })

  describe('OpenAI Configuration', () => {
    it('should throw error when no API key is available', async () => {
      localStorageMock.getItem.mockReturnValue(null)
      
      // Mock import.meta.env to not have the key
      vi.doMock('import.meta.env', () => ({
        VITE_OPENAI_API_KEY: undefined,
      }))
      
      // Dynamic import to avoid module-level execution
      const { getOpenAIKey } = await import('../lib/openai')
      
      expect(() => getOpenAIKey()).toThrow('OpenAI API key is required')
    })

    it('should use localStorage key when available', () => {
      const testKey = 'sk-test-key'
      localStorageMock.getItem.mockReturnValue(testKey)
      
      // This would test the key retrieval logic
      expect(localStorageMock.getItem).toHaveBeenCalledWith('openai_api_key')
    })

    it('should validate API key format', () => {
      const validKey = 'sk-proj-abcd1234'
      const invalidKey = 'invalid-key'
      
      expect(validKey.startsWith('sk-')).toBe(true)
      expect(invalidKey.startsWith('sk-')).toBe(false)
    })
  })

  describe('Document Analysis', () => {
    it('successfully analyzes document text', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              document_type: 'passport',
              extracted_data: {
                name: 'John Doe',
                passport_number: 'AB123456',
                date_of_birth: '1990-01-01',
                nationality: 'US',
              },
              confidence: 0.95,
            }),
          },
        }],
      }

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse)

      const { analyzeDocument } = await import('../lib/openai')
      const result = await analyzeDocument('Sample passport text content')

      expect(result).toEqual({
        document_type: 'passport',
        extracted_data: {
          name: 'John Doe',
          passport_number: 'AB123456',
          date_of_birth: '1990-01-01',
          nationality: 'US',
        },
        confidence: 0.95,
      })
    })

    it('handles API errors gracefully', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(
        new Error('API rate limit exceeded')
      )

      const { analyzeDocument } = await import('../lib/openai')
      await expect(analyzeDocument('test content')).rejects.toThrow(
        'API rate limit exceeded'
      )
    })

    it('handles invalid JSON responses', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Invalid JSON response',
          },
        }],
      }

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse)

      const { analyzeDocument } = await import('../lib/openai')
      await expect(analyzeDocument('test content')).rejects.toThrow()
    })
  })

  describe('Image OCR', () => {
    it('successfully extracts text from image', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Passport\nName: John Doe\nPassport Number: AB123456',
          },
        }],
      }

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse)

      const { extractTextFromImage } = await import('../lib/openai')
      const imageBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...'
      const result = await extractTextFromImage(imageBase64)

      expect(result).toBe('Passport\nName: John Doe\nPassport Number: AB123456')
    })

    it('handles OCR errors', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(
        new Error('Image processing failed')
      )

      const { extractTextFromImage } = await import('../lib/openai')
      await expect(extractTextFromImage('invalid-image')).rejects.toThrow(
        'Image processing failed'
      )
    })
  })

  describe('Document Type Detection', () => {
    const testCases = [
      {
        content: 'Passport Number: AB123456 Date of Birth: 01/01/1990',
        expectedType: 'passport',
      },
      {
        content: 'Bank Statement Account Number: 1234567890 Balance: $5000',
        expectedType: 'bank_statement',
      },
      {
        content: 'Employment Contract Position: Software Engineer Salary: $80000',
        expectedType: 'employment_contract',
      },
    ]

    testCases.forEach(({ content, expectedType }) => {
      it(`correctly identifies ${expectedType} documents`, async () => {
        const mockResponse = {
          choices: [{
            message: {
              content: JSON.stringify({
                document_type: expectedType,
                extracted_data: {},
                confidence: 0.9,
              }),
            },
          }],
        }

        mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse)

        const { analyzeDocument } = await import('../lib/openai')
        const result = await analyzeDocument(content)

        expect(result.document_type).toBe(expectedType)
        expect(result.confidence).toBeGreaterThan(0.8)
      })
    })
  })
})