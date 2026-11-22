import { Component, type ErrorInfo, type ReactNode } from 'react'
import { logger } from '../utils/logger'
import { createReferenceId } from '../utils/referenceId'
import { reportError } from '../utils/errorReporter'

/**
 * How a boundary renders its fallback.
 * - `page` (default): fills the viewport — for an app-level backstop.
 * - `section`: no `min-h-screen`, so a route-level crash does not render a
 *   full-viewport page inside `<main>`.
 */
export type ErrorBoundaryVariant = 'page' | 'section'

/**
 * Automatic resets allowed inside `AUTO_RESET_WINDOW_MS`. Only automatic
 * resets are capped; the manual "Try again" button is never capped.
 */
const AUTO_RESET_LIMIT = 3
/** Rolling window the automatic-reset cap is measured over. */
const AUTO_RESET_WINDOW_MS = 5_000

interface Props {
  children: ReactNode
  onError?: (error: Error, info: ErrorInfo) => void
  /** Called after any successful reset (automatic or manual). */
  onReset?: () => void
  /**
   * Shallow-compared on update: when any entry changes, the boundary drops its
   * error state and re-renders the children. App passes the current pathname so
   * navigating away from a crashed page recovers the new page.
   */
  resetKeys?: unknown[]
  variant?: ErrorBoundaryVariant
}

interface State {
  error: Error | null
  referenceId: string | null
}

/** Default reporter, replaced wholesale by a caller-supplied `onError`. */
const defaultReporter = (error: Error, info: ErrorInfo) => {
  logger.error('[ErrorBoundary]', error, info)
}

/** Shallow, order-sensitive comparison of two `resetKeys` arrays. */
function areResetKeysEqual(
  previous: readonly unknown[] | undefined,
  next: readonly unknown[] | undefined,
): boolean {
  if (previous === next) return true
  if (!previous || !next) return false
  if (previous.length !== next.length) return false
  return previous.every((value, index) => Object.is(value, next[index]))
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, referenceId: null }

  /** Timestamps of recent automatic resets, for `AUTO_RESET_LIMIT`. */
  private autoResetTimestamps: number[] = []

  static getDerivedStateFromError(error: Error): State {
    return { error, referenceId: createReferenceId() }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // A caller-supplied `onError` replaces the default reporter entirely.
    if (this.props.onError) {
      this.props.onError(error, info)
      return
    }

    defaultReporter(error, info)

    // Record the incident with the same reference ID shown to the user, so
    // support can look it up in the logs and the recent-reports buffer.
    reportError({
      error,
      referenceId: this.state.referenceId ?? undefined,
      source: 'boundary',
      componentStack: info.componentStack ?? undefined,
    })
  }

  componentDidUpdate(prevProps: Props) {
    if (!this.state.error) return
    if (areResetKeysEqual(prevProps.resetKeys, this.props.resetKeys)) return
    if (!this.canAutoReset()) return
    this.reset()
  }

  /**
   * A boundary whose children throw again immediately must not reset forever.
   * Only automatic resets are capped; the manual "Try again" button is always
   * available so the user can retry after fixing the underlying cause.
   */
  private canAutoReset(): boolean {
    const now = Date.now()
    this.autoResetTimestamps = this.autoResetTimestamps.filter(
      (timestamp) => now - timestamp < AUTO_RESET_WINDOW_MS,
    )
    if (this.autoResetTimestamps.length >= AUTO_RESET_LIMIT) return false
    this.autoResetTimestamps.push(now)
    return true
  }

  private reset = () => {
    this.setState({ error: null, referenceId: null })
    this.props.onReset?.()
  }

  render() {
    if (this.state.error) {
      const referenceId = this.state.referenceId ?? 'Unavailable'
      const supportHref = `mailto:support@disciplr.app?subject=Error%20Reference%20${this.state.referenceId ?? 'unknown'}`
      const isPage = this.props.variant !== 'section'

      return (
        <div
          role="alert"
          className={
            isPage
              ? 'min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center'
              : 'flex flex-col items-center justify-center gap-4 px-4 py-10 text-center'
          }
        >
          <p className="text-4xl" aria-hidden="true">
            ⚠️
          </p>

          <div
            className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
            style={{
              background: 'var(--danger-transparent)',
              color: 'var(--danger)',
            }}
          >
            500 error
          </div>

          <h1
            className="text-xl font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Something went wrong
          </h1>

          <p
            className="max-w-md text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            We couldn't complete that request. Please try again, or contact
            support with the reference ID below.
          </p>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left text-sm">
            <div style={{ color: "var(--text-secondary)" }}>Reference ID</div>
            <div
              className="font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {referenceId}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              className="btn-primary rounded-xl px-5 py-2 text-sm font-semibold"
              onClick={this.reset}
            >
              Try again
            </button>

            <button
              className="rounded-xl border border-[var(--border)] px-5 py-2 text-sm font-semibold"
              style={{
                color: "var(--text-primary)",
                background: "transparent",
              }}
              onClick={() => window.location.reload()}
            >
              Refresh
            </button>

            <a
              href={supportHref}
              className="rounded-xl border border-[var(--border)] px-5 py-2 text-sm font-semibold"
              style={{
                color: "var(--text-primary)",
                textDecoration: "none",
              }}
            >
              Contact support
            </a>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
