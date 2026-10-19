/**
 * vaultService.ts
 *
 * Promise-based data layer for vault operations.
 *
 * Currently backed by mock data copied verbatim from VaultDetail.tsx
 * (the canonical source). Replace only the internals of each function
 * with real Soroban/Horizon calls when the backend is ready — the page
 * components depend only on the Promise-based interface and will need
 * zero changes.
 */

import type { Vault, VaultTransaction, Milestone } from "../types/vault";
import { MASTER_VAULTS } from "../fixtures/vaults";
import { MASTER_ACTIVITY } from "../fixtures/transactions";
import { cached, invalidate, type CacheOptions } from "./queryCache";

/**
 * Drop cached reads affected by a vault write. Call after any successful
 * mutation (create, validate, fail, ...).
 */
export function invalidateVaultCaches(id?: string): void {
  invalidate("vaults");
  invalidate("activity");
  invalidate(id === undefined ? "vault:" : `vault:${id}`);
}

// ── Re-export canonical types for consumers that need them ────────────────────
export type { Vault, VaultTransaction };

// ── Rich transaction record for the all-vaults explorer page ─────────────────
// NOT the same as VaultTransaction — this type carries fee, block, from/to/memo
// data that is specific to the VaultTransactions explorer view.
export interface VaultActivityRecord {
  id: string;
  type: "create" | "validate" | "release" | "redirect";
  vault: string;
  amount: number;
  fee: number;
  block: number;
  hash: string;
  status: "confirmed" | "pending" | "failed";
  from: string;
  to: string;
  timestamp: Date;
  memo: string;
}

// ── Mock datasets moved to src/fixtures/ ──────────────────────────────────────
// MASTER_VAULTS lives in src/fixtures/vaults.ts and MASTER_ACTIVITY in
// src/fixtures/transactions.ts. They are imported above so this module stays a
// thin Promise-based seam. See docs/VAULT_DATA_LAYER.md.

// ── Service API ───────────────────────────────────────────────────────────────
// SEAM: Replace only the internals of these functions with Soroban/Horizon calls
// when the real backend lands. Page components depend solely on the
// Promise-based interface below and will need zero changes.

/**
 * Return all vaults.
 *
 * SEAM → replace with: Horizon account fetch + Soroban contract reads.
 */
export async function listVaults(options?: CacheOptions): Promise<Vault[]> {
  return cached("vaults", async () => Object.values(MASTER_VAULTS), options);
}

/**
 * Return a single vault by id, or undefined if not found.
 * Does NOT throw for unknown ids — callers rely on the undefined branch.
 *
 * SEAM → replace with: Soroban contract state read for a given contract address.
 */
export async function getVault(
  id: string,
  options?: CacheOptions,
): Promise<Vault | undefined> {
  // Map-backed cache: ids such as "__proto__" cannot pollute keys.
  return cached(`vault:${id}`, async () => MASTER_VAULTS[id], options);
}

/**
 * Return the on-chain transactions stored on a specific vault.
 * Returns [] for unknown ids.
 *
 * SEAM → replace with: Horizon `/transactions?account=<contractAddress>` + filter.
 */
export async function getTransactions(id: string): Promise<VaultTransaction[]> {
  return (await getVault(id))?.transactions ?? [];
}

/**
 * Return the current in-memory activity snapshot synchronously.
 *
 * This keeps the mock-backed UI populated on first render while the Promise
 * seam remains the long-term replacement point for live Horizon/Soroban data.
 */
export function getCachedActivity(): VaultActivityRecord[] {
  return [...MASTER_ACTIVITY];
}

/**
 * Return the rich activity feed used by the VaultTransactions explorer page.
 *
 * SEAM → replace with: Horizon transaction stream aggregated across all vault
 * contract addresses.
 */
export async function listAllActivity(
  options?: CacheOptions,
): Promise<VaultActivityRecord[]> {
  return cached("activity", async () => [...MASTER_ACTIVITY], options);
}

/**
 * Create a new vault in mock memory.
 * 
 * SEAM → replace with: Soroban contract initialization invocation.
 */
export async function createVault(vaultData: {
  name: string;
  amount: number;
  currency: string;
  deadline: string;
  creatorAddress: string;
  successAddress: string;
  failureAddress: string;
  milestones: Omit<Milestone, "id" | "status">[];
}): Promise<Vault> {
  const nextId = String(Object.keys(MASTER_VAULTS).length + 1);
  const newVault: Vault = {
    id: nextId,
    name: vaultData.name,
    status: "active",
    amount: vaultData.amount,
    currency: vaultData.currency,
    createdAt: new Date().toISOString(),
    deadline: vaultData.deadline,
    creatorAddress: vaultData.creatorAddress,
    successAddress: vaultData.successAddress,
    failureAddress: vaultData.failureAddress,
    contractAddress: `GCONT${nextId}KQKM4XNQPBEZMXPOLKQKM4XNQPBEZMXPOLKQK`,
    milestones: vaultData.milestones.map((m, index) => ({
      ...m,
      id: `m${nextId}_${index + 1}`,
      status: "pending"
    })),
    transactions: [
      {
        id: `tx${nextId}_1`,
        type: "create",
        hash: `mockhash${nextId}234567890abcdef123456`,
        timestamp: new Date().toISOString(),
        amount: vaultData.amount,
      }
    ]
  };
  MASTER_VAULTS[nextId] = newVault;
  invalidateVaultCaches(nextId);
  return newVault;
}
