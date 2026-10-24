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
import {
  isValidVaultRouteId,
  isValidStellarAddress,
  isVaultAction,
  lookupVaultSafe,
  type VaultAction,
} from "../utils/vaultState";
import { createSingleFlightRunner } from "../utils/singleFlight";
import { normalizeEvidenceUrl } from "../utils/url";
import {
  isApiEnabled,
  apiListVaults,
  apiGetVault,
  apiCreateVault,
  apiValidateNextMilestone,
  apiFailVault,
  apiListActivity,
  apiListTransactions,
  apiStats,
  buildVaultQuery,
  type ApiStats,
  type VaultFilter,
} from "./api";
import {
  getDemoStore,
  demoCreateVault,
  demoValidateMilestone,
  demoFailVault,
  mergeDemoVaults,
  mergeDemoActivity,
  isDemoId,
} from "./demoStore";

/**
 * Drop cached reads affected by a vault write. Call after any successful
 * mutation (create, validate, fail, ...).
 */
export function invalidateVaultCaches(id?: string): void {
  invalidate("vaults");
  invalidate("activity");
  invalidate("stats");
  invalidate(id === undefined ? "vault:" : `vault:${id}`);
}

export { MASTER_VAULTS } from "../fixtures/vaults";
export { CreateIntegrityError, type IntegrityMismatches, type IntegrityDiff } from "./createIntegrity";

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

// ── Demo mode routing state ──────────────────────────────────────────────────
// Driven explicitly by WalletProvider via setDemoMode(boolean), not global
// React state polling.
let demoModeActive = false;

export function setDemoMode(active: boolean): void {
  demoModeActive = active;
}

export function isDemoModeActive(): boolean {
  return demoModeActive;
}

// ── Service API ───────────────────────────────────────────────────────────────
// SEAM: Replace only the internals of these functions with Soroban/Horizon calls
// when the real backend lands. Page components depend solely on the
// Promise-based interface below and will need zero changes.

export type { VaultFilter } from "./api";

/** Offline equivalent of the API's `?creator=&status=` query, for fixtures. */
export function filterVaults(vaults: Vault[], filter?: VaultFilter): Vault[] {
  if (!filter?.creator && !filter?.status) return vaults;
  return vaults.filter(
    (v) =>
      (!filter.creator || v.creatorAddress === filter.creator) &&
      (!filter.status || v.status === filter.status),
  );
}

/**
 * Return vaults, optionally narrowed by creator and/or status. The filter is
 * sent to the API (`GET /vaults?creator=`) and applied locally for fixtures.
 * In demo mode, live reads (or mock data) are merged with demo overlay vaults.
 *
 * SEAM → replace with: Horizon account fetch + Soroban contract reads.
 */
export async function listVaults(
  filter?: VaultFilter,
  options?: CacheOptions,
): Promise<Vault[]> {
  const baseVaults = await cached(
    `vaults${buildVaultQuery(filter)}`,
    async () => {
      if (isApiEnabled()) return apiListVaults(filter);
      return filterVaults(Object.values(MASTER_VAULTS), filter);
    },
    options,
  );

  // The demo overlay is local and never cached, so demo writes show up at once.
  if (demoModeActive) {
    return filterVaults(mergeDemoVaults(baseVaults), filter);
  }
  return baseVaults;
}

/** Summary stats scoped to a creator (`GET /stats?creator=`); null offline. */
export async function getStats(
  { creator }: { creator: string },
  options?: CacheOptions,
): Promise<ApiStats | null> {
  if (!isApiEnabled()) return null;
  return cached(`stats${buildVaultQuery({ creator })}`, () => apiStats(creator), options);
}

/** A raw vault transaction tagged with the vault it belongs to. */
export interface VaultTxRecord {
  id: string;
  type: string;
  vaultId: string;
  amount: number;
  timestamp: string;
}

/**
 * Transactions belonging to the given vaults only. With the API this reads
 * `GET /transactions` and filters to the vault ids; offline it reads the
 * transactions embedded in the vaults.
 */
