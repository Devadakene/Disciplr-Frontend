import { describe, expect, it } from 'vitest';
import type { ValidationTask } from '../../Zustand/Store';
import { CRITICAL_DAYS_THRESHOLD, computeVerifierMetrics } from '../verifierMetrics';

function task(overrides: Partial<ValidationTask> = {}): ValidationTask {
  return {
    id: 't',
    vaultName: 'V',
    owner: '0xowner',
    amount: '1,000 USDC',
    deadline: '2026-01-01',
    status: 'pending',
    milestone: 'M',
    ...overrides,
  };
}

describe('CRITICAL_DAYS_THRESHOLD', () => {
  it('is 3 days', () => {
    expect(CRITICAL_DAYS_THRESHOLD).toBe(3);
  });
});

describe('computeVerifierMetrics', () => {
  it('returns all-zero metrics for empty inputs', () => {
    expect(computeVerifierMetrics([], [])).toEqual({
      pendingCount: 0,
      overdueCount: 0,
      criticalCount: 0,
      approvalRate: 0,
      urgentCount: 0,
      totalResolved: 0,
    });
  });

  it('counts pending, overdue, and critical tasks', () => {
    const now = new Date('2026-06-01T00:00:00Z').getTime();
    const metrics = computeVerifierMetrics(
      [
        task({ id: 'a', deadline: '2026-05-31' }),
        task({ id: 'b', deadline: '2026-06-03' }),
        task({ id: 'c', deadline: '2026-06-09' }),
      ],
      [],
      now,
    );

    expect(metrics.pendingCount).toBe(3);
    expect(metrics.overdueCount).toBe(1);
    expect(metrics.criticalCount).toBe(1);
    expect(metrics.urgentCount).toBe(1);
  });

  it('does not count overdue tasks as urgent (mutual exclusivity)', () => {
    const now = new Date('2026-06-01T00:00:00Z').getTime();
    const metrics = computeVerifierMetrics(
      [
        task({ id: 'overdue-past', deadline: '2026-05-28' }),
        task({ id: 'overdue-today', deadline: '2026-06-01' }),
        task({ id: 'urgent-1d', deadline: '2026-06-02' }),
        task({ id: 'urgent-3d', deadline: '2026-06-04' }),
        task({ id: 'ok', deadline: '2026-06-10' }),
      ],
      [],
      now,
    );

    expect(metrics.overdueCount).toBe(2);
    expect(metrics.criticalCount).toBe(2);
    expect(metrics.urgentCount).toBe(2);
    expect(metrics.overdueCount + metrics.urgentCount).toBeLessThanOrEqual(
      metrics.pendingCount,
    );
  });

  it('computes approval rate from decided history only', () => {
    const metrics = computeVerifierMetrics(
      [],
      [task({ id: 'h1', status: 'approved' }), task({ id: 'h2', status: 'approved' }), task({ id: 'h3', status: 'rejected' })],
    );

    expect(metrics.approvalRate).toBeCloseTo(2 / 3, 5);
    expect(metrics.totalResolved).toBe(3);
  });

  it('supports undefined and null inputs', () => {
    expect(computeVerifierMetrics(undefined, null)).toEqual({
      pendingCount: 0,
      overdueCount: 0,
      criticalCount: 0,
      approvalRate: 0,
      urgentCount: 0,
      totalResolved: 0,
    });
  });
});
