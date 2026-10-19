import type { VaultStatus } from '../types/vault';

export type VaultLifecycleStageState = 'done' | 'current' | 'upcoming';

export interface VaultLifecycleStage {
  id: string;
  label: string;
  state: VaultLifecycleStageState;
  terminal?: boolean;
}

const isVaultStatus = (status: string): status is VaultStatus =>
  ['active', 'pending_validation', 'completed', 'failed', 'cancelled'].includes(status);

const finalStageFor = (status: VaultStatus): VaultLifecycleStage => {
  if (status === 'failed') {
    return { id: 'failed', label: 'Failed', state: 'current', terminal: true };
  }

  if (status === 'cancelled') {
    return { id: 'cancelled', label: 'Cancelled', state: 'current', terminal: true };
  }

  return {
    id: 'completed',
    label: 'Completed',
    state: status === 'completed' ? 'current' : 'upcoming',
  };
};

export function vaultLifecycleStages(status: VaultStatus | string): VaultLifecycleStage[] {
  if (!isVaultStatus(status)) {
    return [
      { id: 'created', label: 'Created', state: 'current' },
      { id: 'active', label: 'Active', state: 'upcoming' },
      { id: 'pending_validation', label: 'Pending Validation', state: 'upcoming' },
      { id: 'completed', label: 'Completed', state: 'upcoming' },
    ];
  }

  const activeHasPassed = status !== 'active';
  const validationHasPassed = ['completed', 'failed', 'cancelled'].includes(status);

  return [
    { id: 'created', label: 'Created', state: 'done' },
    {
      id: 'active',
      label: 'Active',
      state: status === 'active' ? 'current' : 'done',
    },
    {
      id: 'pending_validation',
      label: 'Pending Validation',
      state: status === 'pending_validation' ? 'current' : activeHasPassed && validationHasPassed ? 'done' : 'upcoming',
    },
    finalStageFor(status),
  ];
}

/**
 * Calculates percentage progress between creation and deadline dates.
 * Clamps result between 0 and 100, guarding against invalid dates and equal timestamps.
 */
export function timelineProgress(
  created: string,
  deadline: string,
  now: number = Date.now(),
): number {
  const start = new Date(created).getTime();
  const end = new Date(deadline).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return 0;
  }

  if (end <= start) {
    return now >= start ? 100 : 0;
  }

  const progress = ((now - start) / (end - start)) * 100;
  return Math.min(100, Math.max(0, progress));
}

