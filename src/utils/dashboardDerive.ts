import type { Vault } from "../types/vault";
import type { Activity, Deadline } from "./dashboard";

export const ACTIVITY_LIMIT = 8;

export interface TxLike {
  id: string;
  type: string;
  vaultId: string;
  amount?: number;
  timestamp: string;
}

/** API/service transaction types -> dashboard activity types. */
const TYPE_MAP: Record<string, Activity["type"]> = {
  create: "created",
  validate: "validated",
  release: "released",
  redirect: "redirected",
};

/** Vaults where the address is creator or verifier, merged and de-duplicated by id. */
export function mergeUserVaults(
  created: Vault[],
  all: Vault[],
  address: string,
): Vault[] {
  const seen = new Set<string>();
  const out: Vault[] = [];
  const verified = all.filter((v) => v.verifierAddress === address);
  for (const v of [...created, ...verified]) {
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    out.push(v);
  }
  return out;
}

/**
 * Maps transactions to Activity, newest first, capped at `limit`.
 * Unknown types are dropped (`Object.hasOwn` guards "__proto__"); entries with an
 * invalid timestamp are dropped.
 */
export function deriveActivity(
  txs: TxLike[],
  vaults: Vault[],
  limit: number = ACTIVITY_LIMIT,
): Activity[] {
  const names = new Map(vaults.map((v) => [v.id, v.name] as const));
  const out: Activity[] = [];
  for (const t of txs) {
    if (!Object.prototype.hasOwnProperty.call(TYPE_MAP, t.type)) continue;
    if (!Number.isFinite(new Date(t.timestamp).getTime())) continue;
    out.push({
      id: t.id,
      type: TYPE_MAP[t.type],
      vault: names.get(t.vaultId) ?? t.vaultId,
      timestamp: t.timestamp,
      ...(t.amount != null && Number.isFinite(t.amount) ? { amount: t.amount } : {}),
    });
  }
  out.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return out.slice(0, Math.max(0, limit));
}

/**
 * One deadline per pending milestone of each active vault. Milestone due date is
 * not on the UI Milestone type, so the vault deadline is the fallback (and the
 * value used when `dueDate` is missing or invalid). Sorted soonest first.
 */
export function deriveDeadlines(
  vaults: Vault[],
  limit: number = Infinity,
): Deadline[] {
  const out: Deadline[] = [];
  for (const v of vaults) {
    if (v.status !== "active" && v.status !== "pending_validation") continue;
    for (const m of v.milestones ?? []) {
      if (m.status !== "pending") continue;
      const due = m.dueDate;
      const when = due && Number.isFinite(new Date(due).getTime()) ? due : v.deadline;
      if (!Number.isFinite(new Date(when).getTime())) continue;
      out.push({
        id: `${v.id}:${m.id}`,
        name: `${v.name} · ${m.title}`,
        deadline: when,
        amount: Number.isFinite(v.amount) ? v.amount : 0,
      });
    }
  }
  out.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
  return out.slice(0, limit);
}

const STATUS_RANK: Record<string, number> = {
  active: 0,
  pending_validation: 1,
};

/** Active-first stable sort (does not mutate the input). */
export function sortActiveFirst<T extends { status: string }>(items: T[]): T[] {
  return items
    .map((item, i) => ({ item, i }))
    .sort(
      (a, b) =>
        (STATUS_RANK[a.item.status] ?? 2) - (STATUS_RANK[b.item.status] ?? 2) ||
        a.i - b.i,
    )
    .map((x) => x.item);
}
