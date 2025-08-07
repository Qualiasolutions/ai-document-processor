import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import { FormGenerator } from '@/components/FormGenerator'
import { createMockForm } from '@/test/test-utils'

const mockFormData = {
  id: 'form-123',
  title: 'Visa Application Form',
  form_type: 'visa-application',
  form_data: {
    personal_info: {
      full_name: 'John Doe',
      date_of_birth: '1990-01-01',
      passport_number: 'AB123456',
      nationality: 'US',
    },
    travel_info: {
      destination: 'France',
      purpose: 'Tourism',
      duration: '7 days',
    },
  },
  status: 'generated',
  created_at: new Date().toISOString(),
  document_id: 'doc-123',
}

describe('FormGenerator Component', () => {
  const defaultProps = {
    form: {
      id: mockFormData.id,
      template: {
        name: mockFormData.title,
        fields: [
          { name: 'full_name', label: 'Full Name', type: 'text', required: true },
          { name: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
          { name: 'passport_number', label: 'Passport Number', type: 'text', required: true },
          { name: 'nationality', label: 'Nationality', type: 'text', required: true },
          { name: 'destination', label: 'Destination', type: 'text', required: true },
          { name: 'purpose', label: 'Purpose', type: 'text', required: false },
          { name: 'duration', label: 'Duration', type: 'text', required: false }
        ]
      },
      data: {
        full_name: mockFormData.form_data.personal_info.full_name,
        date_of_birth: mockFormData.form_data.personal_info.date_of_birth,
        passport_number: mockFormData.form_data.personal_info.passport_number,
        nationality: mockFormData.form_data.personal_info.nationality,
        destination: mockFormData.form_data.travel_info.destination,
        purpose: mockFormData.form_data.travel_info.purpose,
        duration: mockFormData.form_data.travel_info.duration
      },
      formType: 'visa_application' as const
    },
    onFormChange: vi.fn(),
    onExport: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders form with extracted data', () => {
    render(<FormGenerator {...defaultProps} />)
    
    expect(screen.getByText(/visa application form/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue(/john doe/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue(/ab123456/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue(/france/i)).toBeInTheDocument()
  })

  it('renders form field labels', () => {
    render(<FormGenerator {...defaultProps} />)
    
    expect(screen.getByText(/full name/i)).toBeInTheDocument()
    expect(screen.getByText(/passport number/i)).toBeInTheDocument()
    expect(screen.getByText(/destination/i)).toBeInTheDocument()
  })

  it('allows editing field values', async () => {
    const user = userEvent.setup()
    render(<FormGenerator {...defaultProps} />)
    
    const nameField = screen.getByDisplayValue(/john doe/i)
    await user.clear(nameField)
    await user.type(nameField, 'Jane Smith')
    
    expect(nameField).toHaveValue('Jane Smith')
  })

  it('validates required fields', async () => {
    const user = userEvent.setup()
    render(<FormGenerator {...defaultProps} />)
    
    const nameField = screen.getByDisplayValue(/john doe/i)
    await user.clear(nameField)
    
    const saveButton = screen.getByText(/save.*form/i)
    await user.click(saveButton)
    
    expect(screen.getByText(/full name.*required/i)).toBeInTheDocument()
  })

  it('saves form data when valid', async () => {
    const user = userEvent.setup()
    render(<FormGenerator {...defaultProps} />)
    
    const saveButton = screen.getByText(/save.*form/i)
    await user.click(saveButton)
    
    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          form_data: expect.objectContaining({
            personal_info: expect.objectContaining({
              full_name: 'John Doe',
            }),
          }),
        })
      )
    })
  })

  it('exports form in different formats', async () => {
    const user = userEvent.setup()
    render(<FormGenerator {...defaultProps} />)
    
    const exportButton = screen.getByText(/export/i)
    await user.click(exportButton)
    
    const pdfOption = screen.getByText(/pdf/i)
    await user.click(pdfOption)
    
    expect(defaultProps.onExport).toHaveBeenCalledWith('pdf')
  })

  it('shows unsaved changes warning', async () => {
    const user = userEvent.setup()
    render(<FormGenerator {...defaultProps} />)
    
    const nameField = screen.getByDisplayValue(/john doe/i)
    await user.type(nameField, ' Modified')
    
    const closeButton = screen.getByText(/close/i)
    await user.click(closeButton)
    
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument()
  })

  it('handles form submission errors', async () => {
    const user = userEvent.setup()
    const onSaveWithError = vi.fn().mockRejectedValue(new Error('Save failed'))
    
    render(<FormGenerator {...defaultProps} onSave={onSaveWithError} />)
    
    const saveButton = screen.getByText(/save.*form/i)
    await user.click(saveButton)
    
    await waitFor(() => {
      expect(screen.getByText(/failed to save/i)).toBeInTheDocument()
    })
  })

  it('displays field help text', () => {
    render(<FormGenerator {...defaultProps} />)
    
    const passportField = screen.getByDisplayValue(/ab123456/i)
    expect(passportField.closest('.field-container')).toHaveTextContent(/passport number/i)
  })

  it('supports different field types', () => {
    const formWithMixedFields = {
      ...mockFormData,
      form_data: {
        text_field: 'Text value',
        number_field: 123,
        date_field: '2024-01-01',
        boolean_field: true,
        select_field: 'option1',
      }
    }
    
    render(<FormGenerator {...defaultProps} formData={formWithMixedFields} />)
    
    expect(screen.getByDisplayValue('Text value')).toBeInTheDocument()
    expect(screen.getByDisplayValue('123')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2024-01-01')).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('auto-saves form data', async () => {
    const user = userEvent.setup()
    render(<FormGenerator {...defaultProps} />)
    
    const nameField = screen.getByDisplayValue(/john doe/i)
    await user.type(nameField, ' Modified')
    
    // Wait for auto-save delay
    await waitFor(() => {
      expect(screen.getByText(/auto.*saved/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('shows form completion status', () => {
    const completeForm = {
      ...mockFormData,
      completion_percentage: 85,
    }
    
    render(<FormGenerator {...defaultProps} formData={completeForm} />)
    
    expect(screen.getByText(/85%.*complete/i)).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('handles form template switching', async () => {
    const user = userEvent.setup()
    render(<FormGenerator {...defaultProps} />)
    
    const templateSelect = screen.getByLabelText(/form.*template/i)
    await user.selectOptions(templateSelect, 'employment-form')
    
    expect(screen.getByText(/employment.*form/i)).toBeInTheDocument()
  })

  it('supports form field reordering', async () => {
    const user = userEvent.setup()
    render(<FormGenerator {...defaultProps} />)
    
    const dragHandle = screen.getByText(/⋮⋮/i) // Drag handle icon
    const targetPosition = screen.getByText(/travel information/i)
    
    // Simulate drag and drop
    await user.pointer([
      { keys: '[MouseLeft>]', target: dragHandle },
      { pointerName: 'mouse', target: targetPosition },
      { keys: '[/MouseLeft]' },
    ])
    
    // Verify field order changed
    expect(screen.getByText(/field.*moved/i)).toBeInTheDocument()
  })

  it('validates field formats', async () => {
    const user = userEvent.setup()
    render(<FormGenerator {...defaultProps} />)
    
    const passportField = screen.getByDisplayValue(/ab123456/i)
    await user.clear(passportField)
    await user.type(passportField, 'invalid-format')
    
    const saveButton = screen.getByText(/save.*form/i)
    await user.click(saveButton)
    
    expect(screen.getByText(/invalid.*passport.*format/i)).toBeInTheDocument()
  })

  it('shows form history and versions', async () => {
    const user = userEvent.setup()
    render(<FormGenerator {...defaultProps} />)
    
    const historyButton = screen.getByText(/history/i)
    await user.click(historyButton)
    
    expect(screen.getByText(/form.*versions/i)).toBeInTheDocument()
    expect(screen.getByText(/version.*1/i)).toBeInTheDocument()
  })
})