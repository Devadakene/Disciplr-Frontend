import type { Vault, VaultStatus } from "../types/vault";

export type VaultScope = "all" | "mine" | "verifying";
export type VaultSort = "deadline" | "-deadline" | "amount" | "-amount" | "created" | "-created";
export type VaultStatusFilter = "all" | VaultStatus;

export interface VaultsQueryState {
  scope: VaultScope;
  status: VaultStatusFilter;
  q: string;
  sort: VaultSort;
  page: number;
}

export const VALID_SCOPES: readonly VaultScope[] = ["all", "mine", "verifying"] as const;
export const VALID_STATUSES: readonly VaultStatusFilter[] = [
  "all",
  "active",
  "pending_validation",
  "completed",
  "failed",
  "cancelled",
] as const;
export const VALID_SORTS: readonly VaultSort[] = [
  "deadline",
  "-deadline",
  "amount",
  "-amount",
  "created",
  "-created",
] as const;

export const DEFAULT_QUERY_STATE: VaultsQueryState = {
  scope: "all",
  status: "all",
  q: "",
  sort: "-created",
  page: 1,
};

export const PAGE_SIZE = 12;

export function parseScope(value: string | null | undefined): VaultScope {
  if (value && (VALID_SCOPES as readonly string[]).includes(value)) {
    return value as VaultScope;
  }
  return DEFAULT_QUERY_STATE.scope;
}

export function parseStatus(value: string | null | undefined): VaultStatusFilter {
  if (value && (VALID_STATUSES as readonly string[]).includes(value)) {
    return value as VaultStatusFilter;
  }
  return DEFAULT_QUERY_STATE.status;
}

export function parseSort(value: string | null | undefined): VaultSort {
  if (value && (VALID_SORTS as readonly string[]).includes(value)) {
    return value as VaultSort;
  }
  return DEFAULT_QUERY_STATE.sort;
}

export function parsePage(value: string | null | undefined): number {
  if (!value) return DEFAULT_QUERY_STATE.page;
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1) {
    return DEFAULT_QUERY_STATE.page;
  }
  return num;
}

export function parseSearch(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim();
}

export function parseVaultsQuery(searchParams: URLSearchParams): VaultsQueryState {
  return {
    scope: parseScope(searchParams.get("scope")),
    status: parseStatus(searchParams.get("status")),
    q: parseSearch(searchParams.get("q")),
    sort: parseSort(searchParams.get("sort")),
    page: parsePage(searchParams.get("page")),
  };
}

export function serializeVaultsQuery(state: Partial<VaultsQueryState>): URLSearchParams {
  const params = new URLSearchParams();

  const scope = state.scope ?? DEFAULT_QUERY_STATE.scope;
  if (scope !== DEFAULT_QUERY_STATE.scope) {
    params.set("scope", scope);
  }

  const status = state.status ?? DEFAULT_QUERY_STATE.status;
  if (status !== DEFAULT_QUERY_STATE.status) {
    params.set("status", status);
  }

  const q = state.q ? state.q.trim() : "";
  if (q.length > 0) {
    params.set("q", q);
  }

  const sort = state.sort ?? DEFAULT_QUERY_STATE.sort;
  if (sort !== DEFAULT_QUERY_STATE.sort) {
    params.set("sort", sort);
  }

  const page = state.page ?? DEFAULT_QUERY_STATE.page;
  if (page > 1) {
    params.set("page", String(page));
  }

  return params;
}

/**
 * Filter vaults by scope, status, and text search (name and id, case-insensitive).
 * Uses includes (safe against regex metacharacters).
 */
export function filterVaults(
  vaults: Vault[],
  options: {
    scope: VaultScope;
    status: VaultStatusFilter;
    q: string;
    userAddress?: string | null;
  },
): Vault[] {
  const { scope, status, q, userAddress } = options;
  const normalizedQuery = q.trim().toLowerCase();
  const normalizedUser = userAddress ? userAddress.trim().toLowerCase() : null;

  return vaults.filter((vault) => {
    // Scope filter (in-memory verification/ownership filter)
    if (scope === "mine") {
      if (!normalizedUser) return false;
      const creator = (vault.creatorAddress ?? "").trim().toLowerCase();
      if (creator !== normalizedUser) return false;
    } else if (scope === "verifying") {
      if (!normalizedUser) return false;
      const verifier = (vault.verifierAddress ?? "").trim().toLowerCase();
      if (verifier !== normalizedUser) return false;
    }

    // Status filter
    if (status !== "all" && vault.status !== status) {
      return false;
    }

    // Text search matches name and id case-insensitively
    if (normalizedQuery.length > 0) {
      const nameMatch = (vault.name ?? "").toLowerCase().includes(normalizedQuery);
      const idMatch = (vault.id ?? "").toLowerCase().includes(normalizedQuery);
      if (!nameMatch && !idMatch) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Stable sort comparator for vaults.
 * Sort options: deadline, amount, created (- prefix for descending).
 * Falls back to tie-breaking by id ascending for stability.
 */
export function sortVaults(vaults: Vault[], sort: VaultSort): Vault[] {
  const isDesc = sort.startsWith("-");
  const field = (isDesc ? sort.slice(1) : sort) as "deadline" | "amount" | "created";

  return [...vaults].sort((a, b) => {
    let comparison = 0;

    if (field === "deadline") {
      const timeA = new Date(a.deadline).getTime() || 0;
      const timeB = new Date(b.deadline).getTime() || 0;
      comparison = timeA - timeB;
    } else if (field === "amount") {
      comparison = (a.amount ?? 0) - (b.amount ?? 0);
    } else if (field === "created") {
      const timeA = new Date(a.createdAt).getTime() || 0;
      const timeB = new Date(b.createdAt).getTime() || 0;
      comparison = timeA - timeB;
    }

    if (comparison !== 0) {
      return isDesc ? -comparison : comparison;
    }

    // Stable tie-breaker
    return String(a.id).localeCompare(String(b.id));
  });
}
