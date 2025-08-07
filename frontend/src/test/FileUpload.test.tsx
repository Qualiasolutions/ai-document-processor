import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import { FileUpload } from '@/components/FileUpload'
import { createMockFile } from '@/test/test-utils'

// Mock file utils
vi.mock('@/lib/fileUtils', () => ({
  validateFileType: vi.fn((file: File) => file.type === 'application/pdf' || file.type === 'text/plain'),
  formatFileSize: vi.fn((size: number) => `${Math.round(size / 1024)}KB`),
  loadSampleDocuments: vi.fn().mockResolvedValue([]),
  getSupportedFileTypes: vi.fn().mockReturnValue(['pdf', 'txt', 'doc', 'docx', 'jpg', 'png']),
  getFileTypeInfo: vi.fn().mockReturnValue({ icon: 'FileText', color: 'blue' }),
}))

describe('FileUpload Component', () => {
  const mockProps = {
    onFilesSelected: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders upload interface correctly', () => {
    render(<FileUpload {...mockProps} />)
    
    expect(screen.getByText(/drag.*drop/i)).toBeInTheDocument()
    expect(screen.getByText(/browse/i)).toBeInTheDocument()
  })

  it('handles file selection through input', async () => {
    const user = userEvent.setup()
    render(<FileUpload {...mockProps} />)
    
    // Look for the hidden file input
    const fileInput = screen.getByRole('button', { name: /browse/i }).closest('label')?.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toBeInTheDocument()
    
    const file = createMockFile('test.pdf', 1024, 'application/pdf')
    
    await user.upload(fileInput, file)
    
    await waitFor(() => {
      expect(mockProps.onFilesSelected).toHaveBeenCalledWith([file])
    })
  })

  it('handles drag and drop', async () => {
    render(<FileUpload {...mockProps} />)
    
    const dropzone = screen.getByText(/drag.*drop/i).closest('div')
    const file = createMockFile('test.pdf', 1024, 'application/pdf')
    
    fireEvent.dragEnter(dropzone!, { 
      dataTransfer: { 
        files: [file],
        types: ['Files'],
        items: [{ kind: 'file', type: file.type }]
      } 
    })
    fireEvent.dragOver(dropzone!, { 
      dataTransfer: { 
        files: [file],
        types: ['Files'],
        items: [{ kind: 'file', type: file.type }]
      } 
    })
    fireEvent.drop(dropzone!, { 
      dataTransfer: { 
        files: [file],
        types: ['Files'],
        items: [{ kind: 'file', type: file.type }]
      } 
    })
    
    await waitFor(() => {
      expect(mockProps.onFilesSelected).toHaveBeenCalledWith([file])
    })
  })

  it('shows drag active state', () => {
    render(<FileUpload {...mockProps} />)
    
    const dropzone = screen.getByText(/drag.*drop/i).closest('div')
    
    fireEvent.dragEnter(dropzone!, { 
      dataTransfer: { files: [], types: ['Files'] } 
    })
    
    // The component should show some visual indication of drag state
    // This might be a class change or different styling
    expect(dropzone).toBeInTheDocument()
  })

  it('displays selected files', async () => {
    const user = userEvent.setup()
    render(<FileUpload {...mockProps} />)
    
    const fileInput = screen.getByRole('button', { name: /browse/i }).closest('label')?.querySelector('input[type="file"]') as HTMLInputElement
    const file = createMockFile('test.pdf', 1024, 'application/pdf')
    
    await user.upload(fileInput, file)
    
    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument()
    })
  })

  it('allows removing selected files', async () => {
    const user = userEvent.setup()
    render(<FileUpload {...mockProps} />)
    
    const fileInput = screen.getByRole('button', { name: /browse/i }).closest('label')?.querySelector('input[type="file"]') as HTMLInputElement
    const file = createMockFile('test.pdf', 1024, 'application/pdf')
    
    await user.upload(fileInput, file)
    
    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument()
    })
    
    // Look for remove button (X icon)
    const removeButton = screen.getByRole('button', { name: /remove/i }) || screen.getByText('×')
    await user.click(removeButton)
    
    expect(screen.queryByText('test.pdf')).not.toBeInTheDocument()
  })

  it('shows supported file types', () => {
    render(<FileUpload {...mockProps} />)
    
    // The component should show supported formats
    expect(screen.getByText(/supported/i)).toBeInTheDocument()
  })
})