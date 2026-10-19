# Toast system

The Disciplr app has a single shared toast queue for transient
notifications: wallet connect/disconnect, copy-to-clipboard, validation
errors, and any other action that needs a brief on-screen confirmation
without blocking the page. The system has three pieces:

1. `design-system/tokens/toast.json` — token-driven timing and capacity
   (mirrored as constants in the store for browser use).
2. `src/Zustand/toastStore.ts` — the headless queue (Zustand).
3. `src/components/ToastViewport.tsx` — the rendered surface, mounted
   once in `src/components/Layout.tsx`.

## Tokens

| Token | Default | Purpose |
|---|---|---|
| `toast.defaultDurationMs` | `4000` | Auto-dismiss duration for a default-priority toast. |
| `toast.reducedMotionDurationMs` | `1500` | Shorter default when `prefers-reduced-motion: reduce` is set. |
| `toast.maxVisible` | `5` | Maximum number of toasts shown at once; older toasts are evicted FIFO. |
| `zIndex.toast` | `400` | Z-index of the viewport (CSS: `var(--z-index-toast)`). |

Runtime constants in `toastStore.ts` (`TOAST_DEFAULT_DURATION_MS`,
`TOAST_REDUCED_MOTION_DURATION_MS`, `TOAST_MAX_VISIBLE`) mirror these
token values so the store does not depend on the Node-only token loader.

## Store API

```ts
import { useToastStore } from "@/Zustand/toastStore";

// Push a toast and get back the generated id.
const id = useToastStore.getState().push({
  message: "Wallet connected",
  variant: "success",          // "info" | "success" | "error" (default: "info")
  durationMs: 4000,            // optional; 0 / negative disables auto-dismiss
});

// Or use the convenience hook in components.
import { useToast } from "@/components/useToast";
const { push, dismiss, clear } = useToast();
```

The store has three mutators:

- `push({ message, variant?, durationMs? })` — appends a toast, schedules
  auto-dismiss, evicts the oldest entry if `maxVisible` would be
  exceeded, and returns the generated `id`.
- `dismiss(id)` — removes the toast with the given `id` and cancels its
  pending timer. No-op if the id is unknown.
- `clear()` — removes every toast and cancels every pending timer.

`useToastStore` is a normal Zustand store. Components that need to read
the queue should subscribe via `useToastStore((s) => s.toasts)` so they
only re-render when the slice they care about changes.

## Viewport

`ToastViewport` reads the queue and renders a fixed-positioned column at
the bottom-right of the viewport with `role="region" aria-label="Notifications"`.
Each toast is rendered with `role="status" aria-live="polite"` so
screen-reader users are notified of new entries without the toast
yanking focus.

Per-toast DOM:

```html
<div role="status" aria-live="polite" class="toast toast--{variant}">
  <span class="toast__message">{message}</span>
  <button class="toast__dismiss" aria-label="Dismiss notification">×</button>
</div>
```

`pointer-events: none` is set on the outer container so the column does
not block clicks on the page underneath; each toast re-enables pointer
events so the dismiss button works.

## Variant → color token mapping

| Variant | CSS class | Color token |
|---|---|---|
| `info` | `toast--info` | `var(--info)` |
| `success` | `toast--success` | `var(--success)` |
| `error` | `toast--error` | `var(--danger)` |

## Reduced motion

When `prefers-reduced-motion: reduce` is set:

1. The store uses `toast.reducedMotionDurationMs` (1500 ms) instead of
   the 4-second default.
2. The viewport skips the enter animation
   (`animation: none` under the media query in `ToastViewport.css`).

## Z-index note

The toast z-index is set to 400 (`var(--z-index-toast)`), which is
*above* the modal z-index of 300 by design. Toasts are transient and
non-blocking; surfacing them over a still-visible modal lets the user
see "Saved" without dismissing the modal first. If a future feature
requires modals to occlude toasts (e.g. a destructive confirmation),
lower the toast z-index for that flow or use the modal's stacking
context to override it.

## Extending the system

To add a new variant (e.g. `warning`):

1. Add the variant to `ToastVariant` in `src/Zustand/toastStore.ts`.
2. Add a colour rule in `src/components/ToastViewport.css`
   (e.g. `.toast--warning { background: var(--warning); }`).
3. Use it: `useToastStore.getState().push({ message: "...", variant: "warning" })`.

To change the default duration, update both
`design-system/tokens/toast.json` and the matching constants in
`src/Zustand/toastStore.ts`.

## Mounting

`ToastViewport` is mounted once in `src/components/Layout.tsx` so it is
available across every page. Do not mount it per-page; that will create
duplicate viewports and the auto-expiry timers will race. A
`ToastProvider` wrapper is also exported for isolated hosts (Storybook,
tests) that prefer a provider-shaped API.
