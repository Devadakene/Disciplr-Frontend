/**
 * A minimal app-wide registry of "unsaved changes" guards.
 *
 * The app uses a declarative <BrowserRouter>, so `useBlocker` (which requires a
 * data router) is not available. Instead, any page owning unsaved state
 * registers itself here, and Layout consults this registry before letting a
 * header/footer navigation link through. The registry is a Set keyed by a
 * symbol so a page that (re)registers in a React effect cannot leak a stale
 * guard when several instances or a StrictMode double-mount overlap.
 */

const activeGuards = new Set<symbol>();

/** Registers a guard; returns the unregister function (call it on cleanup). */
export function registerNavigationGuard(): () => void {
  const token = Symbol('navigation-guard');
  activeGuards.add(token);
  return () => {
    activeGuards.delete(token);
  };
}

/** True while at least one page reports unsaved changes. */
export function hasActiveNavigationGuard(): boolean {
  return activeGuards.size > 0;
}

/** Test-only: drops every registered guard between cases. */
export function resetNavigationGuards(): void {
  activeGuards.clear();
}
