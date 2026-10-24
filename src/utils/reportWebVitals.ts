import { logger } from './logger';

/**
 * Web Vitals Reporter
 *
 * Captures Core Web Vitals (LCP, CLS, INP) using measurement semantics that
 * match the official metric definitions:
 *
 * - **INP** groups `event` timing entries by `interactionId`, keeps the
 *   longest `duration` per interaction, and reports an estimate of the 98th
 *   percentile of those interactions - never the input delay of a single
 *   event. `first-input` is observed alongside `event` (with
 *   `durationThreshold: 40`) so the first interaction is not missed when it
 *   spans fewer than 40ms.
 * - **CLS** accumulates shifts into session windows (shifts less than 1s
 *   apart, each window capped at 5s) and reports the largest window instead
 *   of an unbounded lifetime total. Shifts flagged `hadRecentInput` are
 *   excluded.
 * - **LCP** tracks the latest `largest-contentful-paint` entry and finalises
 *   exactly once - on the first `keydown`/`pointerdown` or when the page is
 *   hidden, whichever comes first. Later entries are ignored.
 *
 * Every metric is reported exactly once per page lifecycle: final values are
 * flushed on `visibilitychange -> hidden` and `pagehide`. A `pageshow` event
 * with `persisted` (bfcache restore) resets the session so a fresh set of
 * metrics with fresh ids is reported for the restored page.
 *
 * Each metric carries a stable per-page-load id (`v1-<timestamp>-<random>`)
 * plus a `delta` (equal to `value` for the single per-load report), so
 * downstream consumers can de-duplicate and diff by id.
 *
 * @param onReport - Callback invoked once per finalised metric. Errors
 * thrown by the callback are logged and never propagate to the caller.
 *
 * Example usage:
 * ```ts
 * reportWebVitals((metric) => {
 *   // Send to the vitals sink or an analytics service
 * });
 * ```
 */

export type VitalName = 'LCP' | 'CLS' | 'INP';

export interface Metric {
  id: string;
  name: VitalName;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  navigationType?: string;
}

type MetricCallback = (metric: Metric) => void;

interface LayoutShiftEntry extends PerformanceEntry {
  hadRecentInput: boolean;
  value: number;
}

interface EventTimingEntry extends PerformanceEntry {
  duration: number;
  interactionId?: number;
}

interface LargestContentfulPaintEntry extends PerformanceEntry {
  renderTime?: number;
  loadTime?: number;
}

interface ClsState {
  started: boolean;
  sessionValue: number;
  firstTime: number;
  lastTime: number;
  maxValue: number;
}

interface VitalsSession {
  onReport: MetricCallback;
  navigationType: string;
  ids: Record<VitalName, string>;
  reported: Record<VitalName, boolean>;
  finalised: boolean;
  observers: Record<VitalName, PerformanceObserver | null>;
  cls: ClsState;
  interactions: Map<number, number>;
  lcp: { finalised: boolean; value: number | null };
}

const SESSION_GAP_MS = 1000;
const SESSION_WINDOW_MS = 5000;
const INP_DURATION_THRESHOLD = 40;
const MAX_INTERACTIONS_TO_CONSIDER = 10;
const INTERACTIONS_PER_P98_SLOT = 50;

const RATING_THRESHOLDS: Record<VitalName, readonly [good: number, poor: number]> = {
  LCP: [2500, 4000],
  CLS: [0.1, 0.25],
  INP: [200, 500],
};

/**
 * Reports finalised Core Web Vitals to the provided callback.
 * If no callback is provided, metrics are not reported (no-op).
 * If the callback throws, it will not crash the application.
 */
export function reportWebVitals(onReport?: MetricCallback): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (typeof onReport !== 'function') {
    return;
  }

  try {
    startSession(onReport);
  } catch (error) {
    logger.error('Web Vitals reporter failed to start:', error);
  }
}