export async function listTransactionsForVaults(vaults: Vault[]): Promise<VaultTxRecord[]> {
  const ids = new Set(vaults.map((v) => v.id));
  if (ids.size === 0) return [];
  if (isApiEnabled()) {
    const all = await apiListTransactions();
    return all
      .filter((a) => ids.has(a.vaultId))
      .map((a) => ({
        id: a.id,
        type: a.type,
        vaultId: a.vaultId,
        amount: Number(a.amount),
        timestamp: a.createdAt,
      }));
  }
  return vaults.flatMap((v) =>
    (v.transactions ?? []).map((t) => ({
      id: t.id,
      type: t.type,
      vaultId: v.id,
      amount: t.amount ?? 0,
      timestamp: t.timestamp,
    })),
  );
}

/**
 * Return a single vault by id, or undefined if not found.
 * In demo mode, if the id is a demo id or exists in the overlay, it returns
 * from the overlay without hitting the network.
 * Demo ids must never hit the API.
 *
 * SEAM → replace with: Soroban contract state read for a given contract address.
 */
export async function getVault(
  id: string,
  options?: CacheOptions,
): Promise<Vault | undefined> {
  if (!isValidVaultRouteId(id)) return undefined;

  // Demo IDs must never be sent to the API
  if (isDemoId(id)) {
    return getDemoStore().vaults[id];
  }

  // If in demo mode and an overlay version exists for this id, return it
  if (demoModeActive) {
    const overlayVault = getDemoStore().vaults[id];
    if (overlayVault) return overlayVault;
  }

  // Map-backed cache: ids such as "__proto__" cannot pollute keys.
  return cached(
    `vault:${id}`,
    async () => (isApiEnabled() ? apiGetVault(id) : lookupVaultSafe(MASTER_VAULTS, id)),
    options,
  );
}

/**
 * Return the on-chain transactions stored on a specific vault.
 * Returns [] for unknown ids.
 *
 * SEAM → replace with: Horizon `/transactions?account=<contractAddress>` + filter.
 */
export async function getTransactions(id: string): Promise<VaultTransaction[]> {
  const vault = await getVault(id);
  return vault?.transactions ?? [];
}

/**
 * Return the current in-memory activity snapshot synchronously.
 */
export function getCachedActivity(): VaultActivityRecord[] {
  const base = [...MASTER_ACTIVITY];
  if (demoModeActive) {
    return mergeDemoActivity(base);
  }
  return base;
}

/**
 * Return the rich activity feed used by the Transactions explorer page.
 * Merges demo overlay activity when demo mode is active.
 *
 * SEAM → replace with: Horizon transaction stream aggregated across all vault
 * contract addresses.
 */
export async function listAllActivity(
  options?: CacheOptions,
): Promise<VaultActivityRecord[]> {
  const base = await cached(
    "activity",
    async () => (isApiEnabled() ? apiListActivity() : [...MASTER_ACTIVITY]),
    options,
  );

  if (demoModeActive) {
    return mergeDemoActivity(base);
  }
  return base;
}

/**
 * Create a new vault.
 * Routes to the demoStore overlay when demo mode is active (no API POST).
 * 
 * SEAM → replace with: Soroban contract initialization invocation.
 */
