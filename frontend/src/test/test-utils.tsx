import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { Toaster } from 'react-hot-toast'

// Create a custom render function that includes all providers
interface AllTheProvidersProps {
  children: React.ReactNode
}

function AllTheProviders({ children }: AllTheProvidersProps) {
  // Create a new QueryClient for each test to ensure isolation
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Turn off retries for tests
        retry: false,
        // Set cache time to 0 for tests
        gcTime: 0,
      },
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          {children}
          <Toaster position="top-right" />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }

// Test data factories
export const createMockDocument = (overrides = {}) => ({
  id: 'doc-123',
  filename: 'test-document.pdf',
  file_size: 1024000,
  file_type: 'application/pdf',
  status: 'pending',
  processing_status: null,
  extracted_content: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
})

export const createMockForm = (overrides = {}) => ({
  id: 'form-123',
  title: 'Test Form',
  form_type: 'visa-application',
  status: 'draft',
  created_at: new Date().toISOString(),
  document_id: 'doc-123',
  form_data: {},
  ...overrides,
})

export const createMockUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
})

// Utility to wait for async operations
export const waitForLoadingToFinish = () => 
  screen.findByText((content, element) => {
    if (!element) return false
    return !element.className?.includes('loading') && 
           !element.className?.includes('spinner')
  }, {}, { timeout: 3000 })

// Mock file creation utility
export const createMockFile = (
  name = 'test.pdf',
  size = 1024,
  type = 'application/pdf'
): File => {
  const file = new File(['test content'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

// Supabase mock utilities
export const mockSupabaseResponse = (data: any, error: any = null) => ({
  data,
  error,
})

export const mockSupabaseAuth = {
  getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
  signIn: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChange: vi.fn().mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  }),
}

// Import required for re-export
import { screen } from '@testing-library/react'
import { vi } from 'vitest'