function startSession(onReport: MetricCallback): void {
  if (typeof PerformanceObserver === 'undefined') {
    return;
  }

  const session: VitalsSession = {
    onReport,
    navigationType: getNavigationType(),
    ids: newIds(),
    reported: { LCP: false, CLS: false, INP: false },
    finalised: false,
    observers: { LCP: null, CLS: null, INP: null },
    cls: { started: false, sessionValue: 0, firstTime: 0, lastTime: 0, maxValue: 0 },
    interactions: new Map(),
    lcp: { finalised: false, value: null },
  };

  armObservers(session, true);
  armLifecycle(session);
}

function armObservers(session: VitalsSession, buffered: boolean): void {
  session.observers.LCP = createObserver('largest-contentful-paint', buffered, (entries) => {
    if (session.lcp.finalised) {
      return;
    }
    const last = entries[entries.length - 1] as LargestContentfulPaintEntry | undefined;
    if (last) {
      session.lcp.value = lcpValueOf(last);
    }
  });

  session.observers.CLS = createObserver('layout-shift', buffered, (entries) => {
    for (const entry of entries) {
      processLayoutShift(session, entry as LayoutShiftEntry);
    }
  });

  const eventObserver = createObserver('event', buffered, (entries) => {
    for (const entry of entries) {
      processEventTiming(session, entry as EventTimingEntry);
    }
  }, { durationThreshold: INP_DURATION_THRESHOLD });

  if (eventObserver) {
    try {
      eventObserver.observe({ type: 'first-input', buffered });
    } catch {
      // first-input unsupported: the event observer alone still covers INP.
    }
  }
  session.observers.INP = eventObserver;
}

function armLifecycle(session: VitalsSession): void {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      finaliseSession(session);
    }
  });
  window.addEventListener('pagehide', () => {
    finaliseSession(session);
  });

  const finaliseLcp = () => finalizeLcp(session);
  window.addEventListener('keydown', finaliseLcp);
  window.addEventListener('pointerdown', finaliseLcp);

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      resetSession(session);
    }
  });
}

function createObserver(
  type: string,
  buffered: boolean,
  onEntries: (entries: PerformanceEntry[]) => void,
  extraOptions?: PerformanceObserverInit & { durationThreshold?: number },
): PerformanceObserver | null {
  try {
    if (!isEntryTypeSupported(type)) {
      return null;
    }
    const observer = new PerformanceObserver((list) => {
      try {
        onEntries(list.getEntries());
      } catch (error) {
        logger.error('Web Vitals observer callback failed:', error);
      }
    });
    observer.observe({ ...extraOptions, type, buffered });
    return observer;
  } catch {
    return null;
  }
}

function isEntryTypeSupported(type: string): boolean {
  try {
    const supported = PerformanceObserver.supportedEntryTypes;
    if (!supported) {
      return true;
    }
    return supported.includes(type);
  } catch {
    return true;
  }
}

function processLayoutShift(session: VitalsSession, entry: LayoutShiftEntry): void {
  if (entry.hadRecentInput) {
    return;
  }

  const state = session.cls;
  const time = entry.startTime;
  const inCurrentWindow =
    state.started &&
    state.sessionValue !== 0 &&
    time - state.lastTime < SESSION_GAP_MS &&
    time - state.firstTime < SESSION_WINDOW_MS;

  if (inCurrentWindow) {
    state.sessionValue += entry.value;
    state.lastTime = time;
  } else {
    state.started = true;
    state.sessionValue = entry.value;
    state.firstTime = time;
    state.lastTime = time;
  }

  if (state.sessionValue > state.maxValue) {
    state.maxValue = state.sessionValue;
  }
}

function processEventTiming(session: VitalsSession, entry: EventTimingEntry): void {
  if (!entry.interactionId) {
    return;
  }
  const previous = session.interactions.get(entry.interactionId);
  if (previous === undefined || entry.duration > previous) {
    session.interactions.set(entry.interactionId, entry.duration);
  }
}

/**
 * Estimates the p98 interaction latency from the longest interactions seen so
 * far, mirroring the web-vitals reference implementation: the top ten
 * interactions are ranked longest-first and the candidate index steps one
 * place for every 50 observed interactions, so a single outlier stops
 * dominating once the page has seen enough interactions.
 */
