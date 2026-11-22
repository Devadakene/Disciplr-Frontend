import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toUtcIso, fromUtcIsoToLocalInput } from '../format';

const ZONES = [
  {
    tz: 'America/New_York',
    juneOffsetMin: 240, // EDT, UTC-4
    summerLocal: '2025-06-15T14:30',
    summerUtc: '2025-06-15T18:30:00.000Z',
    winterLocal: '2025-01-15T09:00',
    winterUtc: '2025-01-15T14:00:00.000Z', // EST, UTC-5
  },
  {
    tz: 'Europe/London',
    juneOffsetMin: -60, // BST, UTC+1
    summerLocal: '2025-06-15T14:30',
    summerUtc: '2025-06-15T13:30:00.000Z',
    winterLocal: '2025-01-15T09:00',
    winterUtc: '2025-01-15T09:00:00.000Z', // GMT
  },
  {
    tz: 'Asia/Kolkata',
    juneOffsetMin: -330, // IST, UTC+5:30, no DST
    summerLocal: '2025-06-15T14:30',
    summerUtc: '2025-06-15T09:00:00.000Z',
    winterLocal: '2025-01-15T09:00',
    winterUtc: '2025-01-15T03:30:00.000Z',
  },
];

afterEach(() => {
  vi.unstubAllEnvs(); // restores TZ to its original state
});

describe.each(ZONES)('toUtcIso / fromUtcIsoToLocalInput in $tz', (z) => {
  beforeEach(() => {
    vi.stubEnv('TZ', z.tz);
  });

  it('TZ override is actually applied (guards against a silent UTC fallback)', () => {
    expect(new Date(2025, 5, 15, 12, 0).getTimezoneOffset()).toBe(z.juneOffsetMin);
  });

  it('converts local input to the expected UTC instant', () => {
    expect(toUtcIso(z.summerLocal)).toBe(z.summerUtc);
    expect(toUtcIso(z.winterLocal)).toBe(z.winterUtc);
  });

  it('round-trips ordinary dates: fromUtcIsoToLocalInput(toUtcIso(x)) === x', () => {
    for (const x of [z.summerLocal, z.winterLocal, '2025-12-31T23:59', '2025-02-28T00:00']) {
      expect(fromUtcIsoToLocalInput(toUtcIso(x))).toBe(x);
    }
  });
});

describe('America/New_York DST edges', () => {
  beforeEach(() => {
    vi.stubEnv('TZ', 'America/New_York');
  });

  /**
   * Spring-forward gap: on 2025-03-09 clocks jump from 02:00 EST straight to 03:00 EDT,
   * so local 02:30 does not exist. Chosen behaviour (the JS Date default): the nonexistent
   * time is resolved forward, using the offset from before the jump, i.e. 02:30 EST = 07:30Z,
   * which displays as 03:30 EDT. It is always a valid instant at or after the gap end (07:00Z).
   * Consequence: the round trip is NOT identity for gap times; it returns 03:30.
   */
  it('resolves a nonexistent spring-forward time to a valid instant after the gap', () => {
    const iso = toUtcIso('2025-03-09T02:30');
    expect(iso).not.toBe('');
    const instant = new Date(iso).getTime();
    expect(Number.isNaN(instant)).toBe(false);
    expect(instant).toBeGreaterThanOrEqual(Date.parse('2025-03-09T07:00:00.000Z'));
    expect(iso).toBe('2025-03-09T07:30:00.000Z');
    expect(fromUtcIsoToLocalInput(iso)).toBe('2025-03-09T03:30');
  });

  /**
   * Fall-back overlap: on 2025-11-02 clocks go from 02:00 EDT back to 01:00 EST, so local
   * 01:30 happens twice (05:30Z and 06:30Z). Chosen behaviour (the JS Date default): the
   * result is deterministic, and it is one of the two valid instants (the earlier, 05:30Z).
   */
  it('resolves an ambiguous fall-back time deterministically', () => {
    const first = toUtcIso('2025-11-02T01:30');
    const second = toUtcIso('2025-11-02T01:30');
    expect(first).toBe(second);
    expect(['2025-11-02T05:30:00.000Z', '2025-11-02T06:30:00.000Z']).toContain(first);
    expect(fromUtcIsoToLocalInput(first)).toBe('2025-11-02T01:30');
  });
});

describe('invalid input returns the documented fallback (empty string) and never throws', () => {
  it.each(['', '   ', 'not-a-date', '2025-13-45T99:99'])('toUtcIso(%j)', (input) => {
    expect(() => toUtcIso(input)).not.toThrow();
    expect(toUtcIso(input)).toBe('');
  });

  it.each(['', '   ', 'not-a-date', '2025-13-45T99:99'])('fromUtcIsoToLocalInput(%j)', (input) => {
    expect(() => fromUtcIsoToLocalInput(input)).not.toThrow();
    expect(fromUtcIsoToLocalInput(input)).toBe('');
  });
});