import { afterEach, describe, expect, it, vi } from 'vitest';
import { createReferenceId } from '../referenceId';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('createReferenceId', () => {
  it('returns the randomUUID result verbatim', () => {
    const randomUUID = vi.fn(() => 'custom-reference-id');
    const getRandomValues = vi.fn();
    vi.stubGlobal('crypto', { randomUUID, getRandomValues });

    expect(createReferenceId()).toBe('custom-reference-id');
    expect(randomUUID).toHaveBeenCalledOnce();
    expect(getRandomValues).not.toHaveBeenCalled();
  });

  it('uses getRandomValues when randomUUID throws', () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.fill(0xab);
      return bytes;
    });
    vi.stubGlobal('crypto', {
      randomUUID: () => {
        throw new Error('insecure');
      },
      getRandomValues,
    });

    expect(createReferenceId()).toBe('ab'.repeat(16));
    expect(getRandomValues).toHaveBeenCalledOnce();
    expect(getRandomValues.mock.calls[0][0]).toBeInstanceOf(Uint8Array);
    expect(getRandomValues.mock.calls[0][0]).toHaveLength(16);
  });

  it('uses a distinct timestamp-based value when crypto is unavailable', () => {
    vi.stubGlobal('crypto', undefined);
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.2);

    const first = createReferenceId();
    const second = createReferenceId();

    expect(first).toMatch(/^[0-9a-z]{9,}$/);
    expect(second).toMatch(/^[0-9a-z]{9,}$/);
    expect(first).not.toBe(second);
  });

  it('uses the timestamp fallback when both crypto methods throw', () => {
    vi.stubGlobal('crypto', {
      randomUUID: () => {
        throw new Error('insecure');
      },
      getRandomValues: () => {
        throw new Error('unavailable');
      },
    });

    expect(createReferenceId()).toMatch(/^[0-9a-z]{9,}$/);
  });
});
