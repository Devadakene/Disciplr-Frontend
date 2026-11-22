import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findRecentVaultByCreator } from "../vaultService";

const creator = "G+/=";
const since = Date.parse("2026-10-19T12:00:00.000Z");

function vaultRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "recent-vault",
    name: "Recovery vault",
    creator,
    amount: "125.5",
    status: "active",
    startDate: "2026-10-19T11:00:00.000Z",
    endDate: "2026-11-19T12:00:00.000Z",
    verifier: creator,
    successDestination: "Gsuccess",
    failureDestination: "Gfailure",
    createdAt: "2026-10-19T11:59:56.000Z",
    updatedAt: "2026-10-19T11:59:56.000Z",
    milestones: [],
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

describe("findRecentVaultByCreator", () => {
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

  it("matches creator, name, amount, and the tolerant creation-time window", async () => {
    fetchMock.mockResolvedValue(
      apiResponse([
        vaultRecord(),
        vaultRecord({ id: "wrong-creator", creator: "Gother" }),
        vaultRecord({ id: "wrong-name", name: "Another vault" }),
        vaultRecord({ id: "wrong-amount", amount: "125.6" }),
        vaultRecord({ id: "too-old", createdAt: "2026-10-19T11:59:54.999Z" }),
      ]),
    );

    const result = await findRecentVaultByCreator({
      creator,
      name: "Recovery vault",
      amount: 125.5,
      since,
    });

    expect(result.map((vault) => vault.id)).toEqual(["recent-vault"]);
  });

  it("returns all matches so callers can handle an ambiguous result safely", async () => {
    fetchMock.mockResolvedValue(
      apiResponse([
        vaultRecord({ id: "first" }),
        vaultRecord({ id: "second" }),
      ]),
    );

    const result = await findRecentVaultByCreator({
      creator,
      name: "Recovery vault",
      amount: 125.5,
      since,
    });

    expect(result.map((vault) => vault.id)).toEqual(["first", "second"]);
  });

  it("encodes the creator query parameter", async () => {
    fetchMock.mockResolvedValue(apiResponse([]));

    await findRecentVaultByCreator({
      creator,
      name: "Recovery vault",
      amount: 125.5,
      since,
    });

    expect(String(fetchMock.mock.calls[0][0])).toContain("creator=G%2B%2F%3D");
  });
});
