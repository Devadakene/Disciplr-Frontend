// @vitest-environment jsdom
/**
 * Tests for the error reporter (issue: make error recovery and error
 * reporting actually work).
 *
 * The reporter is the single place a failure is normalised, redacted, logged
 * and (for failures the user would otherwise never see) surfaced as a toast.
 * These tests pin the invariants the rest of the app relies on:
 *   - the in-memory buffer is bounded,
 *   - the reporter never throws, even when the sink or the logger throws,
 *   - duplicate failures inside the notify window collapse into one toast,
 *   - async failures (window `error`, `unhandledrejection`) are captured.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ERROR_REPORT_BUFFER_LIMIT,
  ERROR_REPORT_MAX_TEXT_LENGTH,
  ERROR_REPORT_NOTIFY_WINDOW_MS,
  getRecentErrorReports,
  installGlobalErrorHandlers,
  normalizeErrorReason,
  redactErrorText,
  reportError,
  resetErrorReporterForTests,
  setErrorReportSink,
  shouldNotifyError,
  type ErrorReport,
} from '../errorReporter';
import {
  __resetToastStoreForTests,
  useToastStore,
} from '../../Zustand/toastStore';

/** A syntactically valid Stellar StrKey (G + 55 base32 characters). */
const STELLAR_ADDRESS = `G${'A'.repeat(55)}`;

function toastCount(): number {
  return useToastStore.getState().toasts.length;
}

/**
 * jsdom may not implement `PromiseRejectionEvent`, and the reporter only reads
 * `event.reason`, so fall back to a synthetic event carrying a `reason`.
 */
function createRejectionEvent(reason: unknown): Event {
  if (typeof PromiseRejectionEvent === 'function') {
    return new PromiseRejectionEvent('unhandledrejection', {
      promise: Promise.resolve(),
      reason,
    });
  }
  const event = new Event('unhandledrejection');
  Object.assign(event, { reason });
  return event;
}

function createErrorEvent(error: unknown, message: string): Event {
  if (typeof ErrorEvent === 'function') {
    try {
      return new ErrorEvent('error', { error, message });
    } catch {
      // Older implementations reject the `error` init member — fall through.
    }
  }
  const event = new Event('error');
  Object.assign(event, { error, message });
  return event;
}

/**
 * A plain `Event` carrying `error`/`message`. jsdom treats a real, non-canceled
 * `ErrorEvent` dispatched on `window` with no listener as an uncaught exception
 * and fails the run, which would mask the assertion under test.
 */
function createSyntheticErrorEvent(error: unknown, message: string): Event {
  const event = new Event('error');
  Object.assign(event, { error, message });
  return event;
}

