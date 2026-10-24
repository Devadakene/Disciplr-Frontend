/**
 * demoStore.ts
 *
 * Per-browser sandbox store for demo mode.
 *
 * In demo mode, all vault creations, milestone validations, and failures/cancellations
 * are handled within the browser sandbox so the shared demo account (DEMO_ADDRESS)
 * never writes to the production Disciplr API database.
 *
 * Storage is backed by `sessionStorage` (scoped to the tab/browser session) under
 * the key `disciplr:demo:overlay`. If `sessionStorage` is unavailable (e.g. private mode,
 * security policy, quota exceeded), an in-memory fallback is used seamlessly.
 *
 * Corrupted or tampered JSON in sessionStorage is discarded safely.
 * Stored vaults are validated through `validateVaultResponse` before being returned.
 */

import type { Vault, VaultTransaction, Milestone } from "../types/vault";
import type { VaultActivityRecord } from "./vaultService";
import { validateVaultResponse } from "../utils/vaultState";

export const DEMO_STORAGE_KEY = "disciplr:demo:overlay";
export const DEMO_ID_PREFIX = "demo-";

export interface DemoStoreState {
  vaults: Record<string, Vault>;
  activity: VaultActivityRecord[];
}

/** In-memory fallback if sessionStorage throws or is unavailable */
let memoryStore: DemoStoreState = {
  vaults: {},
  activity: [],
};

