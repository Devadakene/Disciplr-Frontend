import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import ErrorBoundary from '../ErrorBoundary'
import {
  resetErrorReportSink,
  resetErrorReporterForTests,
  setErrorReportSink,
  type ErrorReport,
} from '../../utils/errorReporter'

function BrokenChild() {
  throw new Error('test error')
}

function HealthyChild() {
  return <div data-testid="healthy">All good</div>
}

/** Throws on every render — used to prove a repeated crash cannot loop. */
function AlwaysBroken() {
  throw new Error('always broken')
}

/** Throws only while `broken` is true. */
function MaybeBroken({ broken }: { broken: boolean }) {
  if (broken) throw new Error('maybe broken')
  return <div data-testid="recovered">Recovered</div>
}

describe('ErrorBoundary', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    resetErrorReporterForTests()
  })

  afterEach(() => {
    consoleSpy.mockRestore()
    resetErrorReporterForTests()
    resetErrorReportSink()
    vi.unstubAllGlobals()
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
    expect(
      screen.getByText(/We couldn't complete that request/),
    ).toBeInTheDocument()

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
    expect(consoleSpy).not.toHaveBeenCalledWith(
      '[ErrorBoundary]',
      expect.anything(),
      expect.anything(),
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

  describe('recovery and reporting', () => {
    it('"Try again" re-renders the children and recovers without a reload', () => {
      let broken = true
      function Flaky() {
        if (broken) throw new Error('transient failure')
        return <div data-testid="recovered">Recovered</div>
      }

      const onReset = vi.fn()
      render(
        <ErrorBoundary onReset={onReset}>
          <Flaky />
        </ErrorBoundary>,
      )

      expect(screen.getByRole('alert')).toBeInTheDocument()

      // The underlying cause is gone by the time the user retries.
      broken = false
      fireEvent.click(screen.getByRole('button', { name: /try again/i }))

      expect(onReset).toHaveBeenCalledTimes(1)
      expect(screen.getByTestId('recovered')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('resets when a resetKeys entry changes', () => {
      const onReset = vi.fn()
      const { rerender } = render(
        <ErrorBoundary resetKeys={['/a']} onReset={onReset}>
          <MaybeBroken broken />
        </ErrorBoundary>,
      )
      expect(screen.getByRole('alert')).toBeInTheDocument()

      rerender(
        <ErrorBoundary resetKeys={['/b']} onReset={onReset}>
          <MaybeBroken broken={false} />
        </ErrorBoundary>,
      )

      expect(onReset).toHaveBeenCalledTimes(1)
      expect(screen.getByTestId('recovered')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('keeps the fallback when resetKeys are shallow-equal', () => {
      const { rerender } = render(
        <ErrorBoundary resetKeys={['/a']}>
          <MaybeBroken broken />
        </ErrorBoundary>,
      )

      rerender(
        <ErrorBoundary resetKeys={['/a']}>
          <MaybeBroken broken={false} />
        </ErrorBoundary>,
      )

      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.queryByTestId('recovered')).toBeNull()
    })

    it('caps automatic resets but never caps the manual "Try again"', () => {
      const onReset = vi.fn()
      // Mirrors AUTO_RESET_LIMIT in ErrorBoundary.tsx, hard-coded by convention.
      const autoResetLimit = 3

      const { rerender } = render(
        <ErrorBoundary resetKeys={[0]} onReset={onReset}>
          <AlwaysBroken />
        </ErrorBoundary>,
      )
      expect(screen.getByRole('alert')).toBeInTheDocument()

      for (let index = 1; index <= autoResetLimit; index += 1) {
        rerender(
          <ErrorBoundary resetKeys={[index]} onReset={onReset}>
            <AlwaysBroken />
          </ErrorBoundary>,
        )
      }
      expect(onReset).toHaveBeenCalledTimes(autoResetLimit)

      // The cap is reached: a further key change must not attempt another
      // reset, otherwise a page that crashes instantly would loop forever.
      rerender(
        <ErrorBoundary resetKeys={[autoResetLimit + 1]} onReset={onReset}>
          <AlwaysBroken />
        </ErrorBoundary>,
      )
      expect(onReset).toHaveBeenCalledTimes(autoResetLimit)
      expect(screen.getByRole('alert')).toBeInTheDocument()

      // The user can always retry by hand.
      fireEvent.click(screen.getByRole('button', { name: /try again/i }))
      expect(onReset).toHaveBeenCalledTimes(autoResetLimit + 1)
    })

    it('renders the default (page) variant with the viewport-height layout', () => {
      render(
        <ErrorBoundary>
          <AlwaysBroken />
        </ErrorBoundary>,
      )

      expect(screen.getByRole('alert').className).toContain('min-h-screen')
    })

    it('renders the "section" variant without taking over the viewport', () => {
      render(
        <ErrorBoundary variant="section">
          <AlwaysBroken />
        </ErrorBoundary>,
      )

      expect(screen.getByRole('alert').className).not.toContain('min-h-screen')
    })

    it('still renders a reference ID when crypto.randomUUID is unavailable', () => {
      const cryptoApi = globalThis.crypto
      vi.stubGlobal('crypto', {
        getRandomValues: (bytes: Uint8Array) => cryptoApi.getRandomValues(bytes),
      })

      render(
        <ErrorBoundary>
          <AlwaysBroken />
        </ErrorBoundary>,
      )

      expect(screen.getByText(/^[0-9a-f]{32}$/)).toBeInTheDocument()
    })

    it('falls back to a timestamp reference ID when crypto is unusable', () => {
      vi.stubGlobal('crypto', {})

      render(
        <ErrorBoundary>
          <AlwaysBroken />
        </ErrorBoundary>,
      )

      expect(screen.getByText(/^[0-9a-z]{8,}$/)).toBeInTheDocument()
      expect(screen.queryByText('Unavailable')).toBeNull()
    })

    it('reports the same reference ID it renders so support can look it up', () => {
      const sink = vi.fn()
      setErrorReportSink(sink)

      render(
        <ErrorBoundary>
          <AlwaysBroken />
        </ErrorBoundary>,
      )

      const rendered = screen.getByText(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      ).textContent

      expect(sink).toHaveBeenCalledTimes(1)
      const report = sink.mock.calls[0][0] as ErrorReport
      expect(report.source).toBe('boundary')
      expect(report.referenceId).toBe(rendered)
    })
  })
})
