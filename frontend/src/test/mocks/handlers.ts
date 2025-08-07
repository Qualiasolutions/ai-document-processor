import { http, HttpResponse } from 'msw'
import { createMockDocument, createMockForm } from '../test-utils'

const SUPABASE_URL = 'https://qfldqwfpbabeonvryaof.supabase.co'

export const handlers = [
  // Document upload
  http.post(`${SUPABASE_URL}/functions/v1/document-upload`, async ({ request }) => {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return HttpResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    const mockDocument = createMockDocument({
      filename: file.name,
      file_size: file.size,
      file_type: file.type,
      status: 'processing',
    })

    return HttpResponse.json({
      success: true,
      document: mockDocument,
      message: 'File uploaded successfully',
    })
  }),

  // Document processing
  http.post(`${SUPABASE_URL}/functions/v1/ai-document-analysis`, async ({ request }) => {
    const body = await request.json()
    const { document_id } = body

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100))

    return HttpResponse.json({
      success: true,
      extracted_data: {
        name: 'John Doe',
        passport_number: 'AB123456',
        date_of_birth: '1990-01-01',
        nationality: 'US',
      },
      document_type: 'passport',
      confidence: 0.95,
    })
  }),

  // Form generation
  http.post(`${SUPABASE_URL}/functions/v1/form-generation`, async ({ request }) => {
    const body = await request.json()
    const { extracted_data, form_type } = body

    const mockForm = createMockForm({
      form_type,
      form_data: extracted_data,
      status: 'generated',
    })

    return HttpResponse.json({
      success: true,
      form: mockForm,
    })
  }),

  // Supabase REST API - Documents
  http.get(`${SUPABASE_URL}/rest/v1/documents`, () => {
    const mockDocuments = [
      createMockDocument({ id: '1', filename: 'passport.pdf', status: 'completed' }),
      createMockDocument({ id: '2', filename: 'bank-statement.pdf', status: 'processing' }),
    ]

    return HttpResponse.json(mockDocuments, {
      headers: {
        'Content-Range': '0-1/2',
      },
    })
  }),

  http.post(`${SUPABASE_URL}/rest/v1/documents`, async ({ request }) => {
    const body = await request.json()
    const mockDocument = createMockDocument(body)

    return HttpResponse.json(mockDocument, { status: 201 })
  }),

  // Supabase REST API - Forms
  http.get(`${SUPABASE_URL}/rest/v1/generated_forms`, () => {
    const mockForms = [
      createMockForm({ id: '1', title: 'Visa Application Form', status: 'completed' }),
      createMockForm({ id: '2', title: 'Employment Form', status: 'draft' }),
    ]

    return HttpResponse.json(mockForms, {
      headers: {
        'Content-Range': '0-1/2',
      },
    })
  }),

  // Supabase Storage API
  http.post(`${SUPABASE_URL}/storage/v1/object/documents/*`, async ({ request }) => {
    const url = new URL(request.url)
    const pathname = url.pathname.replace('/storage/v1/object/documents/', '')

    return HttpResponse.json({
      Key: `documents/${pathname}`,
      Id: 'mock-upload-id',
    })
  }),

  // Error handlers
  http.post(`${SUPABASE_URL}/functions/v1/document-upload-error`, () => {
    return HttpResponse.json(
      { error: 'Upload failed', details: 'Network error' },
      { status: 500 }
    )
  }),
]

// Error simulation helpers
export const simulateNetworkError = () => {
  return HttpResponse.error()
}

export const simulateServerError = (message = 'Internal server error') => {
  return HttpResponse.json(
    { error: message },
    { status: 500 }
  )
}

export const simulateAuthError = () => {
  return HttpResponse.json(
    { error: 'Unauthorized' },
    { status: 401 }
  )
}