import { describe, expect, it } from "vitest";
import {
  parseVaultsQuery,
  serializeVaultsQuery,
  filterVaults,
  sortVaults,
  parseScope,
  parseStatus,
  parseSort,
  parsePage,
  DEFAULT_QUERY_STATE,
} from "../vaultsQuery";
import type { Vault } from "../../types/vault";

describe("vaultsQuery URL parsing and serialization", () => {
  it("returns default state when params are empty", () => {
    const params = new URLSearchParams("");
    const parsed = parseVaultsQuery(params);
    expect(parsed).toEqual(DEFAULT_QUERY_STATE);
  });

  it("parses valid params correctly", () => {
    const params = new URLSearchParams(
      "scope=mine&status=active&q=launch&sort=-amount&page=2",
    );
    const parsed = parseVaultsQuery(params);
    expect(parsed).toEqual({
      scope: "mine",
      status: "active",
      q: "launch",
      sort: "-amount",
      page: 2,
    });
  });

  it("falls back safely on invalid/unknown params without errors", () => {
    const params = new URLSearchParams(
      "scope=invalid&status=hacked&q=&sort=not_a_sort&page=-3",
    );
    const parsed = parseVaultsQuery(params);
    expect(parsed).toEqual({
      scope: "all",
      status: "all",
      q: "",
      sort: "-created",
      page: 1,
    });
  });

  it("handles non-integer or zero page numbers safely", () => {
    expect(parsePage("0")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("1.5")).toBe(1);
    expect(parsePage("-10")).toBe(1);
  });

  it("normalizes search input whitespace", () => {
    const params = new URLSearchParams("q=%20%20hello%20world%20%20");
    const parsed = parseVaultsQuery(params);
    expect(parsed.q).toBe("hello world");
  });

  it("round trips state cleanly", () => {
    const initial = {
      scope: "verifying" as const,
      status: "pending_validation" as const,
      q: "test vault",
      sort: "amount" as const,
      page: 3,
    };
    const serialized = serializeVaultsQuery(initial);
    const roundTripped = parseVaultsQuery(serialized);
    expect(roundTripped).toEqual(initial);
  });

  it("omits default values when serializing", () => {
    const serialized = serializeVaultsQuery({
      scope: "all",
      status: "all",
      q: "",
      sort: "-created",
      page: 1,
    });
    expect(serialized.toString()).toBe("");
  });
});

