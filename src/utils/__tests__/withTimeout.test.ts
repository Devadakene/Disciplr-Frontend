import { afterEach, describe, expect, it, vi } from 'vitest';
import { withTimeout, ConnectTimeoutError } from '../withTimeout';

describe('withTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('resolves before timeout', async () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();

    const result = await withTimeout(Promise.resolve('done'), 500, onTimeout);

    expect(result).toBe('done');
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('rejects before timeout', async () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const error = new Error('boom');

    await expect(withTimeout(Promise.reject(error), 500, onTimeout)).rejects.toBe(error);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('rejects with ConnectTimeoutError when the deadline expires', async () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const promise = new Promise<string>((resolve) => {
      setTimeout(() => resolve('late'), 1_000);
    });

    const pending = withTimeout(promise, 100, onTimeout);
    vi.advanceTimersByTime(100);

    await expect(pending).rejects.toBeInstanceOf(ConnectTimeoutError);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(onTimeout).toHaveBeenCalledWith(100);
  });

  it('cleans up timeout resources', async () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    const onTimeout = vi.fn();

    await expect(withTimeout(Promise.resolve('done'), 500, onTimeout)).resolves.toBe('done');

    expect(clearSpy).toHaveBeenCalled();
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
