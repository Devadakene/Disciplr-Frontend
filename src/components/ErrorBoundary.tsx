import { Component, ErrorInfo, ReactNode } from 'react'
import { logger } from '../utils/logger'

interface Props {
  children: ReactNode
  onError?: (error: Error, info: ErrorInfo) => void
}

interface State {
  error: Error | null
  referenceId: string | null
}

const defaultReporter = (error: Error, info: ErrorInfo) => {
  logger.error('[ErrorBoundary]', error, info)
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, referenceId: null }

  static getDerivedStateFromError(error: Error): State {
    return { error, referenceId: crypto.randomUUID() }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const report = this.props.onError ?? defaultReporter
    report(error, info)
  }

  render() {
    if (this.state.error) {
      const supportHref = `mailto:support@disciplr.app?subject=Error%20Reference%20${this.state.referenceId ?? 'unknown'}`

      return (
        <div
          role="alert"
          className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center"
        >
          <p className="text-4xl" aria-hidden="true">
            ⚠️
          </p>

          <div className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-700">
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
            We couldn't complete that request. Please refresh the page or contact
            support with the reference ID below.
          </p>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left text-sm">
            <div style={{ color: "var(--text-secondary)" }}>Reference ID</div>
            <div
              className="font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {this.state.referenceId || "Unavailable"}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              className="btn-primary rounded-xl px-5 py-2 text-sm font-semibold"
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
