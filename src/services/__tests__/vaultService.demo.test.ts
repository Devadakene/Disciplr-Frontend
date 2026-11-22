import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  setDemoMode,
  isDemoModeActive,
  createVault,
  submitVaultAction,
  getVault,
  listVaults,
} from "../vaultService";
import { resetDemoStore } from "../demoStore";

const TEST_ADDRESS = "GBVAQKGA5P4TIZSZJBS5AW3XNJOTYG6I3Y5CLIGCBBUZDHMVF7YE7XCQ";

describe("vaultService demo sandbox routing", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    resetDemoStore();
    setDemoMode(false);
  });

  afterEach(() => {
    resetDemoStore();
    setDemoMode(false);
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("routes createVault to demoStore overlay when demo mode is active without calling fetch", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    setDemoMode(true);
    expect(isDemoModeActive()).toBe(true);

    const vault = await createVault({
      name: "Demo Vault Test",
      amount: 100,
      currency: "USDC",
      deadline: "2026-12-31T00:00:00.000Z",
      creatorAddress: TEST_ADDRESS,
      verifierAddress: TEST_ADDRESS,
      successAddress: TEST_ADDRESS,
      failureAddress: TEST_ADDRESS,
      milestones: [{ title: "M1" }],
    });

    expect(vault.id.startsWith("demo-")).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("routes submitVaultAction for demo vault to demoStore overlay without calling fetch", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    setDemoMode(true);

    const vault = await createVault({
      name: "Demo Action Test",
      amount: 100,
      currency: "USDC",
      deadline: "2026-12-31T00:00:00.000Z",
      creatorAddress: TEST_ADDRESS,
      verifierAddress: TEST_ADDRESS,
      successAddress: TEST_ADDRESS,
      failureAddress: TEST_ADDRESS,
      milestones: [{ title: "M1" }],
    });

    // Validate milestone
    await submitVaultAction("validate_milestone", vault.id, TEST_ADDRESS);

    const updated = await getVault(vault.id);
    expect(updated?.status).toBe("completed");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("never hits the network for getVault with demo- ID even if demo mode flag was somehow off", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    // First create a demo vault
    setDemoMode(true);
    const vault = await createVault({
      name: "Demo ID Test",
      amount: 100,
      currency: "USDC",
      deadline: "2026-12-31T00:00:00.000Z",
      creatorAddress: TEST_ADDRESS,
      verifierAddress: TEST_ADDRESS,
      successAddress: TEST_ADDRESS,
      failureAddress: TEST_ADDRESS,
      milestones: [{ title: "M1" }],
    });

    // Turn off demo mode to test guard
    setDemoMode(false);

    // Retrieve using demo ID
    const retrieved = await getVault(vault.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(vault.id);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("routes writes to fetch when demo mode is inactive and VITE_API is configured", async () => {
    const realApiVault = {
      id: "v-real-1",
      name: "Real Vault",
      creator: TEST_ADDRESS,
      verifier: TEST_ADDRESS,
      amount: "250",
      status: "active",
      startDate: "2026-01-01T00:00:00.000Z",
      endDate: "2026-12-31T00:00:00.000Z",
      successDestination: TEST_ADDRESS,
      failureDestination: TEST_ADDRESS,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      milestones: [],
      activity: [],
    };

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: realApiVault,
      }),
    });
    global.fetch = fetchSpy;

    setDemoMode(false);

    const originalApi = import.meta.env.VITE_API;
    import.meta.env.VITE_API = "https://api.disciplr.example";

    try {
      const vault = await createVault({
        name: "Real Vault",
        amount: 250,
        currency: "USDC",
        deadline: "2026-12-31T00:00:00.000Z",
        creatorAddress: TEST_ADDRESS,
        verifierAddress: TEST_ADDRESS,
        successAddress: TEST_ADDRESS,
        failureAddress: TEST_ADDRESS,
        milestones: [],
      });

      expect(fetchSpy).toHaveBeenCalled();
      expect(vault.id).toBe("v-real-1");
    } finally {
      import.meta.env.VITE_API = originalApi;
    }
  });
});
