// This suite exercises browser-only globals (window, PerformanceObserver,
// document.visibilityState), which the project's default vitest environment
// for plain .test.ts files ('node', see vitest.config.ts) does not provide.
// Force jsdom for this file so reportWebVitals() reaches the
// PerformanceObserver wiring under test.
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { reportWebVitals, type Metric } from '../reportWebVitals';
import { createVitalsSink } from '../vitalsSink';

type ObserverCallback = (list: { getEntries: () => PerformanceEntry[] }) => void;
type VitestMock = ReturnType<typeof vi.fn>;

const SUPPORTED_ENTRY_TYPES = ['largest-contentful-paint', 'layout-shift', 'event', 'first-input'];

class FakePerformanceObserver {
  static supportedEntryTypes: readonly string[] = [...SUPPORTED_ENTRY_TYPES];
  static instances: FakePerformanceObserver[] = [];
  static failConstruct = false;
  static failObserveTypes = new Set<string>();

  static reset(): void {
    FakePerformanceObserver.instances = [];
    FakePerformanceObserver.supportedEntryTypes = [...SUPPORTED_ENTRY_TYPES];
    FakePerformanceObserver.failConstruct = false;
    FakePerformanceObserver.failObserveTypes = new Set();
  }

  readonly observedTypes = new Set<string>();
  readonly optionsByType = new Map<string, { type: string; buffered?: boolean; durationThreshold?: number }>();
  disconnected = false;

  private readonly callback: ObserverCallback;

  constructor(callback: ObserverCallback) {
    if (FakePerformanceObserver.failConstruct) {
      throw new Error('PerformanceObserver construction failed');
    }
    this.callback = callback;
    FakePerformanceObserver.instances.push(this);
  }

