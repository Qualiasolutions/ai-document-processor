import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/test-utils'

// Simple test to verify setup
describe('Basic Test Setup', () => {
  it('renders a simple component', () => {
    const TestComponent = () => <div>Hello Testing World</div>
    
    render(<TestComponent />)
    
    expect(screen.getByText('Hello Testing World')).toBeInTheDocument()
  })

  it('can use testing library matchers', () => {
    expect(true).toBe(true)
    expect('hello').toContain('ell')
    expect([1, 2, 3]).toHaveLength(3)
  })

  it('can mock functions', () => {
    const mockFn = vi.fn()
    mockFn('test')
    
    expect(mockFn).toHaveBeenCalledWith('test')
    expect(mockFn).toHaveBeenCalledTimes(1)
  })
})