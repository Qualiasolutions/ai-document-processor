# Testing Guide

This document provides comprehensive information about the testing setup and best practices for the Respect Services AI Document Processor.

## Overview

Our testing setup uses:
- **Vitest** - Fast unit test runner built on Vite
- **React Testing Library** - Testing utilities for React components
- **MSW (Mock Service Worker)** - API mocking at the network level
- **User Event** - Simulation of user interactions

## Testing Stack

### Core Dependencies
```json
{
  "@testing-library/react": "^16.3.0",
  "@testing-library/dom": "^10.4.1", 
  "@testing-library/jest-dom": "^6.6.4",
  "@testing-library/user-event": "^14.6.1",
  "msw": "^2.10.4",
  "vitest": "^2.1.8"
}
```

### Configuration Files
- `vitest.config.ts` - Main Vitest configuration
- `src/test/setup.ts` - Global test setup and mocks
- `src/test/test-utils.tsx` - Custom render function and utilities
- `src/test/mocks/` - MSW handlers and server setup

## File Structure

```
src/test/
├── README.md                    # This documentation
├── setup.ts                     # Global test setup
├── test-utils.tsx              # Custom render and utilities
├── mocks/
│   ├── handlers.ts             # MSW API handlers
│   └── server.ts               # MSW server setup
├── FileUpload.test.tsx         # Component tests
├── DocumentProcessor.test.tsx  # Integration tests
├── FormGenerator.test.tsx      # Form component tests
└── openai.test.ts             # API integration tests
```

## Running Tests

### Basic Commands
```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests once (CI mode)
npm run test:run

# Generate coverage report
npm run test:coverage
```

### Test Filtering
```bash
# Run specific test file
npm run test FileUpload

# Run tests matching pattern
npm run test DocumentProcessor

# Run tests in specific directory
npm run test src/test/
```

## Writing Tests

### Component Testing Best Practices

#### 1. Use Custom Render Function
```tsx
import { render, screen } from '@/test/test-utils'

// This provides all necessary providers (Router, Query, Auth)
render(<YourComponent />)
```

#### 2. Test User Interactions
```tsx
import userEvent from '@testing-library/user-event'

test('handles file upload', async () => {
  const user = userEvent.setup()
  render(<FileUpload onFileSelect={mockFn} />)
  
  const fileInput = screen.getByLabelText(/choose files/i)
  const file = createMockFile('test.pdf')
  
  await user.upload(fileInput, file)
  
  expect(mockFn).toHaveBeenCalledWith([file])
})
```

#### 3. Wait for Async Operations
```tsx
import { waitFor } from '@testing-library/react'

test('shows loading state', async () => {
  render(<AsyncComponent />)
  
  await waitFor(() => {
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })
})
```

### API Testing with MSW

#### 1. Mock API Responses
```tsx
// In your test file
import { server } from '@/test/mocks/server'
import { http, HttpResponse } from 'msw'

test('handles API error', async () => {
  server.use(
    http.post('/api/upload', () => {
      return HttpResponse.json(
        { error: 'Upload failed' },
        { status: 500 }
      )
    })
  )
  
  // Test error handling
})
```

#### 2. Verify API Calls
```tsx
test('makes correct API call', async () => {
  const mockFetch = vi.fn()
  global.fetch = mockFetch
  
  await uploadDocument(file)
  
  expect(mockFetch).toHaveBeenCalledWith(
    '/api/upload',
    expect.objectContaining({
      method: 'POST',
      body: expect.any(FormData)
    })
  )
})
```

### Testing Utilities

#### Mock Data Factories
```tsx
import { createMockDocument, createMockFile } from '@/test/test-utils'

const document = createMockDocument({
  filename: 'custom.pdf',
  status: 'completed'
})

const file = createMockFile('test.pdf', 1024, 'application/pdf')
```

#### Supabase Mocking
```tsx
// Supabase is automatically mocked in test-utils.tsx
// Override specific methods as needed:

vi.mocked(supabase.from).mockReturnValue({
  select: vi.fn().mockResolvedValue({ data: mockData, error: null })
})
```

## Test Categories

### Unit Tests
- Individual component behavior
- Utility functions
- Business logic
- API integration functions

### Integration Tests
- Component interactions
- Data flow between components
- API + UI integration
- Form submission workflows

### User Journey Tests
- Complete user workflows
- File upload → processing → form generation
- Error handling scenarios
- Edge cases and validation

## Mocking Strategy

### 1. External Dependencies
```tsx
// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabaseClient
}))

// Mock OpenAI
vi.mock('openai', () => ({
  default: MockOpenAI
}))
```

