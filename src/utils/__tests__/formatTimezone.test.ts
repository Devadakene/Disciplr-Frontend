import { describe, it, expect } from 'vitest';
import { toUtcIso } from '../format';

describe('format timezone round-trip with TZ', () => {
  it('converts 2026-11-01T09:00 in Europe/London to 2026-11-01T09:00:00.000Z', () => {
    const originalTz = process.env.TZ;
    process.env.TZ = 'Europe/London';
    try {
      const iso = toUtcIso('2026-11-01T09:00');
      expect(iso).toBe('2026-11-01T09:00:00.000Z');
    } finally {
      process.env.TZ = originalTz;
    }
  });
});
