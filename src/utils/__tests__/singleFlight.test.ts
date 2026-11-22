import { describe, expect, it, vi } from 'vitest';
import { createSingleFlightRunner } from '../singleFlight';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createSingleFlightRunner', () => {
  it('throws TypeError when runner is not a function', () => {
    for (const invalid of [null, undefined, 42, 'fn', {}]) {
      expect(() =>
        createSingleFlightRunner(invalid as unknown as () => Promise<unknown>),
      ).toThrow(TypeError);
    }
  });

  it('coalesces concurrent run() calls into one execution, returns the same promise, and uses first caller arguments', async () => {
    const deferred = createDeferred<string>();
    const fn = vi.fn((id: number) => deferred.promise);
    const runner = createSingleFlightRunner(fn);

    expect(runner.isPending()).toBe(false);

    const a = runner.run(1);
    const b = runner.run(2);

    expect(a).toBe(b);
    expect(runner.isPending()).toBe(true);

    deferred.resolve('ok');

    await expect(a).resolves.toBe('ok');
    await expect(b).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);
    expect(runner.isPending()).toBe(false);
  });

  it('starts a new execution on a third call after resolution', async () => {
    const first = createDeferred<string>();
    const second = createDeferred<string>();
    const fn = vi
      .fn<(id: number) => Promise<string>>()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const runner = createSingleFlightRunner(fn);

    const a = runner.run(1);
    const b = runner.run(2);
    expect(a).toBe(b);

    first.resolve('first-result');
    await expect(a).resolves.toBe('first-result');
    expect(runner.isPending()).toBe(false);

    const c = runner.run(3);
    expect(c).not.toBe(a);
    expect(runner.isPending()).toBe(true);

    second.resolve('second-result');
    await expect(c).resolves.toBe('second-result');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, 1);
    expect(fn).toHaveBeenNthCalledWith(2, 3);
    expect(runner.isPending()).toBe(false);
  });

  it('clears isPending() after rejection and allows subsequent calls to run normally', async () => {
    const first = createDeferred<string>();
    const second = createDeferred<string>();
    const fn = vi
      .fn<(id: number) => Promise<string>>()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const runner = createSingleFlightRunner(fn);

    const a = runner.run(1);
    const b = runner.run(2);
    expect(a).toBe(b);
    expect(runner.isPending()).toBe(true);

    first.reject(new Error('network failure'));

    await expect(a).rejects.toThrow('network failure');
    await expect(b).rejects.toThrow('network failure');
    expect(runner.isPending()).toBe(false);

    const c = runner.run(3);
    expect(c).not.toBe(a);
    expect(runner.isPending()).toBe(true);

    second.resolve('recovered');
    await expect(c).resolves.toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, 1);
    expect(fn).toHaveBeenNthCalledWith(2, 3);
    expect(runner.isPending()).toBe(false);
  });

  it('recovers when the underlying runner throws synchronously', async () => {
    const fn = vi
      .fn<(id: number) => Promise<string>>()
      .mockImplementationOnce(() => {
        throw new Error('sync failure');
      })
      .mockResolvedValueOnce('after-sync-throw');
    const runner = createSingleFlightRunner(fn);

    await expect(runner.run(1)).rejects.toThrow('sync failure');
    expect(runner.isPending()).toBe(false);

    await expect(runner.run(2)).resolves.toBe('after-sync-throw');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(runner.isPending()).toBe(false);
  });
});
