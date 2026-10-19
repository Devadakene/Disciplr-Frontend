/**
 * Shared vault and validation status types.
 *
 * Single source of truth for the status unions that were previously redeclared
 * (and had drifted out of sync) across Dashboard, Vaults, VaultDetail,
 * VaultCard, and VaultTransactions. Every `VaultStatus` is a valid
 * `ChipStatus` in `components/StatusChip.tsx`, so any vault status can be passed
 * straight to `<StatusChip />`.
 */

/** Lifecycle state of a vault. Superset of every variant used across pages. */
export type VaultStatus =
  | 'active'
  | 'pending_validation'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** State of an individual milestone within a vault. */
export type MilestoneStatus = 'pending' | 'validated' | 'failed';

/** On-chain transaction category. */
export type TxType = 'create' | 'validate' | 'release' | 'redirect';

/** Confirmation state of an on-chain transaction. */
export type TxStatus = 'confirmed' | 'pending' | 'failed';

/**
 * Canonical display order for vault statuses, used for consistent sorting.
 * Contains every `VaultStatus` member exactly once, ordered from most to least
 * active.
 */
export const VAULT_STATUS_ORDER: readonly VaultStatus[] = [
  'active',
  'pending_validation',
  'completed',
  'failed',
  'cancelled',
] as const;

/** A single milestone within a vault. */
export interface Milestone {
  id: string;
  title: string;
  description: string;
  criteria: string;
  status: MilestoneStatus;
  validatedAt?: string;
  dueDate?: string;
  evidenceUrl?: string;
}

/** A weightless on-chain transaction record stored on the Vault itself. */
export interface VaultTransaction {
  id: string;
  type: TxType;
  hash: string;
  timestamp: string;
  amount?: number;
}

/** Full vault record — canonical shape used across all pages. */
export interface Vault {
  id: string;
  name: string;
  status: VaultStatus;
  amount: number;
  currency: string;
  createdAt: string;
  deadline: string;
  creatorAddress: string;
  verifierAddress?: string;
  successAddress: string;
  failureAddress: string;
  contractAddress: string;
  milestones: Milestone[];
  transactions: VaultTransaction[];
}

/**
 * Actions a wallet can perform on a vault. Shared between the UI
 * (`VaultDetail`), the service seam (`submitVaultAction`), and the
 * permission evaluator (`evalVaultActionAuth`).
 */
export type VaultAction = 'validate_milestone' | 'extend_deadline' | 'cancel_vault';