### 2. Browser APIs
```tsx
// File Reader
global.FileReader = vi.fn(() => mockFileReader)

// Match Media
Object.defineProperty(window, 'matchMedia', {
  value: vi.fn().mockImplementation(mockMatchMedia)
})
```

### 3. React Router
```tsx
// Automatic via test-utils.tsx BrowserRouter wrapper
// Override for specific route testing:
render(<Component />, { 
  wrapper: ({ children }) => (
    <MemoryRouter initialEntries={['/specific-route']}>
      {children}
    </MemoryRouter>
  )
})
```

## Coverage Guidelines

### Target Coverage
- **Statements**: ≥ 80%
- **Branches**: ≥ 75% 
- **Functions**: ≥ 80%
- **Lines**: ≥ 80%

### Coverage Exclusions
- Configuration files
- Test files themselves
- Type definitions
- Third-party integrations (mocked)

### Viewing Coverage
```bash
npm run test:coverage
open coverage/index.html
```

## Performance Testing

### Measuring Component Performance
```tsx
import { screen } from '@testing-library/react'

test('renders efficiently', async () => {
  const startTime = performance.now()
  
  render(<LargeComponent data={largeDataSet} />)
  
  await waitFor(() => {
    expect(screen.getByText(/rendered/i)).toBeInTheDocument()
  })
  
  const endTime = performance.now()
  expect(endTime - startTime).toBeLessThan(1000) // 1 second
})
```

### Memory Leak Detection
```tsx
test('cleans up properly', () => {
  const { unmount } = render(<Component />)
  
  // Simulate component lifecycle
  unmount()
  
  // Verify cleanup (specific to your component logic)
  expect(globalEventListeners).toHaveLength(0)
})
```

## Debugging Tests

### Common Issues

#### 1. Tests Not Finding Elements
```tsx
// Use debug to see what's rendered
import { render, screen } from '@testing-library/react'

render(<Component />)
screen.debug() // Prints DOM to console
```

#### 2. Async Operations Not Completing
```tsx
// Increase timeout for slow operations
await waitFor(() => {
  expect(element).toBeInTheDocument()
}, { timeout: 5000 })
```

#### 3. Mock Not Working
```tsx
// Verify mock is applied
console.log(vi.isMockFunction(mockFunction)) // Should be true
```

### Test-Specific Debugging
```tsx
// Add test-specific console logs
test('debug test', () => {
  console.log('Test environment:', process.env.NODE_ENV)
  console.log('Mock status:', vi.isMockFunction(mockFn))
})
```

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Run Tests
  run: |
    npm run test:coverage
    npm run test:run
    
- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    file: ./coverage/lcov.info
```

### Quality Gates
- All tests must pass
- Coverage thresholds must be met
- No test files should be skipped
- Linting must pass

## Best Practices

### 1. Test Structure
```tsx
describe('Component Name', () => {
  beforeEach(() => {
    // Setup common to all tests
  })
  
  describe('when condition', () => {
    it('should behave correctly', () => {
      // Test implementation
    })
  })
})
```

### 2. Descriptive Test Names
```tsx
// ❌ Bad
test('upload works')

// ✅ Good  
test('shows success message after successful file upload')
```

### 3. Single Responsibility
```tsx
// ❌ Bad - testing multiple things
test('handles upload and validation and error display', () => {
  // Too much in one test
})

// ✅ Good - single responsibility
test('validates file type before upload', () => {
  // Single concern
})
```

### 4. Avoid Implementation Details
```tsx
// ❌ Bad - testing implementation
expect(component.state.isLoading).toBe(true)

// ✅ Good - testing behavior
expect(screen.getByText(/loading/i)).toBeInTheDocument()
```

### 5. Use Semantic Queries
```tsx
// ❌ Avoid
screen.getByTestId('submit-button')

// ✅ Prefer
screen.getByRole('button', { name: /submit/i })
screen.getByLabelText(/email address/i)
```

## Troubleshooting

### Common Test Failures

#### 1. "act" Warnings
```tsx
// Wrap state updates in act()
import { act } from '@testing-library/react'

await act(async () => {
  await user.click(button)
})
```

#### 2. Unhandled Promise Rejections
```tsx
// Ensure all async operations are awaited
await waitFor(() => {
  expect(element).toBeInTheDocument()
})
```

#### 3. Timer Issues
```tsx
// Use fake timers for time-dependent tests
beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})
```

### Getting Help

1. Check console output for detailed error messages
2. Use `screen.debug()` to inspect rendered DOM
3. Verify mocks are properly set up
4. Check async operations are properly awaited
5. Review React Testing Library documentation
6. Use Vitest's built-in debugging tools

## Resources

- [React Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro/)
- [Vitest Documentation](https://vitest.dev/)
- [MSW Documentation](https://mswjs.io/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)