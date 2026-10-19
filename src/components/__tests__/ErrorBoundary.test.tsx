import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import ErrorBoundary from '../ErrorBoundary'

function BrokenChild() {
  throw new Error('test error')
}

function HealthyChild() {
  return <div data-testid="healthy">All good</div>
}

describe('ErrorBoundary', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <HealthyChild />
      </ErrorBoundary>,
    )

    expect(screen.getByTestId('healthy')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders fallback UI with 500 status, reference ID, and support link when a child throws', () => {
    render(
      <ErrorBoundary>
        <BrokenChild />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('500 error')).toBeInTheDocument()
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()

    const referenceIdNode = screen.getByText(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    expect(referenceIdNode).toBeInTheDocument()

    const supportLink = screen.getByRole('link', { name: /contact support/i })
    expect(supportLink).toHaveAttribute(
      'href',
      expect.stringContaining('mailto:support@disciplr.app'),
    )

    expect(
      screen.getByRole('button', { name: /refresh/i }),
    ).toBeInTheDocument()
  })

  it('invokes the custom onError prop when a child throws', () => {
    const onError = vi.fn()

    render(
      <ErrorBoundary onError={onError}>
        <BrokenChild />
      </ErrorBoundary>,
    )

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) }),
    )
  })

  it('falls back to console.error default reporter when no onError prop is given', () => {
    render(
      <ErrorBoundary>
        <BrokenChild />
      </ErrorBoundary>,
    )

    expect(consoleSpy).toHaveBeenCalledWith(
      '[ErrorBoundary]',
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) }),
    )
  })

  it('calls window.location.reload when the Refresh button is clicked', () => {
    const reload = vi.fn()
    const origLocation = window.location
    delete (window as any).location
    ;(window as any).location = { reload, href: origLocation.href } as Location

    render(
      <ErrorBoundary>
        <BrokenChild />
      </ErrorBoundary>,
    )

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))

    expect(reload).toHaveBeenCalledTimes(1)

    ;(window as any).location = origLocation
  })
})
