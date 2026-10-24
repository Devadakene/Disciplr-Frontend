// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  useConnectivityStore,
  getBackoffDelay,
  resetBackoffSchedule,
  initConnectivityListeners,
} from '../connectivity';

describe('Connectivity Monitor & Store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_API', 'https://api.disciplr.example');
    useConnectivityStore.getState().reset();
    resetBackoffSchedule();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('starts in online state with no probe in progress', () => {
    const state = useConnectivityStore.getState();
    expect(state.status).toBe('online');
    expect(state.probeInProgress).toBe(false);
    expect(state.lastHealthyAt).toBeNull();
  });

  it('transitions to api-down on reportApiFailure(0) or reportApiFailure(503)', () => {
    useConnectivityStore.getState().reportApiFailure(0);
    expect(useConnectivityStore.getState().status).toBe('api-down');

    useConnectivityStore.getState().reset();
    useConnectivityStore.getState().reportApiFailure(503);
    expect(useConnectivityStore.getState().status).toBe('api-down');
  });

  it('does not transition or probe on reportApiFailure(400) or reportApiFailure(404)', () => {
    useConnectivityStore.getState().reportApiFailure(400);
    expect(useConnectivityStore.getState().status).toBe('online');

    useConnectivityStore.getState().reportApiFailure(404);
    expect(useConnectivityStore.getState().status).toBe('online');
  });

  it('executes exponential backoff from 2s up to 60s cap on repeated failures', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
    global.fetch = fetchMock;

    useConnectivityStore.getState().reportApiFailure(0);
    expect(getBackoffDelay()).toBe(2000);

    // Fast-forward 2 seconds
    await vi.advanceTimersByTimeAsync(2000);
    expect(getBackoffDelay()).toBe(4000);

    // Fast-forward 4 seconds
    await vi.advanceTimersByTimeAsync(4000);
    expect(getBackoffDelay()).toBe(8000);

    // Fast-forward 8 seconds
    await vi.advanceTimersByTimeAsync(8000);
    expect(getBackoffDelay()).toBe(16000);

    // Fast-forward 16 seconds
    await vi.advanceTimersByTimeAsync(16000);
    expect(getBackoffDelay()).toBe(32000);

    // Fast-forward 32 seconds
    await vi.advanceTimersByTimeAsync(32000);
    expect(getBackoffDelay()).toBe(60000); // capped at 60s
  });

  it('clears backoff and returns to online when probe succeeds', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });
    global.fetch = fetchMock;

    useConnectivityStore.getState().reportApiFailure(0);
    expect(useConnectivityStore.getState().status).toBe('api-down');

    await vi.advanceTimersByTimeAsync(2000);
    expect(useConnectivityStore.getState().status).toBe('online');
    expect(useConnectivityStore.getState().lastHealthyAt).not.toBeNull();
    expect(getBackoffDelay()).toBe(2000);
  });

  it('does zero polling in steady online state', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    await vi.advanceTimersByTimeAsync(60000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retryNow triggers immediate health probe and resets delay', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });
    global.fetch = fetchMock;

    useConnectivityStore.getState().setStatus('api-down');
    const result = await useConnectivityStore.getState().retryNow();

    expect(result).toBe(true);
    expect(useConnectivityStore.getState().status).toBe('online');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('pauses probing when document is hidden', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
    global.fetch = fetchMock;

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });

    useConnectivityStore.getState().reportApiFailure(0);

    await vi.advanceTimersByTimeAsync(2000);
    // When hidden, probe is skipped
    expect(fetchMock).not.toHaveBeenCalled();

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
  });
});
