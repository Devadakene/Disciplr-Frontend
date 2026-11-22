import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "../api";
import { createVault, MASTER_VAULTS } from "../vaultService";
import { ACCOUNT_A, ACCOUNT_B, ACCOUNT_C, ACCOUNT_D } from "@/__tests__/fixtures/stellarAddresses";

const vaultInput = {
  name: "Named vault",
  amount: 100,
  currency: "USDC",
  deadline: "2030-01-01T12:00:00.000Z",
  creatorAddress: ACCOUNT_A,
  verifierAddress: ACCOUNT_C,
  successAddress: ACCOUNT_B,
  failureAddress: ACCOUNT_D,
  milestones: [{ title: "Launch", description: "Ship", criteria: "Ship" }],
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("createVault verifier handling", () => {
  it("stores the verifier address in the offline fixture vault", async () => {
    vi.spyOn(api, "isApiEnabled").mockReturnValue(false);
    const vault = await createVault(vaultInput);

    expect(vault.verifierAddress).toBe(ACCOUNT_C);
    delete MASTER_VAULTS[vault.id];
  });

  it("passes the selected verifier and name to apiCreateVault", async () => {
    vi.spyOn(api, "isApiEnabled").mockReturnValue(true);
    const apiCreateSpy = vi
      .spyOn(api, "apiCreateVault")
      .mockResolvedValue({} as Awaited<ReturnType<typeof api.apiCreateVault>>);

    await createVault(vaultInput);

    expect(apiCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Named vault",
        verifier: ACCOUNT_C,
      }),
    );
  });

  it("includes name and verifier in the POST /vaults payload", async () => {
    vi.stubEnv("VITE_API", "https://api.example.test");
    vi.resetModules();
    const { apiCreateVault } = await import("../api");
    const responseVault = {
      id: "created-vault",
      name: "Named vault",
      creator: ACCOUNT_A,
      amount: "100",
      status: "active",
      startDate: "2026-06-18T00:00:00.000Z",
      endDate: "2030-01-01T12:00:00.000Z",
      verifier: ACCOUNT_C,
      successDestination: ACCOUNT_B,
      failureDestination: ACCOUNT_D,
      createdAt: "2026-06-18T00:00:00.000Z",
      updatedAt: "2026-06-18T00:00:00.000Z",
      milestones: [],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ data: responseVault }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiCreateVault({
      name: "Named vault",
      amount: 100,
      deadline: "2030-01-01T12:00:00.000Z",
      creator: ACCOUNT_A,
      verifier: ACCOUNT_C,
      successAddress: ACCOUNT_B,
      failureAddress: ACCOUNT_D,
      milestones: [{ title: "Launch" }],
    });

    const requestInit = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(requestInit.body as string) as Record<string, unknown>;
    expect(body.name).toBe("Named vault");
    expect(body.verifier).toBe(ACCOUNT_C);
  });
});
