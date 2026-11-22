import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  FALLBACK_ACTIVITY_TYPE,
  apiGetVault,
  apiListActivity,
  apiListVaults,
  apiStats,
  parseApiActivity,
  parseApiMilestone,
  parseApiStats,
  parseApiVault,
  toVault,
  type ApiVault,
} from "../api";
import { logger } from "../../utils/logger";

function makeRawVault(overrides: Record<string, unknown> = {}) {
  return {
    id: "vault-1",
    name: "Valid Vault",
    creator: "GCREATOR",
    amount: "250.5",
    status: "active",
    startDate: "2026-10-01T00:00:00.000Z",
    endDate: "2026-12-01T00:00:00.000Z",
    verifier: "GVERIFIER",
    successDestination: "GSUCCESS",
    failureDestination: "GFAILURE",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    milestones: [
      {
        id: "m-1",
        title: "Milestone 1",
        amount: "250.5",
        dueDate: "2026-11-01T00:00:00.000Z",
        status: "pending",
      },
    ],
    ...overrides,
  };
}

function makeRawActivity(overrides: Record<string, unknown> = {}) {
  return {
    id: "act-1",
    type: "create",
    vaultId: "vault-1",
    amount: "100",
    status: "confirmed",
    hash: "abc123456789",
    memo: "Initial deposit",
    createdAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeRawStats(overrides: Record<string, unknown> = {}) {
  return {
    totalVaults: 5,
    active: 2,
    completed: 2,
    failed: 1,
    totalLocked: 1000,
    totalReleased: 500,
    totalRedirected: 250,
    successRate: 66.7,
    ...overrides,
  };
}

function apiResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ data }),
  } as Response;
}

describe("api.ts runtime validation guards", () => {
  it("parseApiVault accepts a valid vault and treats missing milestones as []", () => {
    const raw = makeRawVault();
    delete (raw as Record<string, unknown>).milestones;

    const result = parseApiVault(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.milestones).toEqual([]);
    }
  });

  it("parseApiVault rejects non-numeric amount with issues", () => {
    const result = parseApiVault(makeRawVault({ amount: "abc" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });

  it("parseApiMilestone rejects malformed milestone objects", () => {
    expect(parseApiMilestone(null).ok).toBe(false);
    expect(parseApiMilestone({ id: "m1", title: "T", amount: "bad", dueDate: "", status: "pending" }).ok).toBe(false);
  });

  it("parseApiActivity accepts unknown type strings for fallback mapping and rejects NaN amounts", () => {
    expect(parseApiActivity(makeRawActivity({ type: "weird" })).ok).toBe(true);
    expect(parseApiActivity(makeRawActivity({ amount: "not-a-number" })).ok).toBe(false);
  });

  it("parseApiStats validates numeric fields and nullable successRate", () => {
    expect(parseApiStats(makeRawStats()).ok).toBe(true);
    expect(parseApiStats(makeRawStats({ successRate: null })).ok).toBe(true);
    expect(parseApiStats(makeRawStats({ totalVaults: "5" })).ok).toBe(false);
  });
});

describe("toVault safety", () => {
  it("never throws when milestones is missing and yields milestones: []", () => {
    const raw = makeRawVault() as unknown as ApiVault;
    delete (raw as unknown as Record<string, unknown>).milestones;

    const vault = toVault(raw);
    expect(vault.milestones).toEqual([]);
  });

  it("never emits NaN amounts and maps unknown activity types to fallback", () => {
    const raw = makeRawVault({
      amount: "abc",
      activity: [makeRawActivity({ type: "weird", amount: "xyz" })],
    }) as unknown as ApiVault;

    const vault = toVault(raw);
    expect(Number.isNaN(vault.amount)).toBe(false);
    expect(vault.amount).toBe(0);
    expect(vault.transactions[0].type).toBe(FALLBACK_ACTIVITY_TYPE);
    expect(Number.isNaN(vault.transactions[0].amount)).toBe(false);
    expect(vault.transactions[0].amount).toBe(0);
  });
});

describe("API readers runtime validation", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv("VITE_API", "https://api.example.test/api");
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("apiListVaults drops vault with amount: 'abc' while keeping a valid neighbour and logging via logger", async () => {
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
    fetchMock.mockResolvedValue(
      apiResponse([
        makeRawVault({ id: "bad-vault", amount: "abc" }),
        makeRawVault({ id: "good-vault", amount: "500" }),
      ]),
    );

    const vaults = await apiListVaults();
    expect(vaults.map((v) => v.id)).toEqual(["good-vault"]);
    expect(vaults[0].amount).toBe(500);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("apiListVaults rejects { data: 'oops' } with ApiError (status 502)", async () => {
    fetchMock.mockResolvedValue(apiResponse("oops"));

    await expect(apiListVaults()).rejects.toMatchObject({
      name: "ApiError",
      status: 502,
    });
  });

  it("apiGetVault rejects { data: 'oops' } with ApiError (status 502)", async () => {
    fetchMock.mockResolvedValue(apiResponse("oops"));

    await expect(apiGetVault("vault-1")).rejects.toBeInstanceOf(ApiError);
    await expect(apiGetVault("vault-1")).rejects.toMatchObject({ status: 502 });
  });

  it("apiListActivity maps type: 'weird' to the documented fallback and rejects { data: 'oops' } with ApiError", async () => {
    fetchMock
      .mockResolvedValueOnce(apiResponse([makeRawActivity({ id: "act-weird", type: "weird" })]))
      .mockResolvedValueOnce(apiResponse([makeRawVault({ id: "vault-1" })]));

    const activities = await apiListActivity();
    expect(activities).toHaveLength(1);
    expect(activities[0].type).toBe(FALLBACK_ACTIVITY_TYPE);

    fetchMock
      .mockResolvedValueOnce(apiResponse("oops"))
      .mockResolvedValueOnce(apiResponse([]));

    await expect(apiListActivity()).rejects.toMatchObject({
      name: "ApiError",
      status: 502,
    });
  });

  it("apiStats rejects { data: 'oops' } with ApiError (status 502)", async () => {
    fetchMock.mockResolvedValue(apiResponse("oops"));

    await expect(apiStats()).rejects.toMatchObject({
      name: "ApiError",
      status: 502,
    });
  });
});
