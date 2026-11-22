import { logger as defaultLogger } from './logger';
import type { Metric } from './reportWebVitals';

/**
 * Web Vitals Sink
 *
 * Opt-in destination for finalised web vitals. By default (no
 * `VITE_VITALS_ENDPOINT`) the sink only mirrors metrics to the dev console
 * through the shared `logger`, which is silent in production builds - so
 * production emits no console output for vitals.
 *
 * When `VITE_VITALS_ENDPOINT` is configured, the sink buffers metrics and
 * sends one compact JSON batch per page hide via `navigator.sendBeacon`:
 *
 * - `VITE_VITALS_SAMPLE_RATE` (default `0.1`) is applied once per page load
 *   with the injected RNG; unsampled pages never buffer or send.
 * - Buffered metrics are flushed from a microtask queued on
 *   `visibilitychange -> hidden` / `pagehide`, so metrics finalised by
 *   `reportWebVitals` during the same event dispatch are always included.
 * - Each metric records `location.pathname` with query strings/hashes
 *   stripped and route params normalised (e.g. `/vaults/:id`), so payloads
 *   can never carry wallet addresses or other sensitive query parameters.
 *
 * The sink never throws: failures in buffering, serialisation or the beacon
 * itself are caught and logged.
 */

export const DEFAULT_SAMPLE_RATE = 0.1;

export interface VitalsBatchMetric {
  id: string;
  name: string;
  value: number;
  rating: string;
  delta: number;
  path: string;
}

export interface VitalsBatch {
  ts: number;
  nav?: string;
  metrics: VitalsBatchMetric[];
}

interface VitalsEnv {
  readonly VITE_VITALS_ENDPOINT?: string;
  readonly VITE_VITALS_SAMPLE_RATE?: string;
}

interface VitalsSinkLogger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface CreateVitalsSinkOptions {
  /** Environment source; defaults to `import.meta.env`. */
  env?: VitalsEnv;
  /** Sampling RNG; defaults to `Math.random`. */
  rng?: () => number;
  /** Beacon transport; defaults to `navigator.sendBeacon`. */
  sendBeacon?: (url: string, body: Blob) => boolean;
  /** Logger; defaults to the shared dev-only logger. */
  logger?: VitalsSinkLogger;
  /** Current pathname provider; defaults to `location.pathname`. */
  pathname?: () => string;
  /** Clock for the batch timestamp; defaults to `Date.now`. */
  now?: () => number;
}

export interface VitalsSink {
  /** Callback for `reportWebVitals`; records and (in dev) logs the metric. */
  onMetric(metric: Metric): void;
  /** Sends any buffered metrics as one batch. Safe to call when empty. */
  flush(): void;
  /** True when an endpoint is configured and this page was sampled. */
  readonly active: boolean;
}

/**
 * Route patterns mirrored from `src/App.tsx` (keep in sync). Param segments
 * (`:id`, `:vaultId`) are matched so real ids are never placed in a payload.
 */
const ROUTE_PATTERNS: readonly string[] = [
  '/',
  '/dashboard',
  '/vaults',
  '/vaults/create',
  '/vaults/:id',
  '/transactions',
  '/docs',
  '/verifier',
  '/verifier/queue',
  '/verifier/queue/:vaultId',
  '/verifier/history',
  '/help',
  '/help/search',
  '/analytics',
  '/notifications',
  '/notifications/settings',
  '/__visual__/crash',
];

const STATIC_SEGMENTS: ReadonlySet<string> = new Set(
  ROUTE_PATTERNS.flatMap((pattern) => pattern.split('/')).filter(
    (segment) => segment.length > 0 && !segment.startsWith(':'),
  ),
);

/**
 * Resolves the vitals collection endpoint. Accepts absolute http(s) URLs and
 * app-relative paths; anything else (including `javascript:`/`data:` URLs and
 * URLs with embedded credentials) is rejected, which disables sending.
 */
export function resolveVitalsEndpoint(env?: VitalsEnv): string | undefined {
  const raw = env?.VITE_VITALS_ENDPOINT?.trim();
  if (!raw) {
    return undefined;
  }
  if (raw.startsWith('/')) {
    return raw.startsWith('//') || /[\r\n\t]/.test(raw) ? undefined : raw;
  }
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return undefined;
    }
    if (parsed.username || parsed.password) {
      return undefined;
    }
    return raw;
  } catch {
    return undefined;
  }
}

/**
 * Resolves the sampling rate for `VITE_VITALS_SAMPLE_RATE`. Missing or
 * invalid values fall back to `DEFAULT_SAMPLE_RATE` (0.1) rather than
 * throwing, so a typo can never break bootstrap.
 */
export function resolveVitalsSampleRate(env?: VitalsEnv): number {
  const raw = env?.VITE_VITALS_SAMPLE_RATE?.trim();
  if (!raw) {
    return DEFAULT_SAMPLE_RATE;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return DEFAULT_SAMPLE_RATE;
  }
  return parsed;
}

