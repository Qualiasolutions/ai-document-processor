import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import { DocumentProcessor } from '@/components/DocumentProcessor'
import { createMockFile, createMockDocument, createMockForm } from '@/test/test-utils'
import { server } from '@/test/mocks/server'
import { http, HttpResponse } from 'msw'

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      then: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: { path: 'anonymous/test.pdf' }, error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'http://example.com/test.pdf' } }),
      }))
    },
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null })
    },
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null })
    }
  }
}))

describe('DocumentProcessor Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the main interface correctly', () => {
    render(<DocumentProcessor />)
    
    expect(screen.getByText(/ai document processor/i)).toBeInTheDocument()
    expect(screen.getByText(/upload.*document/i)).toBeInTheDocument()
    expect(screen.getByText(/recent.*document/i)).toBeInTheDocument()
    expect(screen.getByText(/generated.*form/i)).toBeInTheDocument()
  })

  it('displays empty state when no documents exist', () => {
    render(<DocumentProcessor />)
    
    expect(screen.getByText(/no documents uploaded/i)).toBeInTheDocument()
    expect(screen.getByText(/upload your first document/i)).toBeInTheDocument()
  })

  it('handles file upload successfully', async () => {
    const user = userEvent.setup()
    render(<DocumentProcessor />)
    
    const fileInput = screen.getByLabelText(/choose files/i)
    const file = createMockFile('passport.pdf', 1024, 'application/pdf')
    
    await user.upload(fileInput, file)
    
    await waitFor(() => {
      expect(screen.getByText(/processing/i)).toBeInTheDocument()
    })
  })

  it('shows upload progress during file processing', async () => {
    const user = userEvent.setup()
    render(<DocumentProcessor />)
    
    const fileInput = screen.getByLabelText(/choose files/i)
    const file = createMockFile('passport.pdf', 1024, 'application/pdf')
    
    await user.upload(fileInput, file)
    
    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })
  })

  it('displays error message for failed uploads', async () => {
    // Mock upload failure
    server.use(
      http.post('*/functions/v1/document-upload', () => {
        return HttpResponse.json(
          { error: 'Upload failed' },
          { status: 500 }
        )
      })
    )

    const user = userEvent.setup()
    render(<DocumentProcessor />)
    
    const fileInput = screen.getByLabelText(/choose files/i)
    const file = createMockFile('passport.pdf', 1024, 'application/pdf')
    
    await user.upload(fileInput, file)
    
    await waitFor(() => {
      expect(screen.getByText(/upload failed/i)).toBeInTheDocument()
    })
  })

  it('processes document with AI and shows extracted data', async () => {
    const user = userEvent.setup()
    render(<DocumentProcessor />)
    
    const fileInput = screen.getByLabelText(/choose files/i)
    const file = createMockFile('passport.pdf', 1024, 'application/pdf')
    
    await user.upload(fileInput, file)
    
    // Wait for AI processing to complete
    await waitFor(() => {
      expect(screen.getByText(/john doe/i)).toBeInTheDocument()
      expect(screen.getByText(/ab123456/i)).toBeInTheDocument()
    }, { timeout: 5000 })
  })

  it('generates form from extracted data', async () => {
    const user = userEvent.setup()
    render(<DocumentProcessor />)
    
    const fileInput = screen.getByLabelText(/choose files/i)
    const file = createMockFile('passport.pdf', 1024, 'application/pdf')
    
    await user.upload(fileInput, file)
    
    // Wait for processing and form generation
    await waitFor(() => {
      expect(screen.getByText(/generate.*form/i)).toBeInTheDocument()
    })
    
    const generateButton = screen.getByText(/generate.*form/i)
    await user.click(generateButton)
    
    await waitFor(() => {
      expect(screen.getByText(/form.*generated/i)).toBeInTheDocument()
    })
  })

  it('displays document list with status indicators', async () => {
    render(<DocumentProcessor />)
    
    await waitFor(() => {
      expect(screen.getByText(/passport\.pdf/i)).toBeInTheDocument()
      expect(screen.getByText(/completed/i)).toBeInTheDocument()
      expect(screen.getByText(/processing/i)).toBeInTheDocument()
    })
  })

  it('allows filtering documents by status', async () => {
    const user = userEvent.setup()
    render(<DocumentProcessor />)
    
    const statusFilter = screen.getByLabelText(/filter.*status/i)
    await user.selectOptions(statusFilter, 'completed')
    
    await waitFor(() => {
      expect(screen.getByText(/passport\.pdf/i)).toBeInTheDocument()
      expect(screen.queryByText(/bank-statement\.pdf/i)).not.toBeInTheDocument()
    })
  })

  it('opens document details modal', async () => {
    const user = userEvent.setup()
    render(<DocumentProcessor />)
    
    await waitFor(() => {
      const documentCard = screen.getByText(/passport\.pdf/i)
      expect(documentCard).toBeInTheDocument()
    })
    
    const viewButton = screen.getByText(/view.*detail/i)
    await user.click(viewButton)
    
    expect(screen.getByText(/document.*detail/i)).toBeInTheDocument()
    expect(screen.getByText(/extracted.*data/i)).toBeInTheDocument()
  })

  it('handles document deletion', async () => {
    const user = userEvent.setup()
    render(<DocumentProcessor />)
    
    await waitFor(() => {
      const deleteButton = screen.getByText(/delete/i)
      expect(deleteButton).toBeInTheDocument()
    })
    
    const deleteButton = screen.getByText(/delete/i)
    await user.click(deleteButton)
    
    // Confirm deletion
    const confirmButton = screen.getByText(/confirm/i)
    await user.click(confirmButton)
    
    await waitFor(() => {
      expect(screen.getByText(/document.*deleted/i)).toBeInTheDocument()
    })
  })

  it('exports generated forms', async () => {
    const user = userEvent.setup()
    render(<DocumentProcessor />)
    
    await waitFor(() => {
      const exportButton = screen.getByText(/export/i)
      expect(exportButton).toBeInTheDocument()
    })
    
    const exportButton = screen.getByText(/export/i)
    await user.click(exportButton)
    
    const pdfExport = screen.getByText(/export.*pdf/i)
    await user.click(pdfExport)
    
    await waitFor(() => {
      expect(screen.getByText(/export.*successful/i)).toBeInTheDocument()
    })
  })

  it('retries failed operations', async () => {
    const user = userEvent.setup()
    
    // Mock initial failure
    server.use(
      http.post('*/functions/v1/ai-document-analysis', () => {
        return HttpResponse.json(
          { error: 'Processing failed' },
          { status: 500 }
        )
      })
    )
    
    render(<DocumentProcessor />)
    
    const fileInput = screen.getByLabelText(/choose files/i)
    const file = createMockFile('passport.pdf', 1024, 'application/pdf')
    
    await user.upload(fileInput, file)
    
    await waitFor(() => {
      expect(screen.getByText(/processing.*failed/i)).toBeInTheDocument()
    })
    
    // Reset handler to success
    server.resetHandlers()
    
    const retryButton = screen.getByText(/retry/i)
    await user.click(retryButton)
    
    await waitFor(() => {
      expect(screen.getByText(/processing/i)).toBeInTheDocument()
    })
  })

  it('validates file types before upload', async () => {
    const user = userEvent.setup()
    render(<DocumentProcessor />)
    
    const fileInput = screen.getByLabelText(/choose files/i)
    const invalidFile = createMockFile('test.exe', 1024, 'application/exe')
    
    await user.upload(fileInput, invalidFile)
    
    expect(screen.getByText(/file type.*not supported/i)).toBeInTheDocument()
  })

  it('handles large file size validation', async () => {
    const user = userEvent.setup()
    render(<DocumentProcessor />)
    
    const fileInput = screen.getByLabelText(/choose files/i)
    const largeFile = createMockFile('large.pdf', 50 * 1024 * 1024, 'application/pdf') // 50MB
    
    await user.upload(fileInput, largeFile)
    
    expect(screen.getByText(/file.*too large/i)).toBeInTheDocument()
  })
})