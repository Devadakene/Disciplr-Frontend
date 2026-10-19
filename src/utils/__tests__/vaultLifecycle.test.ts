import { describe, expect, it } from 'vitest';
import { vaultLifecycleStages, timelineProgress } from '../vaultLifecycle';

const states = (status: string) =>
  vaultLifecycleStages(status).map((stage) => [stage.id, stage.state, stage.label]);

describe('vaultLifecycleStages', () => {
  it('maps active vaults to the active step', () => {
    expect(states('active')).toEqual([
      ['created', 'done', 'Created'],
      ['active', 'current', 'Active'],
      ['pending_validation', 'upcoming', 'Pending Validation'],
      ['completed', 'upcoming', 'Completed'],
    ]);
  });

  it('maps pending validation vaults to the validation step', () => {
    expect(states('pending_validation')).toEqual([
      ['created', 'done', 'Created'],
      ['active', 'done', 'Active'],
      ['pending_validation', 'current', 'Pending Validation'],
      ['completed', 'upcoming', 'Completed'],
    ]);
  });

  it('maps completed vaults to the completed step', () => {
    expect(states('completed')).toEqual([
      ['created', 'done', 'Created'],
      ['active', 'done', 'Active'],
      ['pending_validation', 'done', 'Pending Validation'],
      ['completed', 'current', 'Completed'],
    ]);
  });

  it('renders failed and cancelled as terminal stages', () => {
    const failed = vaultLifecycleStages('failed');
    const cancelled = vaultLifecycleStages('cancelled');

    expect(failed.at(-1)).toMatchObject({
      id: 'failed',
      label: 'Failed',
      state: 'current',
      terminal: true,
    });
    expect(cancelled.at(-1)).toMatchObject({
      id: 'cancelled',
      label: 'Cancelled',
      state: 'current',
      terminal: true,
    });
  });

  it('falls back safely for unknown statuses', () => {
    expect(states('unknown')).toEqual([
      ['created', 'current', 'Created'],
      ['active', 'upcoming', 'Active'],
      ['pending_validation', 'upcoming', 'Pending Validation'],
      ['completed', 'upcoming', 'Completed'],
    ]);
  });
});

describe('timelineProgress', () => {
  const created = '2026-01-01T00:00:00.000Z';
  const deadline = '2026-01-11T00:00:00.000Z'; // 10 days duration

  const startMs = new Date(created).getTime();
  const endMs = new Date(deadline).getTime();

  it('calculates exact progress percentage during vault lifetime', () => {
    const halfwayMs = startMs + 5 * 24 * 60 * 60 * 1000;
    expect(timelineProgress(created, deadline, halfwayMs)).toBe(50);
  });

  it('clamps progress to 0 before creation date', () => {
    const beforeStartMs = startMs - 1000;
    expect(timelineProgress(created, deadline, beforeStartMs)).toBe(0);
  });

  it('clamps progress to 100 after deadline date', () => {
    const afterEndMs = endMs + 1000;
    expect(timelineProgress(created, deadline, afterEndMs)).toBe(100);
  });

  it('handles equal created and deadline timestamps without NaN divide-by-zero', () => {
    const sameTime = '2026-01-01T00:00:00.000Z';
    const sameMs = new Date(sameTime).getTime();

    const progressAtSameTime = timelineProgress(sameTime, sameTime, sameMs);
    expect(progressAtSameTime).toBe(100);
    expect(Number.isNaN(progressAtSameTime)).toBe(false);

    const progressBeforeSameTime = timelineProgress(sameTime, sameTime, sameMs - 1000);
    expect(progressBeforeSameTime).toBe(0);
    expect(Number.isNaN(progressBeforeSameTime)).toBe(false);
  });

  it('handles deadline earlier than created date safely', () => {
    const start = '2026-01-10T00:00:00.000Z';
    const end = '2026-01-01T00:00:00.000Z';
    const now = new Date(start).getTime() + 1000;

    expect(timelineProgress(start, end, now)).toBe(100);
  });

  it('returns 0 for invalid date strings', () => {
    expect(timelineProgress('invalid-date', deadline)).toBe(0);
    expect(timelineProgress(created, 'invalid-date')).toBe(0);
  });
});

