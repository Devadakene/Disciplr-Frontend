import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONNECT_TIMEOUT_DEFAULT_MS,
  CONNECT_TIMEOUT_MAX_MS,
  CONNECT_TIMEOUT_MIN_MS,
  WALLET_TELEMETRY_BUFFER_LIMIT,
  classifyConnectError,
  getRecentWalletTelemetry,
  recordWalletTelemetry,
  resetWalletTelemetrySink,
  resolveConnectTimeoutMs,
  setWalletTelemetrySink,
  type WalletTelemetryEvent,
} from '../walletTelemetry';

describe('recordWalletTelemetry', () => {
  beforeEach(() => {
    // The ring buffer is module-level; drain it so each test sees a clean view.
    const buffer = getRecentWalletTelemetry() as WalletTelemetryEvent[];
    buffer.length = 0;
  });

  afterEach(() => {
    resetWalletTelemetrySink();
  });

  it('delivers events to an injected sink', () => {
    const sink = vi.fn();
    setWalletTelemetrySink(sink);

    const event: WalletTelemetryEvent = {
      event: 'wallet.connect.attempt',
      ts: 123,
      wallet: 'freighter',
      attempt: 1,
    };
    recordWalletTelemetry(event);

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith(event);
  });

  it('never lets a throwing sink break the wallet flow', () => {
    setWalletTelemetrySink(() => {
      throw new Error('metrics backend down');
    });

    expect(() =>
      recordWalletTelemetry({
        event: 'wallet.connect.ignored',
        ts: 1,
        wallet: 'freighter',
        reason: 'button_pending',
      }),
    ).not.toThrow();
  });

  it('appends to the bounded buffer and exposes recent events', () => {
    for (let i = 0; i < 5; i += 1) {
      recordWalletTelemetry({
        event: 'wallet.connect.attempt',
        ts: i,
        wallet: 'freighter',
        attempt: i + 1,
      });
    }
    expect(getRecentWalletTelemetry()).toHaveLength(5);
  });

  it('caps memory: drops the oldest event once the buffer limit is exceeded', () => {
    for (let i = 0; i < WALLET_TELEMETRY_BUFFER_LIMIT + 10; i += 1) {
      recordWalletTelemetry({
        event: 'wallet.connect.attempt',
        ts: i,
        wallet: 'freighter',
        attempt: i + 1,
      });
    }
    const events = getRecentWalletTelemetry();
    expect(events).toHaveLength(WALLET_TELEMETRY_BUFFER_LIMIT);
    // Oldest dropped: the first retained event is the 11th recorded one.
    expect(events[0]).toMatchObject({ ts: 10 });
  });
});

describe('privacy invariants', () => {
  it('records no addresses, keys, or raw error messages on failure events', () => {
    const sink = vi.fn();
    setWalletTelemetrySink(sink);

    recordWalletTelemetry({
      event: 'wallet.connect.failure',
      ts: 1,
      wallet: 'freighter',
      durationMs: 42,
      attempt: 1,
      errorCode: 'access_denied',
    });

    const recorded = sink.mock.calls[0][0] as WalletTelemetryEvent;
    expect(recorded).toEqual(
      expect.objectContaining({
        event: 'wallet.connect.failure',
        errorCode: 'access_denied',
      }),
    );
    // No free-form fields that could carry an address or a raw message.
    expect(Object.keys(recorded)).toEqual(
      expect.not.arrayContaining(['address', 'message', 'pubKey', 'details']),
    );
  });

  it('keeps network events free of wallet addresses', () => {
    const sink = vi.fn();
    setWalletTelemetrySink(sink);

    recordWalletTelemetry({
      event: 'wallet.network.mismatch_shown',
      ts: 1,
      network: 'PUBLIC',
      expectedNetwork: 'TESTNET',
    });

    const recorded = sink.mock.calls[0][0] as WalletTelemetryEvent;
    expect(recorded).toEqual({
      event: 'wallet.network.mismatch_shown',
      ts: 1,
      network: 'PUBLIC',
      expectedNetwork: 'TESTNET',
    });
  });
});

describe('classifyConnectError', () => {
  it('classifies known failure messages into stable codes', () => {
    expect(classifyConnectError('Wallet access denied.')).toBe('access_denied');
    expect(classifyConnectError('Failed to get wallet address.')).toBe('address_unavailable');
    expect(classifyConnectError('Address unavailable.')).toBe('address_unavailable');
    expect(classifyConnectError('Connection attempt timed out after 30000ms. Please retry.')).toBe('timeout');
  });

  it('falls back to wallet_error for unknown messages and unknown for missing ones', () => {
    expect(classifyConnectError('Freighter is locked.')).toBe('wallet_error');
    expect(classifyConnectError(null)).toBe('unknown');
    expect(classifyConnectError(undefined)).toBe('unknown');
    expect(classifyConnectError('')).toBe('unknown');
  });
});

describe('resolveConnectTimeoutMs', () => {
  it('uses the default when the env value is missing or malformed', () => {
    expect(resolveConnectTimeoutMs(undefined)).toBe(CONNECT_TIMEOUT_DEFAULT_MS);
    expect(resolveConnectTimeoutMs('')).toBe(CONNECT_TIMEOUT_DEFAULT_MS);
    expect(resolveConnectTimeoutMs('not-a-number')).toBe(CONNECT_TIMEOUT_DEFAULT_MS);
    expect(resolveConnectTimeoutMs('-5')).toBe(CONNECT_TIMEOUT_DEFAULT_MS);
  });

  it('honors a valid value', () => {
    expect(resolveConnectTimeoutMs('15000')).toBe(15_000);
  });

  it('clamps to the documented bounds so a bad value cannot disable the bound', () => {
    expect(resolveConnectTimeoutMs('1000')).toBe(CONNECT_TIMEOUT_MIN_MS);
    expect(resolveConnectTimeoutMs('999999')).toBe(CONNECT_TIMEOUT_MAX_MS);
  });
});