  observe(options: { type: string; buffered?: boolean; durationThreshold?: number }): void {
    if (!FakePerformanceObserver.supportedEntryTypes.includes(options.type)) {
      throw new TypeError(`Unsupported entry type: ${options.type}`);
    }
    if (FakePerformanceObserver.failObserveTypes.has(options.type)) {
      throw new TypeError(`observe() failed for entry type: ${options.type}`);
    }
    this.observedTypes.add(options.type);
    this.optionsByType.set(options.type, options);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  takeRecords(): PerformanceEntry[] {
    return [];
  }
}

function emit(type: string, entries: PerformanceEntry[]): void {
  for (const instance of FakePerformanceObserver.instances) {
    if (!instance.disconnected && instance.observedTypes.has(type)) {
      instance.callback({ getEntries: () => entries });
    }
  }
}

function shift(startTime: number, value: number, hadRecentInput = false): PerformanceEntry {
  return {
    entryType: 'layout-shift',
    name: 'layout-shift',
    startTime,
    duration: 0,
    hadRecentInput,
    value,
  } as PerformanceEntry;
}

function eventEntry(options: { interactionId: number; duration: number; startTime?: number; entryType?: string }): PerformanceEntry {
  const startTime = options.startTime ?? 0;
  return {
    entryType: options.entryType ?? 'event',
    name: 'click',
    startTime,
    duration: options.duration,
    interactionId: options.interactionId,
    // Deliberately large: the reporter must use `duration`, not input delay.
    processingStart: startTime + 1000,
    processingEnd: startTime + 1000 + options.duration,
  } as PerformanceEntry;
}

function lcpEntry(renderTime: number): PerformanceEntry {
  return {
    entryType: 'largest-contentful-paint',
    name: 'img',
    startTime: renderTime,
    duration: 0,
    renderTime,
    loadTime: 0,
  } as PerformanceEntry;
}

let visibilityState: DocumentVisibilityState = 'visible';

function setVisibilityState(state: DocumentVisibilityState): void {
  visibilityState = state;
}

function goHidden(): void {
  setVisibilityState('hidden');
  document.dispatchEvent(new Event('visibilitychange'));
}

function goVisible(): void {
  setVisibilityState('visible');
  document.dispatchEvent(new Event('visibilitychange'));
}

function restoreFromBfcache(persisted: boolean): void {
  const event = new Event('pageshow');
  Object.defineProperty(event, 'persisted', { value: persisted });
  window.dispatchEvent(event);
}

function metricsNamed(callback: VitestMock, name: Metric['name']): Metric[] {
  return callback.mock.calls
    .map((call) => call[0] as Metric)
    .filter((metric) => metric.name === name);
}

function makeLogger(): { info: VitestMock; warn: VitestMock; error: VitestMock } {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('reportWebVitals', () => {
  beforeEach(() => {
    FakePerformanceObserver.reset();
    (globalThis as { PerformanceObserver?: unknown }).PerformanceObserver = FakePerformanceObserver;
    visibilityState = 'visible';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibilityState });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(document, 'visibilityState');
  });

  describe('callback wiring and environment guards', () => {
    it('does nothing without a usable callback', () => {
      reportWebVitals();
      reportWebVitals(undefined);
      reportWebVitals(null as never);
      reportWebVitals('not a function' as never);
      expect(FakePerformanceObserver.instances).toHaveLength(0);
    });

    it('does not throw when PerformanceObserver is missing', () => {
      delete (globalThis as { PerformanceObserver?: unknown }).PerformanceObserver;
      expect(() => reportWebVitals(vi.fn())).not.toThrow();
    });

    it('returns early when window is undefined (SSR)', () => {
      const originalWindow = globalThis.window;
      delete (globalThis as { window?: unknown }).window;
      try {
        reportWebVitals(vi.fn());
        expect(FakePerformanceObserver.instances).toHaveLength(0);
      } finally {
        globalThis.window = originalWindow;
      }
    });

    it('observes every metric with the expected options', () => {
      reportWebVitals(vi.fn());

      const eventObserver = FakePerformanceObserver.instances.find((instance) =>
        instance.observedTypes.has('event'),
      );
      expect(eventObserver).toBeDefined();
      expect(eventObserver?.optionsByType.get('event')).toEqual({
        type: 'event',
        buffered: true,
        durationThreshold: 40,
      });
      expect(eventObserver?.observedTypes.has('first-input')).toBe(true);

      const types = FakePerformanceObserver.instances.flatMap((instance) => [...instance.observedTypes]);
      expect(types).toContain('layout-shift');
      expect(types).toContain('largest-contentful-paint');
    });

    it('skips metrics whose entry type is unsupported and keeps the rest', () => {
      FakePerformanceObserver.supportedEntryTypes = ['largest-contentful-paint', 'event', 'first-input'];
      const callback = vi.fn();
      reportWebVitals(callback);

      emit('layout-shift', [shift(0, 0.4)]);
      emit('largest-contentful-paint', [lcpEntry(1000)]);
      expect(() => goHidden()).not.toThrow();

      expect(metricsNamed(callback, 'CLS')).toHaveLength(0);
      expect(metricsNamed(callback, 'LCP')).toHaveLength(1);
    });

    it('tolerates observe() throwing for an entry type', () => {
      FakePerformanceObserver.failObserveTypes.add('layout-shift');
      const callback = vi.fn();
      expect(() => reportWebVitals(callback)).not.toThrow();

      emit('layout-shift', [shift(0, 0.7)]);
      expect(() => goHidden()).not.toThrow();
      expect(metricsNamed(callback, 'CLS')).toHaveLength(0);
    });

    it('tolerates a PerformanceObserver constructor failure', () => {
      FakePerformanceObserver.failConstruct = true;
      const callback = vi.fn();
      expect(() => reportWebVitals(callback)).not.toThrow();

      expect(() => goHidden()).not.toThrow();
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('INP', () => {
    it('groups events by interactionId, keeps the longest duration and reports once at page hide', () => {
      const callback = vi.fn();
      reportWebVitals(callback);

      emit('event', [
        eventEntry({ interactionId: 0, duration: 480, startTime: 10 }),
        eventEntry({ interactionId: 7, duration: 60, startTime: 100 }),
        eventEntry({ interactionId: 7, duration: 90, startTime: 150 }),
        eventEntry({ interactionId: 7, duration: 40, startTime: 200 }),
      ]);

      expect(callback).not.toHaveBeenCalled();

      goHidden();

      const inp = metricsNamed(callback, 'INP');
      expect(inp).toHaveLength(1);
      expect(inp[0].value).toBe(90);
      expect(inp[0].rating).toBe('good');
    });

    it('reports the p98 estimate across 60 interactions', () => {
      const callback = vi.fn();
      reportWebVitals(callback);

      emit(
        'event',
        Array.from({ length: 60 }, (_, index) =>
          eventEntry({ interactionId: index + 1, duration: (index + 1) * 10 }),
        ),
      );

      goHidden();

      const inp = metricsNamed(callback, 'INP');
      expect(inp).toHaveLength(1);
      // Interactions rank 600ms (1st) down to 10ms (60th); the p98 slot for
      // 60 interactions is floor(60 / 50) = 1, i.e. the second-longest.
      expect(inp[0].value).toBe(590);
      expect(inp[0].rating).toBe('poor');
    });

    it('ignores events without an interactionId', () => {
      const callback = vi.fn();
      reportWebVitals(callback);

      emit('event', [
        eventEntry({ interactionId: 0, duration: 500, startTime: 10 }),
        eventEntry({ interactionId: 0, duration: 700, startTime: 20 }),
      ]);
      emit('first-input', [eventEntry({ interactionId: 0, duration: 300, entryType: 'first-input' })]);

      goHidden();

      expect(metricsNamed(callback, 'INP')).toHaveLength(0);
    });

    it('includes first-input interactions carrying an interactionId', () => {
      const callback = vi.fn();
      reportWebVitals(callback);

      emit('first-input', [
        eventEntry({ interactionId: 3, duration: 35, startTime: 5, entryType: 'first-input' }),
      ]);

      goHidden();

      const inp = metricsNamed(callback, 'INP');
      expect(inp).toHaveLength(1);
      expect(inp[0].value).toBe(35);
    });
  });

  describe('CLS', () => {
    it('reports the largest session window rather than the lifetime sum', () => {
      const callback = vi.fn();
      reportWebVitals(callback);

      emit('layout-shift', [shift(0, 0.1)]);
      emit('layout-shift', [shift(500, 0.2)]);
      emit('layout-shift', [shift(7000, 0.05)]);

      goHidden();

      const cls = metricsNamed(callback, 'CLS');
      expect(cls).toHaveLength(1);
      // Windows: [0ms..500ms] = 0.3, [7000ms] = 0.05. The lifetime sum
      // (0.35) must not be reported.
      expect(cls[0].value).toBeCloseTo(0.3, 10);
    });

    it('caps a session window at 5 seconds', () => {
      const callback = vi.fn();
      reportWebVitals(callback);

      for (const startTime of [0, 900, 1800, 2700, 3600, 4500]) {
        emit('layout-shift', [shift(startTime, 0.05)]);
      }
      // Only 900ms after the previous shift, but 5.4s after the window
      // start: a new window must begin here.
      emit('layout-shift', [shift(5400, 0.05)]);

      goHidden();

      const cls = metricsNamed(callback, 'CLS');
      expect(cls).toHaveLength(1);
      expect(cls[0].value).toBeCloseTo(0.3, 10);
    });

    it('excludes shifts flagged hadRecentInput', () => {
      const callback = vi.fn();
      reportWebVitals(callback);

      emit('layout-shift', [shift(0, 0.05)]);
      emit('layout-shift', [shift(100, 0.9, true)]);

      goHidden();

      const cls = metricsNamed(callback, 'CLS');
      expect(cls).toHaveLength(1);
      expect(cls[0].value).toBeCloseTo(0.05, 10);
    });

    it('does not report until the page is hidden', () => {
      const callback = vi.fn();
      reportWebVitals(callback);

      emit('layout-shift', [shift(0, 0.2)]);
      expect(callback).not.toHaveBeenCalled();

      goHidden();
      expect(metricsNamed(callback, 'CLS')).toHaveLength(1);
    });
  });

  describe('LCP', () => {
    it('reports once after the first pointerdown and ignores later entries', () => {
      const callback = vi.fn();
      reportWebVitals(callback);

      emit('largest-contentful-paint', [lcpEntry(1200)]);
      expect(callback).not.toHaveBeenCalled();

      window.dispatchEvent(new Event('pointerdown'));

      let lcp = metricsNamed(callback, 'LCP');
      expect(lcp).toHaveLength(1);
      expect(lcp[0].value).toBe(1200);

      emit('largest-contentful-paint', [lcpEntry(2400)]);
      window.dispatchEvent(new Event('pointerdown'));
      goHidden();

      lcp = metricsNamed(callback, 'LCP');
      expect(lcp).toHaveLength(1);
      expect(lcp[0].value).toBe(1200);
    });

    it('reports once after the first keydown', () => {
      const callback = vi.fn();
      reportWebVitals(callback);

      emit('largest-contentful-paint', [lcpEntry(900)]);
      window.dispatchEvent(new Event('keydown'));
      goHidden();

      const lcp = metricsNamed(callback, 'LCP');
      expect(lcp).toHaveLength(1);
      expect(lcp[0].value).toBe(900);
    });

    it('reports once at page hide when there is no input', () => {
      const callback = vi.fn();
      reportWebVitals(callback);

      emit('largest-contentful-paint', [lcpEntry(1500)]);
      expect(callback).not.toHaveBeenCalled();

      goHidden();

      const lcp = metricsNamed(callback, 'LCP');
      expect(lcp).toHaveLength(1);
      expect(lcp[0].value).toBe(1500);
    });

    it('carries a stable per-load id, a delta equal to its value and a rating', () => {
      const callback = vi.fn();
      reportWebVitals(callback);

      emit('largest-contentful-paint', [lcpEntry(1500)]);
      goHidden();

      const [metric] = metricsNamed(callback, 'LCP');
      expect(metric.id).toMatch(/^v1-\d{13}-\d{13}$/);
      expect(metric.delta).toBe(metric.value);
      expect(metric.rating).toBe('good');
      expect(typeof metric.navigationType).toBe('string');
    });
  });

  describe('finalisation', () => {
    it('reports final CLS and INP exactly once on visibilitychange to hidden', () => {
      const callback = vi.fn();
      reportWebVitals(callback);

      emit('layout-shift', [shift(0, 0.1)]);
      emit('event', [eventEntry({ interactionId: 5, duration: 250 })]);

      goHidden();
      expect(metricsNamed(callback, 'CLS')).toHaveLength(1);
      expect(metricsNamed(callback, 'INP')).toHaveLength(1);

      goHidden();
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('finalises on pagehide even while visible', () => {
      const callback = vi.fn();
      reportWebVitals(callback);

      emit('layout-shift', [shift(0, 0.15)]);
      window.dispatchEvent(new Event('pagehide'));

      const cls = metricsNamed(callback, 'CLS');
      expect(cls).toHaveLength(1);
      expect(cls[0].value).toBeCloseTo(0.15, 10);
    });

    it('resets and reports a fresh set of metrics after a bfcache restore', () => {
      const callback = vi.fn();
      reportWebVitals(callback);

      emit('layout-shift', [shift(0, 0.5)]);
      goHidden();

      const [first] = metricsNamed(callback, 'CLS');
      expect(first.value).toBeCloseTo(0.5, 10);

      goVisible();
      restoreFromBfcache(true);

      const clsObservers = FakePerformanceObserver.instances.filter((instance) =>
        instance.observedTypes.has('layout-shift'),
      );
      const rearmedReader = clsObservers[clsObservers.length - 1];
      expect(rearmedReader?.optionsByType.get('layout-shift')?.buffered).toBe(false);

      emit('layout-shift', [shift(0, 0.2)]);
      goHidden();

      const reported = metricsNamed(callback, 'CLS');
      expect(reported).toHaveLength(2);
      expect(reported[1].value).toBeCloseTo(0.2, 10);
      expect(reported[1].id).not.toBe(reported[0].id);
    });

    it('ignores pageshow events that are not bfcache restores', () => {
      const callback = vi.fn();
      reportWebVitals(callback);

      emit('layout-shift', [shift(0, 0.5)]);
      goHidden();
      expect(callback).toHaveBeenCalledTimes(1);

      const observerCount = FakePerformanceObserver.instances.length;
      restoreFromBfcache(false);
      expect(FakePerformanceObserver.instances.length).toBe(observerCount);

      emit('layout-shift', [shift(0, 0.3)]);
      goHidden();
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('error isolation', () => {
    it('never lets a throwing callback escape and logs the failure', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const callback = vi.fn(() => {
        throw new Error('Callback error');
      });

      reportWebVitals(callback);
      expect(() => goHidden()).not.toThrow();

      expect(consoleError).toHaveBeenCalledWith(
        'Web Vitals reporter callback threw an error:',
        expect.any(Error),
      );
    });
  });

  describe('vitals sink integration', () => {
    it('flushes final metrics as one sendBeacon batch on page hide', async () => {
      const sendBeacon = vi.fn((_url: string, _body: Blob) => true);
      const sinkLogger = makeLogger();
      const sink = createVitalsSink({
        env: { VITE_VITALS_ENDPOINT: 'https://collector.example/vitals', VITE_VITALS_SAMPLE_RATE: '1' },
        rng: () => 0,
        sendBeacon,
        logger: sinkLogger,
        pathname: () => '/vaults/abc123?wallet=0xdead',
        now: () => 1700000000000,
      });
      expect(sink.active).toBe(true);

      reportWebVitals((metric) => sink.onMetric(metric));
      emit('layout-shift', [shift(0, 0.05)]);

      goHidden();
      await Promise.resolve();

      expect(sendBeacon).toHaveBeenCalledTimes(1);
      const [url, body] = sendBeacon.mock.calls[0];
      expect(url).toBe('https://collector.example/vitals');
      expect(body.type).toBe('application/json');

      const payload = JSON.parse(await body.text());
      expect(payload.ts).toBe(1700000000000);
      const cls = payload.metrics.find((metric: { name: string }) => metric.name === 'CLS');
      expect(cls).toBeDefined();
      expect(cls.value).toBeCloseTo(0.05, 10);
      expect(cls.path).toBe('/vaults/:id');
      expect(cls.id).toMatch(/^v1-\d{13}-\d{13}$/);
    });
  });
});
