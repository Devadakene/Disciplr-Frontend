import type { ReactNode } from "react";
import { useToastStore } from "../Zustand/toastStore";
import "./ToastViewport.css";

/**
 * ToastViewport — renders the queued toasts at the configured toast
 * z-index token (`var(--z-index-toast)`), with `aria-live="polite"` so
 * screen-reader users are notified of new entries. The viewport is a
 * thin shell over `useToastStore`; the store handles auto-expiry and
 * FIFO eviction.
 *
 * Success / error / info variants map to the semantic color tokens
 * (`--success`, `--danger`, `--info`) via CSS classes. Enter animation
 * is skipped when `prefers-reduced-motion: reduce` is set.
 */
export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      className="toast-viewport"
      role="region"
      aria-label="Notifications"
      data-testid="toast-viewport"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          aria-live="polite"
          className={`toast toast--${t.variant}`}
          data-testid="toast"
          data-variant={t.variant}
        >
          <span className="toast__message">{t.message}</span>
          <button
            type="button"
            className="toast__dismiss"
            aria-label="Dismiss notification"
            onClick={() => dismiss(t.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * Optional provider that mounts the viewport. Layout mounts
 * `<ToastViewport />` directly; this wrapper exists for call sites that
 * prefer a provider-shaped API (e.g. storybook / isolated tests).
 */
export function ToastProvider({ children }: { children?: ReactNode }) {
  return (
    <>
      {children}
      <ToastViewport />
    </>
  );
}

