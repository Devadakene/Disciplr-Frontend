import { describe, it, expect } from "vitest";
import type { Vault } from "../../types/vault";
import {
  deriveActivity,
  deriveDeadlines,
  mergeUserVaults,
  sortActiveFirst,
} from "../dashboardDerive";

const vault = (over: Partial<Vault> & { id: string }): Vault =>
  ({
    name: `V${over.id}`,
    status: "active",
    amount: 100,
    currency: "USDC",
    createdAt: "2026-01-01T00:00:00Z",
    deadline: "2026-12-01T00:00:00Z",
    creatorAddress: "A",
    verifierAddress: "Z",
    milestones: [],
    transactions: [],
    ...over,
  }) as Vault;

describe("deriveActivity", () => {
  const vaults = [vault({ id: "1", name: "One" })];
  const tx = (id: string, type: string, ts: string) => ({ id, type, vaultId: "1", amount: 5, timestamp: ts });

  it("maps types, names the vault and sorts newest first", () => {
    const out = deriveActivity(
      [tx("a", "create", "2026-01-01T00:00:00Z"), tx("b", "release", "2026-02-01T00:00:00Z")],
      vaults,
    );
    expect(out.map((a) => a.id)).toEqual(["b", "a"]);
    expect(out[0]).toMatchObject({ type: "released", vault: "One", amount: 5 });
  });

  it("keeps only the top N", () => {
    const txs = Array.from({ length: 12 }, (_, i) =>
      tx(`t${i}`, "validate", new Date(2026, 0, i + 1).toISOString()),
    );
    const out = deriveActivity(txs, vaults);
    expect(out).toHaveLength(8);
    expect(out[0].id).toBe("t11");
    expect(deriveActivity(txs, vaults, 3)).toHaveLength(3);
  });

  it("drops unknown types (including prototype keys) and bad timestamps", () => {
    const out = deriveActivity(
      [
        tx("x", "mystery", "2026-01-01T00:00:00Z"),
        tx("y", "__proto__", "2026-01-01T00:00:00Z"),
        tx("z", "create", "not-a-date"),
        tx("ok", "redirect", "2026-01-01T00:00:00Z"),
      ],
      vaults,
    );
    expect(out.map((a) => a.id)).toEqual(["ok"]);
  });
});

describe("deriveDeadlines", () => {
  const ms = (id: string, status: "pending" | "validated", dueDate?: string) => ({
    id,
    title: `M${id}`,
    description: "",
    criteria: "",
    status,
    dueDate,
  });

  it("uses pending milestones of active vaults, sorted ascending", () => {
    const out = deriveDeadlines([
      vault({ id: "1", milestones: [ms("a", "pending", "2026-06-01T00:00:00Z"), ms("b", "validated", "2026-01-01T00:00:00Z")] }),
      vault({ id: "2", milestones: [ms("c", "pending", "2026-03-01T00:00:00Z")] }),
      vault({ id: "3", status: "completed", milestones: [ms("d", "pending", "2026-02-01T00:00:00Z")] }),
    ]);
    expect(out.map((d) => d.id)).toEqual(["2:c", "1:a"]);
  });

  it("falls back to the vault deadline when dueDate is missing or invalid", () => {
    const out = deriveDeadlines([
      vault({ id: "1", deadline: "2026-09-01T00:00:00Z", milestones: [ms("a", "pending"), ms("b", "pending", "garbage")] }),
    ]);
    expect(out.map((d) => d.deadline)).toEqual(["2026-09-01T00:00:00Z", "2026-09-01T00:00:00Z"]);
  });

  it("respects the limit", () => {
    const out = deriveDeadlines(
      [vault({ id: "1", milestones: [ms("a", "pending", "2026-06-01T00:00:00Z"), ms("b", "pending", "2026-07-01T00:00:00Z")] })],
      1,
    );
    expect(out).toHaveLength(1);
  });
});

describe("mergeUserVaults / sortActiveFirst", () => {
  it("merges creator and verifier vaults without duplicates", () => {
    const a = vault({ id: "1" });
    const b = vault({ id: "2", creatorAddress: "X", verifierAddress: "A" });
    const c = vault({ id: "3", creatorAddress: "X", verifierAddress: "Y" });
    const d = vault({ id: "4", creatorAddress: "A", verifierAddress: "A" });
    const out = mergeUserVaults([a, d], [a, b, c, d], "A");
    expect(out.map((v) => v.id)).toEqual(["1", "4", "2"]);
  });

  it("sorts active first, stably", () => {
    const out = sortActiveFirst([
      { id: "1", status: "completed" },
      { id: "2", status: "active" },
      { id: "3", status: "failed" },
      { id: "4", status: "active" },
    ]);
    expect(out.map((v) => v.id)).toEqual(["2", "4", "1", "3"]);
  });
});