describe("filterVaults", () => {
  const sampleVaults: Vault[] = [
    {
      id: "v-1",
      name: "Alpha Vault",
      status: "active",
      amount: 1000,
      currency: "USDC",
      createdAt: "2026-01-01T00:00:00Z",
      deadline: "2026-06-01T00:00:00Z",
      creatorAddress: "GCREATOR1",
      verifierAddress: "GVERIFIER1",
      successAddress: "GSUCC",
      failureAddress: "GFAIL",
      contractAddress: "GCONT",
      milestones: [],
      transactions: [],
    },
    {
      id: "v-2",
      name: "Beta Launch [special]",
      status: "completed",
      amount: 5000,
      currency: "USDC",
      createdAt: "2026-02-01T00:00:00Z",
      deadline: "2026-05-01T00:00:00Z",
      creatorAddress: "GCREATOR2",
      verifierAddress: "GVERIFIER2",
      successAddress: "GSUCC",
      failureAddress: "GFAIL",
      contractAddress: "GCONT",
      milestones: [],
      transactions: [],
    },
    {
      id: "v-3",
      name: "Gamma Service (regex.*)",
      status: "failed",
      amount: 2500,
      currency: "USDC",
      createdAt: "2026-03-01T00:00:00Z",
      deadline: "2026-04-01T00:00:00Z",
      creatorAddress: "GCREATOR1",
      verifierAddress: "GVERIFIER2",
      successAddress: "GSUCC",
      failureAddress: "GFAIL",
      contractAddress: "GCONT",
      milestones: [],
      transactions: [],
    },
  ];

  it("filters by status", () => {
    const active = filterVaults(sampleVaults, {
      scope: "all",
      status: "active",
      q: "",
    });
    expect(active.map((v) => v.id)).toEqual(["v-1"]);
  });

  it("filters by creator in mine scope", () => {
    const mine = filterVaults(sampleVaults, {
      scope: "mine",
      status: "all",
      q: "",
      userAddress: "GCREATOR1",
    });
    expect(mine.map((v) => v.id)).toEqual(["v-1", "v-3"]);
  });

  it("returns empty array for mine scope without connected wallet", () => {
    const mine = filterVaults(sampleVaults, {
      scope: "mine",
      status: "all",
      q: "",
      userAddress: null,
    });
    expect(mine).toEqual([]);
  });

  it("filters by verifier in verifying scope", () => {
    const verifying = filterVaults(sampleVaults, {
      scope: "verifying",
      status: "all",
      q: "",
      userAddress: "GVERIFIER2",
    });
    expect(verifying.map((v) => v.id)).toEqual(["v-2", "v-3"]);
  });

  it("searches by name case-insensitively", () => {
    const res = filterVaults(sampleVaults, {
      scope: "all",
      status: "all",
      q: "alpha",
    });
    expect(res.map((v) => v.id)).toEqual(["v-1"]);
  });

  it("searches by id case-insensitively", () => {
    const res = filterVaults(sampleVaults, {
      scope: "all",
      status: "all",
      q: "v-2",
    });
    expect(res.map((v) => v.id)).toEqual(["v-2"]);
  });

  it("safely searches text containing regex special characters", () => {
    const res = filterVaults(sampleVaults, {
      scope: "all",
      status: "all",
      q: "(regex.*)",
    });
    expect(res.map((v) => v.id)).toEqual(["v-3"]);
  });
});

describe("sortVaults stability and comparator", () => {
  const list: Vault[] = [
    {
      id: "vault-1",
      name: "V1",
      status: "active",
      amount: 100,
      currency: "USDC",
      createdAt: "2026-01-01T00:00:00Z",
      deadline: "2026-05-01T00:00:00Z",
      creatorAddress: "A",
      successAddress: "B",
      failureAddress: "C",
      contractAddress: "D",
      milestones: [],
      transactions: [],
    },
    {
      id: "vault-2",
      name: "V2",
      status: "active",
      amount: 500,
      currency: "USDC",
      createdAt: "2026-01-03T00:00:00Z",
      deadline: "2026-03-01T00:00:00Z",
      creatorAddress: "A",
      successAddress: "B",
      failureAddress: "C",
      contractAddress: "D",
      milestones: [],
      transactions: [],
    },
    {
      id: "vault-3",
      name: "V3",
      status: "active",
      amount: 100,
      currency: "USDC",
      createdAt: "2026-01-02T00:00:00Z",
      deadline: "2026-04-01T00:00:00Z",
      creatorAddress: "A",
      successAddress: "B",
      failureAddress: "C",
      contractAddress: "D",
      milestones: [],
      transactions: [],
    },
  ];

  it("sorts by amount ascending and descending with tie-break stability", () => {
    const asc = sortVaults(list, "amount");
    expect(asc.map((v) => v.id)).toEqual(["vault-1", "vault-3", "vault-2"]);

    const desc = sortVaults(list, "-amount");
    expect(desc.map((v) => v.id)).toEqual(["vault-2", "vault-1", "vault-3"]);
  });

  it("sorts by deadline ascending and descending", () => {
    const asc = sortVaults(list, "deadline");
    expect(asc.map((v) => v.id)).toEqual(["vault-2", "vault-3", "vault-1"]);

    const desc = sortVaults(list, "-deadline");
    expect(desc.map((v) => v.id)).toEqual(["vault-1", "vault-3", "vault-2"]);
  });

  it("sorts by created ascending and descending", () => {
    const asc = sortVaults(list, "created");
    expect(asc.map((v) => v.id)).toEqual(["vault-1", "vault-3", "vault-2"]);

    const desc = sortVaults(list, "-created");
    expect(desc.map((v) => v.id)).toEqual(["vault-2", "vault-3", "vault-1"]);
  });
});
