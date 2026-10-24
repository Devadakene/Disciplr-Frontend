// The sink touches window/document listeners and Blob, so it needs a DOM.
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  createVitalsSink,
  normalisePathname,
  resolveVitalsEndpoint,
  resolveVitalsSampleRate,
  DEFAULT_SAMPLE_RATE,
} from '../vitalsSink';
import type { Metric } from '../reportWebVitals';

const ENDPOINT = 'https://collector.example/vitals';

type VitestMock = ReturnType<typeof vi.fn>;

function makeMetric(overrides: Partial<Metric> = {}): Metric {
  return {
    id: 'v1-1700000000000-1234567890123',
    name: 'CLS',
    value: 0.12,
    rating: 'good',
    delta: 0.12,
    navigationType: 'navigate',
    ...overrides,
  };
}

function makeLogger(): { info: VitestMock; warn: VitestMock; error: VitestMock } {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeBeacon(): VitestMock {
  return vi.fn((_url: string, _body: Blob) => true);
}

describe('resolveVitalsEndpoint', () => {
  it('returns undefined when unset or empty', () => {
    expect(resolveVitalsEndpoint(undefined)).toBeUndefined();
    expect(resolveVitalsEndpoint({})).toBeUndefined();
    expect(resolveVitalsEndpoint({ VITE_VITALS_ENDPOINT: '   ' })).toBeUndefined();
  });

  it('accepts absolute http(s) URLs and app-relative paths', () => {
    expect(resolveVitalsEndpoint({ VITE_VITALS_ENDPOINT: ENDPOINT })).toBe(ENDPOINT);
    expect(resolveVitalsEndpoint({ VITE_VITALS_ENDPOINT: '  /vitals  ' })).toBe('/vitals');
  });

  it('rejects unsafe or malformed endpoints', () => {
    expect(resolveVitalsEndpoint({ VITE_VITALS_ENDPOINT: 'javascript:alert(1)' })).toBeUndefined();
    expect(resolveVitalsEndpoint({ VITE_VITALS_ENDPOINT: 'data:text/plain,x' })).toBeUndefined();
    expect(resolveVitalsEndpoint({ VITE_VITALS_ENDPOINT: 'ftp://example.com/x' })).toBeUndefined();
    expect(resolveVitalsEndpoint({ VITE_VITALS_ENDPOINT: '//evil.example/x' })).toBeUndefined();
    expect(resolveVitalsEndpoint({ VITE_VITALS_ENDPOINT: 'https://user:pass@example.com/x' })).toBeUndefined();
    expect(resolveVitalsEndpoint({ VITE_VITALS_ENDPOINT: 'not a url' })).toBeUndefined();
  });
});

describe('resolveVitalsSampleRate', () => {
  it('defaults to 0.1 when unset or empty', () => {
    expect(resolveVitalsSampleRate(undefined)).toBe(DEFAULT_SAMPLE_RATE);
    expect(resolveVitalsSampleRate({})).toBe(DEFAULT_SAMPLE_RATE);
    expect(resolveVitalsSampleRate({ VITE_VITALS_SAMPLE_RATE: '' })).toBe(DEFAULT_SAMPLE_RATE);
    expect(DEFAULT_SAMPLE_RATE).toBe(0.1);
  });

  it('parses valid rates including the boundaries', () => {
    expect(resolveVitalsSampleRate({ VITE_VITALS_SAMPLE_RATE: '0.5' })).toBe(0.5);
    expect(resolveVitalsSampleRate({ VITE_VITALS_SAMPLE_RATE: '0' })).toBe(0);
    expect(resolveVitalsSampleRate({ VITE_VITALS_SAMPLE_RATE: '1' })).toBe(1);
  });

  it('falls back to the default for invalid values instead of throwing', () => {
    expect(resolveVitalsSampleRate({ VITE_VITALS_SAMPLE_RATE: 'abc' })).toBe(DEFAULT_SAMPLE_RATE);
    expect(resolveVitalsSampleRate({ VITE_VITALS_SAMPLE_RATE: '-0.2' })).toBe(DEFAULT_SAMPLE_RATE);
    expect(resolveVitalsSampleRate({ VITE_VITALS_SAMPLE_RATE: '2' })).toBe(DEFAULT_SAMPLE_RATE);
    expect(resolveVitalsSampleRate({ VITE_VITALS_SAMPLE_RATE: 'NaN' })).toBe(DEFAULT_SAMPLE_RATE);
  });
});

describe('normalisePathname', () => {
  it('replaces route params with their pattern', () => {
    expect(normalisePathname('/vaults/abc123')).toBe('/vaults/:id');
    expect(normalisePathname('/verifier/queue/VAULT-99')).toBe('/verifier/queue/:vaultId');
  });

  it('strips query strings and hashes, even on known routes', () => {
    expect(normalisePathname('/dashboard?token=secret')).toBe('/dashboard');
    expect(normalisePathname('/vaults/abc?wallet=0xdeadbeef#top')).toBe('/vaults/:id');
  });

  it('keeps static routes static', () => {
    expect(normalisePathname('/')).toBe('/');
    expect(normalisePathname('')).toBe('/');
    expect(normalisePathname('/vaults/create')).toBe('/vaults/create');
    expect(normalisePathname('/notifications/settings/')).toBe('/notifications/settings');
  });

  it('redacts segments outside the known route vocabulary', () => {
    expect(normalisePathname('/unknown/route')).toBe('/:param/:param');
    expect(normalisePathname('/vaults/abc/extra')).toBe('/vaults/:param/:param');
    expect(normalisePathname(`/${'G'.repeat(55)}`)).toBe('/:param');
    expect(normalisePathname(`/foo/${'G'.repeat(55)}`)).toBe('/:param/:param');
  });
});

describe('createVitalsSink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(document, 'visibilityState');
  });

  it('is a no-op by default: no endpoint means no beacon and no listeners', () => {
    const sendBeacon = makeBeacon();
    const rng = vi.fn(() => 0);
    const logger = makeLogger();

    const sink = createVitalsSink({ env: {}, rng, sendBeacon, logger, pathname: () => '/vaults/1' });

    expect(sink.active).toBe(false);
    expect(rng).not.toHaveBeenCalled();

    sink.onMetric(makeMetric());
    sink.flush();

    expect(sendBeacon).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('[Web Vitals]', expect.objectContaining({ name: 'CLS' }));
  });

  it('stays inactive with the build env when VITE_VITALS_ENDPOINT is unset', () => {
    const sink = createVitalsSink({ sendBeacon: makeBeacon(), logger: makeLogger() });
    expect(sink.active).toBe(false);
  });

  it('sends one compact JSON batch via sendBeacon when VITE_VITALS_ENDPOINT is set', async () => {
    const sendBeacon = makeBeacon();
    const logger = makeLogger();
    const sink = createVitalsSink({
      env: { VITE_VITALS_ENDPOINT: ENDPOINT, VITE_VITALS_SAMPLE_RATE: '1' },
      rng: () => 0,
      sendBeacon,
      logger,
      pathname: () => '/vaults/abc123?wallet=0xdeadbeef',
      now: () => 1700000000000,
    });

    expect(sink.active).toBe(true);

    sink.onMetric(makeMetric({ name: 'LCP', value: 1200, delta: 1200, rating: 'good' }));
    sink.onMetric(makeMetric({ name: 'INP', value: 300, delta: 300, rating: 'needs-improvement' }));
    sink.flush();

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [url, body] = sendBeacon.mock.calls[0];
    expect(url).toBe(ENDPOINT);
    expect(body).toBeInstanceOf(Blob);
    expect(body.type).toBe('application/json');

    const payload = JSON.parse(await body.text());
    expect(payload.ts).toBe(1700000000000);
    expect(payload.nav).toBe('navigate');
    expect(payload.metrics).toEqual([
      {
        id: 'v1-1700000000000-1234567890123',
        name: 'LCP',
        value: 1200,
        rating: 'good',
        delta: 1200,
        path: '/vaults/:id',
      },
      {
        id: 'v1-1700000000000-1234567890123',
        name: 'INP',
        value: 300,
        rating: 'needs-improvement',
        delta: 300,
        path: '/vaults/:id',
      },
    ]);
    expect(JSON.stringify(payload)).not.toContain('wallet');
    expect(JSON.stringify(payload)).not.toContain('0xdeadbeef');
  });

  it('flushes the buffer only once', async () => {
    const sendBeacon = makeBeacon();
    const sink = createVitalsSink({
      env: { VITE_VITALS_ENDPOINT: ENDPOINT, VITE_VITALS_SAMPLE_RATE: '1' },
      sendBeacon,
      logger: makeLogger(),
      pathname: () => '/dashboard',
    });

    sink.onMetric(makeMetric());
    sink.flush();
    sink.flush();

    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });

  it('applies the sample rate with the injected RNG', () => {
    const sendBeacon = makeBeacon();
    const logger = makeLogger();

    const sampled = createVitalsSink({
      env: { VITE_VITALS_ENDPOINT: ENDPOINT },
      rng: () => 0.05,
      sendBeacon,
      logger,
      pathname: () => '/dashboard',
    });
    expect(sampled.active).toBe(true);

    const unsampled = createVitalsSink({
      env: { VITE_VITALS_ENDPOINT: ENDPOINT },
      rng: () => 0.5,
      sendBeacon,
      logger,
      pathname: () => '/dashboard',
    });
    expect(unsampled.active).toBe(false);

    unsampled.onMetric(makeMetric());
    unsampled.flush();
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it('never samples when VITE_VITALS_SAMPLE_RATE is 0', () => {
    const sink = createVitalsSink({
      env: { VITE_VITALS_ENDPOINT: ENDPOINT, VITE_VITALS_SAMPLE_RATE: '0' },
      rng: () => 0,
      sendBeacon: makeBeacon(),
      logger: makeLogger(),
    });
    expect(sink.active).toBe(false);
  });

  it('warns and disables itself for an invalid endpoint', () => {
    const logger = makeLogger();
    const sink = createVitalsSink({
      env: { VITE_VITALS_ENDPOINT: 'javascript:alert(1)' },
      sendBeacon: makeBeacon(),
      logger,
    });

    expect(sink.active).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith('[Web Vitals] ignoring invalid VITE_VITALS_ENDPOINT');
  });

  it('never throws when the beacon throws', () => {
    const sendBeacon = vi.fn(() => {
      throw new Error('beacon exploded');
    });
    const logger = makeLogger();
    const sink = createVitalsSink({
      env: { VITE_VITALS_ENDPOINT: ENDPOINT, VITE_VITALS_SAMPLE_RATE: '1' },
      sendBeacon,
      logger,
      pathname: () => '/dashboard',
    });

    sink.onMetric(makeMetric());
    expect(() => sink.flush()).not.toThrow();
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      '[Web Vitals] failed to send vitals beacon',
      expect.any(Error),
    );
  });

  it('never throws when the pathname provider throws', () => {
    const logger = makeLogger();
    const sink = createVitalsSink({
      env: { VITE_VITALS_ENDPOINT: ENDPOINT, VITE_VITALS_SAMPLE_RATE: '1' },
      sendBeacon: makeBeacon(),
      logger,
      pathname: () => {
        throw new Error('location unavailable');
      },
    });

    expect(() => sink.onMetric(makeMetric())).not.toThrow();
    expect(logger.error).toHaveBeenCalledWith(
      '[Web Vitals] sink failed to record metric',
      expect.any(Error),
    );
  });

  it('returns an inert sink instead of throwing when setup fails', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const sink = createVitalsSink({
      env: { VITE_VITALS_ENDPOINT: ENDPOINT },
      rng: () => {
        throw new Error('rng down');
      },
    });

    expect(sink.active).toBe(false);
    expect(() => sink.onMetric(makeMetric())).not.toThrow();
    expect(() => sink.flush()).not.toThrow();
    expect(consoleError).toHaveBeenCalled();
  });

  it('routes dev logging through the logger rather than the console', () => {
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = makeLogger();
    const sink = createVitalsSink({ env: {}, sendBeacon: makeBeacon(), logger });

    sink.onMetric(makeMetric());

    expect(logger.info).toHaveBeenCalledWith('[Web Vitals]', expect.objectContaining({ name: 'CLS' }));
    expect(consoleInfo).not.toHaveBeenCalled();
  });

  it('auto-flushes from a microtask when the page becomes hidden', async () => {
    let visibilityState: DocumentVisibilityState = 'visible';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibilityState });

    const sendBeacon = makeBeacon();
    const sink = createVitalsSink({
      env: { VITE_VITALS_ENDPOINT: ENDPOINT, VITE_VITALS_SAMPLE_RATE: '1' },
      sendBeacon,
      logger: makeLogger(),
      pathname: () => '/dashboard',
    });

    sink.onMetric(makeMetric());
    visibilityState = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();

    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });

  it('auto-flushes on pagehide', async () => {
    const sendBeacon = makeBeacon();
    const sink = createVitalsSink({
      env: { VITE_VITALS_ENDPOINT: ENDPOINT, VITE_VITALS_SAMPLE_RATE: '1' },
      sendBeacon,
      logger: makeLogger(),
      pathname: () => '/dashboard',
    });

    sink.onMetric(makeMetric());
    window.dispatchEvent(new Event('pagehide'));
    await Promise.resolve();

    expect(sendBeacon).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event('pagehide'));
    await Promise.resolve();
    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });
});
