import { describe, it, expect, vi, beforeAll } from 'vitest';
import { getAtRiskVaults } from '../atRiskVaults';

const fixedNow = new Date('2026-07-27T00:00:00Z');

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(fixedNow);
});

// Helper: build a vault object with defaults
function vault(overrides: Partial<{
  id: string;
  name: string;
  amount: number;
  currency: string;
  status: string;
  deadline: string;
  progressPct: number;
}> = {}) {
  return {
    id: 'v-1',
    name: 'Test Vault',
    amount: 1000,
    currency: 'USDC',
    status: 'active',
    deadline: '2026-08-10T00:00:00Z',
    progressPct: 50,
    ...overrides,
  };
}

describe('getAtRiskVaults', () => {
  it('returns an empty array when no vaults are provided', () => {
    expect(getAtRiskVaults([])).toEqual([]);
  });

  it('returns nothing when all vaults are safe (> 7 days)', () => {
    const vaults = [
      vault({ id: '1', deadline: '2026-08-10T00:00:00Z', status: 'active' }),
      vault({ id: '2', deadline: '2026-09-01T00:00:00Z', status: 'pending_validation' }),
    ];
    expect(getAtRiskVaults(vaults)).toEqual([]);
  });

  it('returns vaults with critical urgency (≤ 24 h)', () => {
    const criticalDeadline = new Date(fixedNow.getTime() + 6 * 60 * 60 * 1000).toISOString();
    const vaults = [
      vault({ id: '1', deadline: criticalDeadline, status: 'active' }),
    ];
    const result = getAtRiskVaults(vaults);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
    expect(result[0].status).toBe('active');
  });

  it('returns vaults with soon urgency (> 24 h and ≤ 7 d)', () => {
    const soonDeadline = new Date(fixedNow.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const vaults = [
      vault({ id: '2', deadline: soonDeadline, status: 'pending_validation' }),
    ];
    const result = getAtRiskVaults(vaults);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
    expect(result[0].status).toBe('pending_validation');
  });

  it('excludes completed vaults even when deadline is critical', () => {
    const criticalDeadline = new Date(fixedNow.getTime() + 3 * 60 * 60 * 1000).toISOString();
    const vaults = [
      vault({ id: '1', deadline: criticalDeadline, status: 'completed' }),
      vault({ id: '2', deadline: criticalDeadline, status: 'active' }),
    ];
    const result = getAtRiskVaults(vaults);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('excludes failed vaults even when deadline is soon', () => {
    const soonDeadline = new Date(fixedNow.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const vaults = [
      vault({ id: '1', deadline: soonDeadline, status: 'failed' }),
      vault({ id: '2', deadline: soonDeadline, status: 'pending_validation' }),
    ];
    const result = getAtRiskVaults(vaults);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('excludes expired deadlines (returned as safe by deadlineUrgency)', () => {
    const expiredDeadline = '2024-01-01T00:00:00Z';
    const vaults = [
      vault({ id: '1', deadline: expiredDeadline, status: 'active' }),
    ];
    expect(getAtRiskVaults(vaults)).toEqual([]);
  });

  it('returns both critical and soon vaults together', () => {
    const criticalDeadline = new Date(fixedNow.getTime() + 2 * 60 * 60 * 1000).toISOString();
    const soonDeadline = new Date(fixedNow.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString();
    const safeDeadline = '2026-09-01T00:00:00Z';
    const vaults = [
      vault({ id: 'critical-active', deadline: criticalDeadline, status: 'active' }),
      vault({ id: 'soon-pending', deadline: soonDeadline, status: 'pending_validation' }),
      vault({ id: 'safe-active', deadline: safeDeadline, status: 'active' }),
    ];
    const result = getAtRiskVaults(vaults);
    expect(result).toHaveLength(2);
    expect(result.map((v) => v.id).sort()).toEqual(['critical-active', 'soon-pending']);
  });
});
