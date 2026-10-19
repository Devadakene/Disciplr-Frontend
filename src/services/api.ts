/**
 * Thin client for the Disciplr API (https://github.com/Disciplr-Org/Disciplr-backend).
 *
 * The base URL comes from `VITE_API`. When it is unset, the app runs fully offline on the
 * bundled fixtures (see vaultService.ts).
 */
import type { Vault, VaultTransaction, Milestone } from "../types/vault";
import type { VaultActivityRecord } from "./vaultService";
import { verifyCreateIntegrity } from "./createIntegrity";

const raw = (import.meta.env?.VITE_API as string | undefined)?.trim();
export const API_BASE: string | null = raw ? raw.replace(/\/+$/, "") : null;
export const isApiEnabled = (): boolean => API_BASE !== null;

interface ApiMilestone { id: string; title: string; amount: string; dueDate: string; status: string }
export interface ApiVault {
  id: string; name?: string; creator: string; amount: string; status: string; startDate: string; endDate: string;
  verifier: string; successDestination: string; failureDestination: string; createdAt: string; updatedAt: string;
  milestones: ApiMilestone[]; activity?: ApiActivity[];
}

export interface ApiActivity { id: string; type: string; vaultId: string; amount: string; status: string; hash: string; memo: string; createdAt: string }

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE) throw new ApiError("API not configured", 0);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError("Could not reach the Disciplr API.", 0);
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string; details?: string[]; data?: T };
  if (!res.ok) {
    throw new ApiError([body.error, ...(body.details ?? [])].filter(Boolean).join(": ") || `HTTP ${res.status}`, res.status);
  }
  return body.data as T;
}

const toTx = (a: ApiActivity): VaultTransaction => ({
  id: a.id,
  type: a.type as VaultTransaction["type"],
  hash: a.hash,
  timestamp: a.createdAt,
  amount: Number(a.amount),
});

export function toVault(v: ApiVault): Vault {
  const milestones: Milestone[] = v.milestones.map((m) => ({
    id: m.id,
    title: m.title,
    description: `${Number(m.amount).toLocaleString()} USDC, due ${new Date(m.dueDate).toLocaleDateString()}`,
    criteria: m.title,
    status: m.status === "completed" ? "validated" : m.status === "failed" ? "failed" : "pending",
    dueDate: m.dueDate,
    ...(m.status === "completed" ? { validatedAt: v.updatedAt || v.createdAt } : {}),
  }));
  return {
    id: v.id,
    name: v.name || `Vault ${v.id}`,
    status: v.status as Vault["status"],
    amount: Number(v.amount),
    currency: "USDC",
    createdAt: v.createdAt,
    deadline: v.endDate,
    creatorAddress: v.creator,
    verifierAddress: v.verifier,
    successAddress: v.successDestination,
    failureAddress: v.failureDestination,
    contractAddress: v.creator, // settlement is simulated by the API; no per-vault contract yet
    milestones,
    transactions: (v.activity ?? []).map(toTx),
  };
}

export interface VaultFilter { creator?: string; status?: string }

/** Builds `?creator=..&status=..` with every value URI-encoded; empty when no filter is set. */
export function buildVaultQuery(filter?: VaultFilter): string {
  const parts: string[] = [];
  if (filter?.creator) parts.push(`creator=${encodeURIComponent(filter.creator)}`);
  if (filter?.status) parts.push(`status=${encodeURIComponent(filter.status)}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export const apiListVaults = async (filter?: VaultFilter): Promise<Vault[]> =>
  (await request<ApiVault[]>(`/vaults${buildVaultQuery(filter)}`)).map(toVault);

/** Raw `/transactions` feed (all vaults); callers filter to the vaults they own. */
export const apiListTransactions = (): Promise<ApiActivity[]> => request<ApiActivity[]>("/transactions");

export async function apiGetVault(id: string): Promise<Vault | undefined> {
  try {
    return toVault(await request<ApiVault>(`/vaults/${encodeURIComponent(id)}`));
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return undefined;
    throw e;
  }
}

export async function apiCreateVault(input: {
  name: string; amount: number; deadline: string; creator: string; verifier: string;
  successAddress: string; failureAddress: string; milestones: { title: string }[];
}): Promise<Vault> {
  const per = input.amount / Math.max(1, input.milestones.length);
  const start = Date.now();
  const end = new Date(input.deadline).getTime();
  const step = (end - start) / Math.max(1, input.milestones.length);
  const v = await request<ApiVault>("/vaults", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      creator: input.creator,
      verifier: input.verifier,
      amount: input.amount,
      endDate: new Date(end).toISOString(),
      successDestination: input.successAddress,
      failureDestination: input.failureAddress,
      milestones: input.milestones.map((m, i) => ({
        title: m.title,
        amount: Number(per.toFixed(7)),
        dueDate: new Date(start + step * (i + 1)).toISOString(),
      })),
    }),
  });
  const vault = toVault(v);
  verifyCreateIntegrity(
    {
      creator: input.creator,
      verifier: input.verifier,
      amount: input.amount,
      successAddress: input.successAddress,
      failureAddress: input.failureAddress,
    },
    v,
    vault,
  );
  return vault;
}


export async function apiValidateNextMilestone(vault: Vault, actor: string): Promise<void> {
  const next = vault.milestones.find((m) => m.status === "pending");
  if (!next) throw new Error("No pending milestone to validate.");
  await request(`/vaults/${encodeURIComponent(vault.id)}/milestones/${encodeURIComponent(next.id)}/validate`, {
    method: "POST",
    body: JSON.stringify({ verifier: actor }),
  });
}

export async function apiFailVault(vault: Vault, actor: string): Promise<void> {
  await request(`/vaults/${encodeURIComponent(vault.id)}/fail`, {
    method: "POST",
    body: JSON.stringify({ verifier: actor }),
  });
}

export async function apiListActivity(): Promise<VaultActivityRecord[]> {
  const [acts, vaults] = await Promise.all([request<ApiActivity[]>("/transactions"), request<ApiVault[]>("/vaults")]);
  const names = new Map(vaults.map((v) => [v.id, v] as const));
  return acts.map((a, i) => {
    const v = names.get(a.vaultId);
    const ts = new Date(a.createdAt);
    return {
      id: a.id,
      type: a.type as VaultActivityRecord["type"],
      vault: v?.name || a.vaultId,
      amount: Number(a.amount),
      fee: 0.00001,
      block: 1_000_000 + Math.floor(ts.getTime() / 5000) % 1_000_000 + i,
      hash: a.hash,
      status: a.status as VaultActivityRecord["status"],
      from: v?.creator ?? "",
      to: a.type === "redirect" ? v?.failureDestination ?? "" : v?.successDestination ?? "",
      timestamp: ts,
      memo: a.memo,
    };
  });
}

export interface ApiStats {
  totalVaults: number; active: number; completed: number; failed: number;
  totalLocked: number; totalReleased: number; totalRedirected: number; successRate: number | null;
}

export async function apiStats(creator?: string): Promise<ApiStats> {
  return request(`/stats${buildVaultQuery({ creator })}`);
}
