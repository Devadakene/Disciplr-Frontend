import { logger } from './logger';
import type { WalletNetwork } from '../context/WalletContext';

/**
 * Structured, privacy-safe diagnostics for the wallet feature.
 *
 * Invariants
 * ----------
 * 1. Never attach secrets: no addresses, keys, or raw error messages. Failure
 *    events carry a stable `errorCode` (access_denied, address_unavailable,
 *    wallet_error, timeout, unknown) so dashboards can aggregate without ever
 *    seeing user data.
 * 2. Bounded memory: every event is appended to a fixed-capacity ring buffer
 *    (`WALLET_TELEMETRY_BUFFER_LIMIT`). Older events are dropped; there is no
 *    unbounded growth, even under a pathological reconnect loop.
 * 3. Telemetry can never break the wallet flow: the sink is invoked inside a
 *    try/catch, and a custom sink is opt-in via `setWalletTelemetrySink`.
 *
 * The default sink logs structured events through the app logger (no-op in
 * production builds). Production deployments can wire a real backend by
 * calling `setWalletTelemetrySink` at startup; `getRecentWalletTelemetry`
 * exposes the bounded buffer for client-side diagnostics.
 */

export type ConnectErrorCode =
  | 'access_denied'
  | 'address_unavailable'
  | 'wallet_error'
  | 'timeout'
  | 'unknown';

export type ConnectIgnoredReason = 'already_in_flight' | 'button_pending';

interface BaseEvent {
  /** Epoch milliseconds. */
  ts: number;
  /** The wallet integration this event describes. */
  wallet: 'freighter';
}

export type WalletTelemetryEvent =
  | (BaseEvent & {
      event: 'wallet.connect.attempt';
      /** 1-based attempt number for the current component session. */
      attempt: number;
    })
  | (BaseEvent & {
      event: 'wallet.connect.success';
      durationMs: number;
      attempt: number;
    })
  | (BaseEvent & {
      event: 'wallet.connect.failure';
      durationMs: number;
      attempt: number;
      errorCode: ConnectErrorCode;
    })
  | (BaseEvent & {
      event: 'wallet.connect.timeout';
      durationMs: number;
      timeoutMs: number;
      attempt: number;
    })
  | (BaseEvent & {
      event: 'wallet.connect.ignored';
      reason: ConnectIgnoredReason;
    })
  | {
      event: 'wallet.network.mismatch_shown';
      ts: number;
      network: WalletNetwork | 'unknown';
      expectedNetwork: WalletNetwork;
    }
  | {
      event: 'wallet.network.recovered';
      ts: number;
      network: WalletNetwork | 'unknown';
      expectedNetwork: WalletNetwork;
    }
  | {
      event: 'wallet.network.dismissed';
      ts: number;
      network: WalletNetwork | 'unknown';
      expectedNetwork: WalletNetwork;
    };

/**
 * Hard cap on the in-memory diagnostics buffer. Bounds memory cost for the
 * whole feature: at most this many events are ever retained.
 */
export const WALLET_TELEMETRY_BUFFER_LIMIT = 100;

/** Bounds for the connect timeout (configurable via VITE_WALLET_CONNECT_TIMEOUT_MS). */
export const CONNECT_TIMEOUT_DEFAULT_MS = 30_000;
export const CONNECT_TIMEOUT_MIN_MS = 5_000;
export const CONNECT_TIMEOUT_MAX_MS = 120_000;

type TelemetrySink = (event: WalletTelemetryEvent) => void;

const defaultSink: TelemetrySink = (event) => {
  logger.info('[wallet-telemetry]', event);
};

let sink: TelemetrySink = defaultSink;
const recentEvents: WalletTelemetryEvent[] = [];

/** Record a telemetry event: append to the bounded buffer, then notify the sink. */
export function recordWalletTelemetry(event: WalletTelemetryEvent): void {
  recentEvents.push(event);
  if (recentEvents.length > WALLET_TELEMETRY_BUFFER_LIMIT) {
    recentEvents.shift();
  }
  try {
    sink(event);
  } catch {
    // Telemetry must never break the wallet flow.
  }
}

/** Bounded, read-only view of the most recent events (oldest first). */
export function getRecentWalletTelemetry(): readonly WalletTelemetryEvent[] {
  return recentEvents;
}

/** Opt-in structured sink (e.g. a metrics backend). Restore with resetWalletTelemetrySink. */
export function setWalletTelemetrySink(next: TelemetrySink): void {
  sink = next;
}

export function resetWalletTelemetrySink(): void {
  sink = defaultSink;
}

/**
 * Maps a user-facing connect error message to a stable, aggregatable code.
 * Only used for classification — the raw message is never recorded.
 */
export function classifyConnectError(message: string | null | undefined): ConnectErrorCode {
  if (message == null || message.trim() === '') {
    return 'unknown';
  }
  const normalized = message.toLowerCase();
  if (normalized.includes('access denied')) {
    return 'access_denied';
  }
  if (normalized.includes('address unavailable') || normalized.includes('failed to get wallet address')) {
    return 'address_unavailable';
  }
  if (normalized.includes('timed out') || normalized.includes('timeout')) {
    return 'timeout';
  }
  return 'wallet_error';
}

/**
 * Resolves the connect timeout from VITE_WALLET_CONNECT_TIMEOUT_MS,
 * clamped to [CONNECT_TIMEOUT_MIN_MS, CONNECT_TIMEOUT_MAX_MS]. Malformed or
 * missing values fall back to the default so a bad env value can never
 * disable the bound.
 */
export function resolveConnectTimeoutMs(raw: string | undefined): number {
  if (raw == null || raw.trim() === '') {
    return CONNECT_TIMEOUT_DEFAULT_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return CONNECT_TIMEOUT_DEFAULT_MS;
  }
  return Math.min(CONNECT_TIMEOUT_MAX_MS, Math.max(CONNECT_TIMEOUT_MIN_MS, Math.round(parsed)));
}