function isStorageAvailable(): boolean {
  if (typeof window === "undefined" || !window.sessionStorage) return false;
  try {
    const testKey = "__disciplr_demo_test__";
    window.sessionStorage.setItem(testKey, "1");
    window.sessionStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads the overlay state from sessionStorage (or memory fallback).
 * Never trusts overlay JSON: discards corrupted JSON or invalid vaults.
 */
export function getDemoStore(): DemoStoreState {
  if (!isStorageAvailable()) {
    return memoryStore;
  }

  try {
    const raw = window.sessionStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return memoryStore;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return memoryStore;
    }

    const validatedVaults: Record<string, Vault> = {};
    const rawVaults = parsed.vaults;
    if (rawVaults && typeof rawVaults === "object") {
      for (const [id, candidate] of Object.entries(rawVaults)) {
        const valRes = validateVaultResponse(candidate);
        if (valRes.ok) {
          validatedVaults[id] = valRes.vault;
        }
      }
    }

    const validatedActivity: VaultActivityRecord[] = [];
    if (Array.isArray(parsed.activity)) {
      for (const item of parsed.activity) {
        if (
          item &&
          typeof item === "object" &&
          typeof item.id === "string" &&
          typeof item.vault === "string" &&
          typeof item.amount === "number"
        ) {
          validatedActivity.push({
            ...item,
            timestamp: new Date(item.timestamp),
          });
        }
      }
    }

    return {
      vaults: validatedVaults,
      activity: validatedActivity,
    };
  } catch {
    return memoryStore;
  }
}

/**
 * Saves the overlay state to sessionStorage and in-memory cache.
 */
export function saveDemoStore(state: DemoStoreState): void {
  memoryStore = state;
  if (!isStorageAvailable()) return;

  try {
    window.sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded or storage disabled — keep running in memory
  }
}

/**
 * Resets the demo sandbox overlay (clears sessionStorage and memory).
 */
export function resetDemoStore(): void {
  memoryStore = {
    vaults: {},
    activity: [],
  };
  if (isStorageAvailable()) {
    try {
      window.sessionStorage.removeItem(DEMO_STORAGE_KEY);
    } catch {
      // Ignore storage errors on cleanup
    }
  }
}

/**
 * Checks whether a given identifier was created in the demo sandbox.
 */
export function isDemoId(id: string): boolean {
  return typeof id === "string" && id.startsWith(DEMO_ID_PREFIX);
}

/**
 * Generates a collision-resistant demo ID with the `demo-` prefix.
 */
export function generateDemoId(): string {
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${DEMO_ID_PREFIX}${timestamp}-${randomPart}`;
}

export interface DemoCreateVaultInput {
  name: string;
  amount: number;
  currency: string;
  deadline: string;
  creatorAddress: string;
  verifierAddress?: string;
  successAddress: string;
  failureAddress: string;
  evidenceUrl?: string;
  milestones: Omit<Milestone, "id" | "status">[];
}

/**
 * Records a demo-created vault in the overlay store.
 */
export function demoCreateVault(input: DemoCreateVaultInput): Vault {
  const store = getDemoStore();
  const id = generateDemoId();
  const now = new Date().toISOString();
  const per = input.amount / Math.max(1, input.milestones.length);

  const start = Date.now();
  const end = new Date(input.deadline).getTime();
  const step = (end - start) / Math.max(1, input.milestones.length);

  const milestones: Milestone[] = input.milestones.map((m, index) => ({
    ...m,
    id: `m_${id}_${index + 1}`,
    description: `${Number(per.toFixed(7)).toLocaleString()} ${input.currency}, due ${new Date(start + step * (index + 1)).toLocaleDateString()}`,
    criteria: m.title,
    status: "pending",
  }));

  const initialTx: VaultTransaction = {
    id: `tx_${id}_create`,
    type: "create",
    hash: `demohash${id.replace(/-/g, "")}00000000`,
    timestamp: now,
    amount: input.amount,
  };

  const newVault: Vault = {
    id,
    name: input.name,
    status: "active",
    amount: input.amount,
    currency: input.currency || "USDC",
    createdAt: now,
    deadline: input.deadline,
    creatorAddress: input.creatorAddress,
    verifierAddress: input.verifierAddress || input.creatorAddress,
    successAddress: input.successAddress,
    failureAddress: input.failureAddress,
    contractAddress: input.creatorAddress,
    milestones,
    transactions: [initialTx],
  };

  const activityRecord: VaultActivityRecord = {
    id: initialTx.id,
    type: "create",
    vault: newVault.name,
    amount: input.amount,
    fee: 0.00001,
    block: 1_000_000 + Math.floor(Date.now() / 5000) % 1_000_000,
    hash: initialTx.hash,
    status: "confirmed",
    from: newVault.creatorAddress,
    to: newVault.successAddress,
    timestamp: new Date(now),
    memo: `Created demo vault ${newVault.name}`,
  };

  store.vaults[id] = newVault;
  store.activity.unshift(activityRecord);
  saveDemoStore(store);

  return newVault;
}

/**
 * Validates the next pending milestone in a demo vault.
 * If all milestones become validated, the vault status transitions to `completed`
 * and a `release` transaction is recorded.
 */
export function demoValidateMilestone(
  vaultId: string,
  actor: string,
  baseVault?: Vault,
): Vault {
  const store = getDemoStore();
  const vault = store.vaults[vaultId] || (baseVault?.id === vaultId ? baseVault : undefined);
  if (!vault) {
    throw new Error("Vault not found.");
  }

  if (vault.status !== "active" && vault.status !== "pending_validation") {
    throw new Error("Vault is not active.");
  }

  const pendingMilestoneIndex = vault.milestones.findIndex(
    (m) => m.status === "pending",
  );
  if (pendingMilestoneIndex === -1) {
    throw new Error("No pending milestone to validate.");
  }

  const now = new Date().toISOString();
  const updatedMilestones = [...vault.milestones];
  const targetMilestone = updatedMilestones[pendingMilestoneIndex];

  updatedMilestones[pendingMilestoneIndex] = {
    ...targetMilestone,
    status: "validated",
    validatedAt: now,
  };

  const allCompleted = updatedMilestones.every((m) => m.status === "validated");
  const nextStatus = allCompleted ? "completed" : "active";

  const txList = [...vault.transactions];
  const validateTx: VaultTransaction = {
    id: `tx_${vault.id}_val_${pendingMilestoneIndex + 1}`,
    type: "validate",
    hash: `demohashval${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    timestamp: now,
  };
  txList.push(validateTx);

  const newActivity: VaultActivityRecord[] = [
    {
      id: validateTx.id,
      type: "validate",
      vault: vault.name,
      amount: vault.amount / vault.milestones.length,
      fee: 0.00001,
      block: 1_000_000 + Math.floor(Date.now() / 5000) % 1_000_000,
      hash: validateTx.hash,
      status: "confirmed",
      from: actor,
      to: vault.successAddress,
      timestamp: new Date(now),
      memo: `Validated milestone ${targetMilestone.title}`,
    },
  ];

  if (allCompleted) {
    const releaseTx: VaultTransaction = {
      id: `tx_${vault.id}_release`,
      type: "release",
      hash: `demohashrel${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      amount: vault.amount,
    };
    txList.push(releaseTx);
    newActivity.push({
      id: releaseTx.id,
      type: "release",
      vault: vault.name,
      amount: vault.amount,
      fee: 0.00001,
      block: 1_000_000 + Math.floor(Date.now() / 5000) % 1_000_000,
      hash: releaseTx.hash,
      status: "confirmed",
      from: vault.creatorAddress,
      to: vault.successAddress,
      timestamp: new Date(now),
      memo: `Funds released to ${vault.successAddress}`,
    });
  }

  const updatedVault: Vault = {
    ...vault,
    status: nextStatus,
    milestones: updatedMilestones,
    transactions: txList,
  };

  store.vaults[vaultId] = updatedVault;
  store.activity = [...newActivity, ...store.activity];
  saveDemoStore(store);

  return updatedVault;
}

/**
 * Fails or cancels a demo vault.
 * State transition: status becomes `failed`, any remaining pending milestones
 * become `failed`, and a `redirect` transaction is recorded.
 */
export function demoFailVault(
  vaultId: string,
  actor: string,
  baseVault?: Vault,
): Vault {
  const store = getDemoStore();
  const vault = store.vaults[vaultId] || (baseVault?.id === vaultId ? baseVault : undefined);
  if (!vault) {
    throw new Error("Vault not found.");
  }

  if (vault.status !== "active" && vault.status !== "pending_validation") {
    throw new Error("Vault is not active.");
  }

  const now = new Date().toISOString();
  const updatedMilestones = vault.milestones.map((m) =>
    m.status === "pending" ? { ...m, status: "failed" as const } : m,
  );

  const redirectTx: VaultTransaction = {
    id: `tx_${vault.id}_fail`,
    type: "redirect",
    hash: `demohashfail${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    timestamp: now,
    amount: vault.amount,
  };

  const activityRecord: VaultActivityRecord = {
    id: redirectTx.id,
    type: "redirect",
    vault: vault.name,
    amount: vault.amount,
    fee: 0.00001,
    block: 1_000_000 + Math.floor(Date.now() / 5000) % 1_000_000,
    hash: redirectTx.hash,
    status: "confirmed",
    from: actor,
    to: vault.failureAddress,
    timestamp: new Date(now),
    memo: `Vault failed - funds redirected to ${vault.failureAddress}`,
  };

  const updatedVault: Vault = {
    ...vault,
    status: "failed",
    milestones: updatedMilestones,
    transactions: [...vault.transactions, redirectTx],
  };

  store.vaults[vaultId] = updatedVault;
  store.activity.unshift(activityRecord);
  saveDemoStore(store);

  return updatedVault;
}

/**
 * Merges demo overlay vaults over live reads.
 * Overlay vaults take precedence over any live vault with the same ID,
 * and newly created demo vaults are prepended.
 */
export function mergeDemoVaults(liveVaults: Vault[]): Vault[] {
  const store = getDemoStore();
  const overlayMap = new Map<string, Vault>(Object.entries(store.vaults));
  if (overlayMap.size === 0) return liveVaults;

  const result: Vault[] = [];
  const handledIds = new Set<string>();

  // Add demo-only vaults first (newest created)
  for (const [id, vault] of overlayMap.entries()) {
    if (isDemoId(id)) {
      result.push(vault);
      handledIds.add(id);
    }
  }

  // Then add live vaults, overriding if present in overlay
  for (const live of liveVaults) {
    if (overlayMap.has(live.id)) {
      result.push(overlayMap.get(live.id)!);
      handledIds.add(live.id);
    } else {
      result.push(live);
    }
  }

  return result;
}

/**
 * Merges demo overlay activity records with live activity records.
 */
export function mergeDemoActivity(
  liveActivity: VaultActivityRecord[],
): VaultActivityRecord[] {
  const store = getDemoStore();
  if (store.activity.length === 0) return liveActivity;

  return [...store.activity, ...liveActivity].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
  );
}
