/**
 * Responsive drawer state machine.
 *
 * Owns the open/close lifecycle of the mobile navigation drawer rendered by
 * `src/components/Layout.tsx` (state owner) and `src/components/MobileDrawer.tsx`
 * (presentation + side effects). Every transition flows through
 * `reduceDrawerState` so it is deterministic and idempotent: duplicate, stale,
 * or out-of-order events can never produce contradictory client state (for
 * example `aria-expanded="true"` while the drawer is closed, or a scroll lock
 * that is never released).
 *
 * Invariants
 * ----------
 * 1. `OPEN` and `CLOSE` are idempotent — dispatching either while already in
 *    the target state is a no-op, so duplicate close events (Escape + backdrop
 *    click in the same frame) fire side effects exactly once.
 * 2. `TOGGLE` performs exactly one transition per dispatch, so rapid
 *    double-clicks on the hamburger each flip the state once.
 * 3. `ROUTE_CHANGE` and `RESIZE_DESKTOP` can only close the drawer, never open
 *    it — a deep link or a viewport crossing into the desktop breakpoint must
 *    not auto-open the drawer.
 * 4. Every event returns a valid state; an unknown event (hostile input at
 *    runtime) leaves the state unchanged rather than corrupting it.
 */

export type DrawerState = 'closed' | 'open'

export type DrawerEvent =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'TOGGLE' }
  | { type: 'ROUTE_CHANGE' } // navigation, browser back/forward, deep link
  | { type: 'RESIZE_DESKTOP' } // viewport crossed into the desktop breakpoint

export const DRAWER_INITIAL_STATE: DrawerState = 'closed'

export function reduceDrawerState(state: DrawerState, event: DrawerEvent): DrawerState {
  switch (event.type) {
    case 'OPEN':
      return 'open'
    case 'CLOSE':
      return 'closed'
    case 'TOGGLE':
      return state === 'open' ? 'closed' : 'open'
    case 'ROUTE_CHANGE':
    case 'RESIZE_DESKTOP':
      return 'closed'
    default:
      // Unknown event at runtime: refuse to change state.
      return state
  }
}

export function isDrawerOpen(state: DrawerState): boolean {
  return state === 'open'
}

/**
 * True only when the route actually changed. Guards the route-change effect so
 * a stale location object (same pathname re-rendered) can never close a
 * freshly opened drawer.
 */
export function shouldCloseDrawerOnRouteChange(previousPath: string, nextPath: string): boolean {
  return previousPath !== nextPath
}

// ─── Boundary validation (hostile-input boundary) ──────────────────────────
// `isOpen` and `onClose` cross the component boundary from Layout into
// MobileDrawer. Coerce them at the boundary so malformed values (e.g. the
// string `"false"`, a number, or a missing callback) can never render a
// contradictory drawer or crash on interaction.

/** Only the literal boolean `true` opens the drawer. */
export function toDrawerOpen(value: unknown): boolean {
  return value === true
}

/** Returns the close handler only when it is actually callable. */
export function toCloseHandler(value: unknown): (() => void) | undefined {
  return typeof value === 'function' ? (value as () => void) : undefined
}