/**
 * Normalises a pathname for reporting: query strings and hashes are always
 * stripped, known route params are replaced by their pattern (`/vaults/:id`),
 * and any segment outside the known route vocabulary is redacted to
 * `:param` so ids or addresses in unknown routes are never leaked.
 */
export function normalisePathname(pathname: string): string {
  const raw = typeof pathname === 'string' ? pathname : '/';
  const path = raw.split(/[?#]/)[0] || '/';

  if (path === '/') {
    return '/';
  }

  let paramMatch: string | undefined;
  for (const pattern of ROUTE_PATTERNS) {
    if (path === pattern) {
      return pattern;
    }
    if (paramMatch === undefined && matchesPattern(pattern, path)) {
      paramMatch = pattern;
    }
  }
  if (paramMatch !== undefined) {
    return paramMatch;
  }

  const segments = path
    .split('/')
    .filter(Boolean)
    .map((segment) => (STATIC_SEGMENTS.has(segment) ? segment : ':param'));
  return `/${segments.join('/')}`;
}

function matchesPattern(pattern: string, path: string): boolean {
  const patternSegments = pattern.split('/');
  const pathSegments = path.split('/');
  if (patternSegments.length !== pathSegments.length) {
    return false;
  }
  return patternSegments.every((segment, index) =>
    segment.startsWith(':') ? pathSegments[index].length > 0 : segment === pathSegments[index],
  );
}

function readImportMetaEnv(): VitalsEnv | undefined {
  try {
    // Pick only the vitals vars; the vite env type is index-signatured and
    // fails the weak-type overlap check when returned wholesale.
    return {
      VITE_VITALS_ENDPOINT: import.meta.env.VITE_VITALS_ENDPOINT,
      VITE_VITALS_SAMPLE_RATE: import.meta.env.VITE_VITALS_SAMPLE_RATE,
    };
  } catch {
    return undefined;
  }
}

function defaultSendBeacon(url: string, body: Blob): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
    return false;
  }
  return navigator.sendBeacon(url, body);
}

function currentPathname(): string {
  return typeof location !== 'undefined' ? location.pathname : '/';
}

/**
 * Creates the opt-in vitals sink. Never throws: if setup fails an inert
 * no-op sink is returned so the bootstrap path cannot be broken by metrics.
 */
export function createVitalsSink(options: CreateVitalsSinkOptions = {}): VitalsSink {
  try {
    const env = options.env ?? readImportMetaEnv();
    const log = options.logger ?? defaultLogger;
    const rng = options.rng ?? Math.random;
    const pathname = options.pathname ?? currentPathname;
    const now = options.now ?? Date.now;
    const sendBeacon = options.sendBeacon ?? defaultSendBeacon;

    const endpoint = resolveVitalsEndpoint(env);
    const sampleRate = resolveVitalsSampleRate(env);
    if (endpoint === undefined && env?.VITE_VITALS_ENDPOINT?.trim()) {
      log.warn('[Web Vitals] ignoring invalid VITE_VITALS_ENDPOINT');
    }

    const sampled = endpoint !== undefined && rng() < sampleRate;
    const buffer: VitalsBatchMetric[] = [];
    let navigationType: string | undefined;

    const flush = (): void => {
      if (!sampled || endpoint === undefined || buffer.length === 0) {
        return;
      }
      const metrics = buffer.splice(0, buffer.length);
      const batch: VitalsBatch = navigationType
        ? { ts: now(), nav: navigationType, metrics }
        : { ts: now(), metrics };
      try {
        const body = new Blob([JSON.stringify(batch)], { type: 'application/json' });
        sendBeacon(endpoint, body);
      } catch (error) {
        log.error('[Web Vitals] failed to send vitals beacon', error);
      }
    };

    const onMetric = (metric: Metric): void => {
      try {
        log.info('[Web Vitals]', metric);
        if (!sampled) {
          return;
        }
        navigationType = navigationType ?? metric.navigationType;
        buffer.push({
          id: metric.id,
          name: metric.name,
          value: metric.value,
          rating: metric.rating,
          delta: metric.delta,
          path: normalisePathname(pathname()),
        });
      } catch (error) {
        log.error('[Web Vitals] sink failed to record metric', error);
      }
    };

    if (sampled) {
      armFlushListeners(flush, log);
    }

    return { onMetric, flush, active: sampled };
  } catch (error) {
    try {
      defaultLogger.error('[Web Vitals] sink failed to initialise', error);
    } catch {
      // Nothing else can be done: an inert sink keeps bootstrap alive.
    }
    return { onMetric: () => {}, flush: () => {}, active: false };
  }
}

function armFlushListeners(flush: () => void, log: VitalsSinkLogger): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  // Flush from a microtask so the batch always includes metrics that
  // `reportWebVitals` finalises during the same event dispatch, regardless
  // of which listener was registered first.
  const schedule = (): void => {
    queueMicrotask(() => {
      try {
        flush();
      } catch (error) {
        log.error('[Web Vitals] sink flush failed', error);
      }
    });
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      schedule();
    }
  });
  window.addEventListener('pagehide', schedule);
}