describe('reportError', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetErrorReporterForTests();
    __resetToastStoreForTests();
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    resetErrorReporterForTests();
    __resetToastStoreForTests();
    vi.unstubAllGlobals();
  });

  it('normalises the error, keeps the caller reference ID and records it', () => {
    const report = reportError({
      error: new Error('boom'),
      source: 'boundary',
      referenceId: 'ref-123',
    });

    expect(report).toMatchObject({
      referenceId: 'ref-123',
      source: 'boundary',
      name: 'Error',
      message: 'boom',
    });
    expect(getRecentErrorReports()).toHaveLength(1);
  });

  it('generates a reference ID when the caller does not supply one', () => {
    const report = reportError({ error: new Error('boom'), source: 'window' });

    expect(report?.referenceId).toBeTruthy();
    expect(typeof report?.referenceId).toBe('string');
  });

  it('delivers the report to a configured sink', () => {
    const sink = vi.fn();
    setErrorReportSink(sink);

    const report = reportError({ error: new Error('boom'), source: 'window' });

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith(report);
  });

  it('logs the reference ID shown in the UI so support can correlate it', () => {
    const report = reportError({
      error: new Error('boom'),
      source: 'boundary',
    });

    const logged = consoleSpy.mock.calls.find(
      (call: unknown[]) => call[0] === '[error-report]',
    );
    expect(logged).toBeDefined();
    expect(logged?.[1]).toMatchObject({ referenceId: report?.referenceId });
  });

  it('records the route for support triage', () => {
    const explicit = reportError({
      error: new Error('a'),
      source: 'window',
      route: '/vaults/7',
    });
    expect(explicit?.route).toBe('/vaults/7');

    window.history.replaceState({}, '', '/dashboard');
    const inferred = reportError({ error: new Error('b'), source: 'window' });
    expect(inferred?.route).toBe('/dashboard');
    window.history.replaceState({}, '', '/');
  });

  it('caps the in-memory buffer, dropping the oldest report', () => {
    for (let index = 0; index < ERROR_REPORT_BUFFER_LIMIT + 5; index += 1) {
      reportError({ error: new Error(`e${index}`), source: 'window' });
    }

    const reports = getRecentErrorReports();
    expect(reports).toHaveLength(ERROR_REPORT_BUFFER_LIMIT);
    expect(reports[0].message).toBe('e5');
    expect(reports[reports.length - 1].message).toBe(
      `e${ERROR_REPORT_BUFFER_LIMIT + 4}`,
    );
  });

  it('never throws when the sink throws, and still records the report', () => {
    setErrorReportSink(() => {
      throw new Error('metrics backend down');
    });

    let report: ErrorReport | null = null;
    expect(() => {
      report = reportError({ error: new Error('boom'), source: 'window' });
    }).not.toThrow();

    expect(report).not.toBeNull();
    expect(getRecentErrorReports()).toHaveLength(1);
  });

  it('never throws when the logger throws', () => {
    consoleSpy.mockImplementation(() => {
      throw new Error('logger down');
    });

    let report: ErrorReport | null = null;
    expect(() => {
      report = reportError({ error: new Error('boom'), source: 'window' });
    }).not.toThrow();

    expect(report).not.toBeNull();
    expect(getRecentErrorReports()).toHaveLength(1);
  });

  it('redacts wallet addresses before they reach the logger or a sink', () => {
    const sink = vi.fn();
    setErrorReportSink(sink);

    const report = reportError({
      error: new Error(`transfer to ${STELLAR_ADDRESS} failed`),
      source: 'window',
    });

    expect(report?.message).not.toContain(STELLAR_ADDRESS);
    expect(report?.message).toContain('[redacted-address]');
    expect((sink.mock.calls[0][0] as ErrorReport).message).not.toContain(
      STELLAR_ADDRESS,
    );
  });

  it('caps recorded message length', () => {
    const report = reportError({
      error: new Error('x'.repeat(ERROR_REPORT_MAX_TEXT_LENGTH + 100)),
      source: 'window',
    });

    expect(report?.message.endsWith('…')).toBe(true);
    expect((report?.message ?? '').length).toBeLessThanOrEqual(
      ERROR_REPORT_MAX_TEXT_LENGTH + 1,
    );
  });

  it('shows a toast for async sources but not for boundaries', () => {
    reportError({ error: new Error('render crash'), source: 'boundary' });
    expect(toastCount()).toBe(0);

    reportError({ error: new Error('promise crash'), source: 'promise' });
    expect(toastCount()).toBe(1);
  });

  it('throttles duplicates: ten identical errors in 5s produce one toast', () => {
    const error = new Error('duplicate');

    for (let index = 0; index < 10; index += 1) {
      reportError({ error, source: 'window' });
    }

    expect(toastCount()).toBe(1);
    // Throttling only affects the notification; every failure is still recorded.
    expect(getRecentErrorReports()).toHaveLength(10);
  });

  it('notifies again once the notify window has elapsed', () => {
    const report: ErrorReport = {
      referenceId: 'ref',
      source: 'window',
      name: 'Error',
      message: 'throttled failure',
      ts: 1_000,
    };

    // First occurrence notifies, duplicates inside the window do not...
    expect(shouldNotifyError(report, 1_000)).toBe(true);
    expect(
      shouldNotifyError(report, 1_000 + ERROR_REPORT_NOTIFY_WINDOW_MS - 1),
    ).toBe(false);
    // ...and once the window elapses the same failure notifies again.
    expect(shouldNotifyError(report, 1_000 + ERROR_REPORT_NOTIFY_WINDOW_MS)).toBe(
      true,
    );
  });
});