export async function createVault(vaultData: {
  name: string;
  amount: number;
  currency: string;
  deadline: string;
  creatorAddress: string;
  verifierAddress: string;
  successAddress: string;
  failureAddress: string;
  evidenceUrl?: string;
  milestones: Omit<Milestone, "id" | "status">[];
}): Promise<Vault> {
  if (!vaultData.name || vaultData.name.trim().length === 0) {
    throw new Error("Vault name is required.");
  }
  if (!Number.isFinite(vaultData.amount) || vaultData.amount <= 0) {
    throw new Error("Vault amount must be a positive finite number.");
  }

  if (demoModeActive) {
    return demoCreateVault(vaultData);
  }

  if (isApiEnabled()) {
    // Creator acts as their own verifier unless the API is given another one.
    const created = await apiCreateVault({
      name: vaultData.name,
      amount: vaultData.amount,
      deadline: vaultData.deadline,
      creator: vaultData.creatorAddress,
      verifier: vaultData.verifierAddress,
      successAddress: vaultData.successAddress,
      failureAddress: vaultData.failureAddress,
      milestones: vaultData.milestones,
    });
    invalidateVaultCaches(created.id);
    return created;
  }

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
    verifierAddress: vaultData.verifierAddress,
    successAddress: vaultData.successAddress,
    failureAddress: vaultData.failureAddress,
    contractAddress: `GCONT${nextId}KQKM4XNQPBEZMXPOLKQKM4XNQPBEZMXPOLKQK`,
    milestones: vaultData.milestones.map(({ evidenceUrl: milestoneEvidence, ...m }, index) => {
      const rawEvidence =
        milestoneEvidence ?? (index === 0 ? vaultData.evidenceUrl : undefined);
      const safeEvidence = rawEvidence
        ? normalizeEvidenceUrl(rawEvidence) ?? undefined
        : undefined;
      return {
        ...m,
        ...(safeEvidence ? { evidenceUrl: safeEvidence } : {}),
        id: `m${nextId}_${index + 1}`,
        status: "pending",
      };
    }),
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

/**
 * Submit a sensitive vault action (validate milestone / extend deadline /
 * cancel vault).
 *
 * Rejects unknown actions and unknown vault ids BEFORE reaching the network.
 * The operation is single-flight: overlapping calls are coalesced into one
 * execution so a double-submit (UI replay or hostile script) can never fire
 * two on-chain transactions from one confirmation.
 */
const submitVaultActionRunner = createSingleFlightRunner(
  async (action: VaultAction, vaultId: string, actor: string): Promise<void> => {
    if (!isVaultAction(action)) {
      throw new Error("Unknown vault action.");
    }
    if (!isValidVaultRouteId(vaultId)) {
      throw new Error("Vault not found.");
    }
    const actingAddress = typeof actor === "string" ? actor.trim() : "";
    if (!isValidStellarAddress(actingAddress)) {
      throw new Error("A valid connected wallet address is required.");
    }

    // In demo mode or for demo IDs: route action to demo overlay
    if (demoModeActive || isDemoId(vaultId)) {
      let baseVault: Vault | undefined = getDemoStore().vaults[vaultId];
      if (!baseVault) {
        if (isApiEnabled()) {
          baseVault = await apiGetVault(vaultId);
        } else {
          baseVault = lookupVaultSafe(MASTER_VAULTS, vaultId);
        }
      }

      if (action === "validate_milestone") {
        demoValidateMilestone(vaultId, actingAddress, baseVault);
        return;
      }
      if (action === "cancel_vault") {
        demoFailVault(vaultId, actingAddress, baseVault);
        return;
      }
      throw new Error("Extending a deadline is not supported by the demo sandbox.");
    }

    if (isApiEnabled()) {
      const vault = await apiGetVault(vaultId);
      if (!vault) throw new Error("Vault not found.");
      if (vault.status !== "active" && vault.status !== "pending_validation") {
        throw new Error("Vault is not active.");
      }
      if (action === "validate_milestone") {
        await apiValidateNextMilestone(vault, actingAddress);
        invalidateVaultCaches(vaultId);
        return;
      }
      if (action === "cancel_vault") {
        await apiFailVault(vault, actingAddress);
        invalidateVaultCaches(vaultId);
        return;
      }
      throw new Error("Extending a deadline is not supported by the demo API.");
    }
    if (!lookupVaultSafe(MASTER_VAULTS, vaultId)) {
      throw new Error("Vault not found.");
    }
    if (action === "validate_milestone") {
      const vault = lookupVaultSafe(MASTER_VAULTS, vaultId);
      if (vault && vault.status !== "active" && vault.status !== "pending_validation") {
        throw new Error("Vault is not active.");
      }
    }
    return;
  },
);

export const submitVaultAction = submitVaultActionRunner.run;
export const isVaultActionPending = submitVaultActionRunner.isPending;