function estimateInp(interactions: Map<number, number>): number | undefined {
  if (interactions.size === 0) {
    return undefined;
  }
  const ranked = [...interactions.values()]
    .sort((a, b) => b - a)
    .slice(0, MAX_INTERACTIONS_TO_CONSIDER);
  const index = Math.min(ranked.length - 1, Math.floor(interactions.size / INTERACTIONS_PER_P98_SLOT));
  return ranked[index];
}

function finaliseSession(session: VitalsSession): void {
  if (session.finalised) {
    return;
  }
  session.finalised = true;

  flushPendingRecords(session);
  finalizeLcp(session);

  if (session.observers.CLS) {
    reportMetric(session, 'CLS', session.cls.maxValue);
  }

  const inp = estimateInp(session.interactions);
  if (inp !== undefined) {
    reportMetric(session, 'INP', inp);
  }

  for (const name of ['LCP', 'CLS', 'INP'] as const) {
    session.observers[name]?.disconnect();
    session.observers[name] = null;
  }
}

function flushPendingRecords(session: VitalsSession): void {
  const clsObserver = session.observers.CLS;
  if (clsObserver) {
    for (const entry of clsObserver.takeRecords()) {
      processLayoutShift(session, entry as LayoutShiftEntry);
    }
  }

  const eventObserver = session.observers.INP;
  if (eventObserver) {
    for (const entry of eventObserver.takeRecords()) {
      processEventTiming(session, entry as EventTimingEntry);
    }
  }
}

function finalizeLcp(session: VitalsSession): void {
  if (session.lcp.finalised) {
    return;
  }

  const observer = session.observers.LCP;
  if (observer) {
    const pending = observer.takeRecords();
    const last = pending[pending.length - 1] as LargestContentfulPaintEntry | undefined;
    if (last) {
      session.lcp.value = lcpValueOf(last);
    }
    observer.disconnect();
    session.observers.LCP = null;
  }
  session.lcp.finalised = true;

  if (session.lcp.value !== null) {
    reportMetric(session, 'LCP', session.lcp.value);
  }
}

function resetSession(session: VitalsSession): void {
  for (const name of ['LCP', 'CLS', 'INP'] as const) {
    session.observers[name]?.disconnect();
    session.observers[name] = null;
  }

  session.ids = newIds();
  session.reported = { LCP: false, CLS: false, INP: false };
  session.finalised = false;
  session.cls = { started: false, sessionValue: 0, firstTime: 0, lastTime: 0, maxValue: 0 };
  session.interactions.clear();
  session.lcp = { finalised: false, value: null };

  // Re-arm without `buffered` so pre-restore performance entries are not
  // replayed into the fresh page-load state.
  armObservers(session, false);
}

function reportMetric(session: VitalsSession, name: VitalName, value: number): void {
  if (session.reported[name]) {
    return;
  }
  session.reported[name] = true;

  const metric: Metric = {
    id: session.ids[name],
    name,
    value,
    rating: getRating(name, value),
    delta: value,
    navigationType: session.navigationType,
  };

  try {
    session.onReport(metric);
  } catch (error) {
    logger.error('Web Vitals reporter callback threw an error:', error);
  }
}

function lcpValueOf(entry: LargestContentfulPaintEntry): number {
  return entry.renderTime || entry.loadTime || entry.startTime || 0;
}

function newIds(): Record<VitalName, string> {
  return { LCP: newMetricId(), CLS: newMetricId(), INP: newMetricId() };
}

function newMetricId(): string {
  return `v1-${Date.now()}-${Math.floor(Math.random() * (9e12 - 1)) + 1e12}`;
}

function getRating(name: VitalName, value: number): Metric['rating'] {
  const [goodMax, poorMax] = RATING_THRESHOLDS[name];
  if (value < goodMax) return 'good';
  if (value < poorMax) return 'needs-improvement';
  return 'poor';
}

function getNavigationType(): string {
  if (typeof window === 'undefined' || !window.performance || !window.performance.getEntriesByType) {
    return 'unknown';
  }

  const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  if (navEntries.length > 0) {
    const type = navEntries[0].type;
    return type || 'unknown';
  }

  return 'unknown';
}