describe('normalizeErrorReason', () => {
  it('keeps Error name and message', () => {
    expect(normalizeErrorReason(new TypeError('bad type'))).toEqual({
      name: 'TypeError',
      message: 'bad type',
    });
  });

  it('names the error when the message is empty', () => {
    const error = new Error('');
    expect(normalizeErrorReason(error).name).toBe('Error');
  });

  it('normalises non-Error rejection reasons', () => {
    expect(normalizeErrorReason('string reason')).toEqual({
      name: 'Error',
      message: 'string reason',
    });
    expect(normalizeErrorReason(null)).toEqual({
      name: 'Error',
      message: 'null',
    });
    expect(normalizeErrorReason(undefined)).toEqual({
      name: 'Error',
      message: 'undefined',
    });
    expect(normalizeErrorReason(42)).toEqual({ name: 'Error', message: '42' });
    expect(normalizeErrorReason({ code: 'E1' })).toEqual({
      name: 'Error',
      message: '{"code":"E1"}',
    });
  });

  it('survives a circular reason without throwing', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(normalizeErrorReason(circular).name).toBe('Error');
    expect(normalizeErrorReason(circular).message).toBeTruthy();
  });
});

describe('redactErrorText', () => {
  it('replaces Stellar StrKeys with a placeholder', () => {
    expect(redactErrorText(`paid ${STELLAR_ADDRESS}`)).toBe(
      'paid [redacted-address]',
    );
  });

  it('leaves ordinary text untouched', () => {
    expect(redactErrorText('network request failed')).toBe(
      'network request failed',
    );
  });
});

describe('installGlobalErrorHandlers', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetErrorReporterForTests();
    __resetToastStoreForTests();
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    resetErrorReporterForTests();
    __resetToastStoreForTests();
  });

  it('captures a window "error" event once with source "window"', () => {
    installGlobalErrorHandlers();

    window.dispatchEvent(createErrorEvent(new Error('window boom'), 'window boom'));

    const reports = getRecentErrorReports();
    expect(reports).toHaveLength(1);
    expect(reports[0].source).toBe('window');
    expect(reports[0].message).toBe('window boom');
  });

  it('captures an unhandled rejection with source "promise" and toasts once', () => {
    installGlobalErrorHandlers();

    window.dispatchEvent(createRejectionEvent(new Error('promise boom')));

    const reports = getRecentErrorReports();
    expect(reports).toHaveLength(1);
    expect(reports[0].source).toBe('promise');
    expect(reports[0].message).toBe('promise boom');
    expect(toastCount()).toBe(1);
  });

  it('normalises a non-Error rejection reason', () => {
    installGlobalErrorHandlers();

    window.dispatchEvent(createRejectionEvent('plain string reason'));

    expect(getRecentErrorReports()[0].message).toBe('plain string reason');
  });

  it('installs the listeners only once', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');

    installGlobalErrorHandlers();
    installGlobalErrorHandlers();

    const types = addSpy.mock.calls.map((call: unknown[]) => call[0]);
    expect(types.filter((type) => type === 'error')).toHaveLength(1);
    expect(types.filter((type) => type === 'unhandledrejection')).toHaveLength(1);
  });

  it('the returned disposer uninstalls both listeners', () => {
    // An isolated target: dispatching an unhandled "error" event straight on
    // `window` is reported by the test environment as an uncaught exception.
    const target = new EventTarget();
    const dispose = installGlobalErrorHandlers(target as unknown as Window);

    target.dispatchEvent(
      createSyntheticErrorEvent(new Error('while installed'), 'while installed'),
    );
    expect(getRecentErrorReports()).toHaveLength(1);

    dispose();
    target.dispatchEvent(
      createSyntheticErrorEvent(new Error('after dispose'), 'after dispose'),
    );
    expect(getRecentErrorReports()).toHaveLength(1);
  });
});
