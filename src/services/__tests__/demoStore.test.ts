// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  demoCreateVault,
  demoValidateMilestone,
  demoFailVault,
  mergeDemoVaults,
  mergeDemoActivity,
  resetDemoStore,
  getDemoStore,
  saveDemoStore,
  DEMO_STORAGE_KEY,
  isDemoId,
  generateDemoId,
} from "../demoStore";
import type { Vault } from "../../types/vault";

const TEST_ADDRESS = "GBVAQKGA5P4TIZSZJBS5AW3XNJOTYG6I3Y5CLIGCBBUZDHMVF7YE7XCQ";

describe("demoStore", () => {
  beforeEach(() => {
    resetDemoStore();
  });

  afterEach(() => {
    resetDemoStore();
    vi.restoreAllMocks();
  });

  it("generates collision-resistant demo IDs prefixed with demo-", () => {
    const id1 = generateDemoId();
    const id2 = generateDemoId();
    expect(isDemoId(id1)).toBe(true);
    expect(isDemoId(id2)).toBe(true);
    expect(id1).not.toBe(id2);
    expect(id1.startsWith("demo-")).toBe(true);
  });

  it("creates a demo vault and stores it in overlay", () => {
    const vault = demoCreateVault({
      name: "Demo Vault Test",
      amount: 500,
      currency: "USDC",
      deadline: "2026-12-31T00:00:00.000Z",
      creatorAddress: TEST_ADDRESS,
      successAddress: TEST_ADDRESS,
      failureAddress: TEST_ADDRESS,
      milestones: [
        { title: "Milestone 1" },
        { title: "Milestone 2" },
      ],
    });

    expect(vault.id.startsWith("demo-")).toBe(true);
    expect(vault.name).toBe("Demo Vault Test");
    expect(vault.status).toBe("active");
    expect(vault.milestones).toHaveLength(2);
    expect(vault.milestones[0].status).toBe("pending");
    expect(vault.milestones[1].status).toBe("pending");
    expect(vault.transactions).toHaveLength(1);
    expect(vault.transactions[0].type).toBe("create");

    const store = getDemoStore();
    expect(store.vaults[vault.id]).toBeDefined();
    expect(store.activity).toHaveLength(1);
    expect(store.activity[0].type).toBe("create");
  });

  it("validates milestones sequentially and transitions to completed when all are validated", () => {
    const vault = demoCreateVault({
      name: "Milestone Vault",
      amount: 1000,
      currency: "USDC",
      deadline: "2026-12-31T00:00:00.000Z",
      creatorAddress: TEST_ADDRESS,
      successAddress: TEST_ADDRESS,
      failureAddress: TEST_ADDRESS,
      milestones: [
        { title: "Milestone 1" },
        { title: "Milestone 2" },
      ],
    });

    // Validate milestone 1
    const step1 = demoValidateMilestone(vault.id, TEST_ADDRESS);
    expect(step1.status).toBe("active");
    expect(step1.milestones[0].status).toBe("validated");
    expect(step1.milestones[1].status).toBe("pending");
    expect(step1.transactions).toHaveLength(2);
    expect(step1.transactions[1].type).toBe("validate");

    // Validate milestone 2 (all validated -> status should become completed and release tx created)
    const step2 = demoValidateMilestone(vault.id, TEST_ADDRESS);
    expect(step2.status).toBe("completed");
    expect(step2.milestones[0].status).toBe("validated");
    expect(step2.milestones[1].status).toBe("validated");
    expect(step2.transactions).toHaveLength(4); // create, validate, validate, release
    const releaseTx = step2.transactions.find((tx) => tx.type === "release");
    expect(releaseTx).toBeDefined();

    const store = getDemoStore();
    const releaseActivity = store.activity.find((a) => a.type === "release");
    expect(releaseActivity).toBeDefined();
  });

  it("fails vault and marks all pending milestones as failed", () => {
    const vault = demoCreateVault({
      name: "Failing Vault",
      amount: 1000,
      currency: "USDC",
      deadline: "2026-12-31T00:00:00.000Z",
      creatorAddress: TEST_ADDRESS,
      successAddress: TEST_ADDRESS,
      failureAddress: TEST_ADDRESS,
      milestones: [
        { title: "Milestone 1" },
        { title: "Milestone 2" },
      ],
    });

    // Validate first milestone
    demoValidateMilestone(vault.id, TEST_ADDRESS);

    // Fail the vault
    const failedVault = demoFailVault(vault.id, TEST_ADDRESS);
    expect(failedVault.status).toBe("failed");
    expect(failedVault.milestones[0].status).toBe("validated");
    expect(failedVault.milestones[1].status).toBe("failed");
    const redirectTx = failedVault.transactions.find((t) => t.type === "redirect");
    expect(redirectTx).toBeDefined();
  });

  it("merges overlay vaults over live reads without mutating live data", () => {
    const liveVault: Vault = {
      id: "v-live-1",
      name: "Live Vault",
      status: "active",
      amount: 200,
      currency: "USDC",
      createdAt: "2026-01-01T00:00:00.000Z",
      deadline: "2026-12-31T00:00:00.000Z",
      creatorAddress: TEST_ADDRESS,
      verifierAddress: TEST_ADDRESS,
      successAddress: TEST_ADDRESS,
      failureAddress: TEST_ADDRESS,
      contractAddress: TEST_ADDRESS,
      milestones: [],
      transactions: [],
    };

    const demoVault = demoCreateVault({
      name: "Demo Vault Overlay",
      amount: 50,
      currency: "USDC",
      deadline: "2026-12-31T00:00:00.000Z",
      creatorAddress: TEST_ADDRESS,
      successAddress: TEST_ADDRESS,
      failureAddress: TEST_ADDRESS,
      milestones: [],
    });

    const merged = mergeDemoVaults([liveVault]);
    expect(merged).toHaveLength(2);
    expect(merged[0].id).toBe(demoVault.id);
    expect(merged[1].id).toBe("v-live-1");
  });

  it("merges demo activity with live activity sorted newest first", () => {
    const liveActivity = [
      {
        id: "tx-live-old",
        type: "create" as const,
        vault: "Old Live Vault",
        amount: 100,
        fee: 0.00001,
        block: 100,
        hash: "hashold00000000",
        status: "confirmed" as const,
        from: TEST_ADDRESS,
        to: TEST_ADDRESS,
        timestamp: new Date("2026-01-01T00:00:00.000Z"),
        memo: "Old live vault",
      },
    ];

    demoCreateVault({
      name: "Recent Demo Vault",
      amount: 50,
      currency: "USDC",
      deadline: "2026-12-31T00:00:00.000Z",
      creatorAddress: TEST_ADDRESS,
      successAddress: TEST_ADDRESS,
      failureAddress: TEST_ADDRESS,
      milestones: [],
    });

    const merged = mergeDemoActivity(liveActivity);
    expect(merged.length).toBeGreaterThan(1);
    expect(merged[0].vault).toBe("Recent Demo Vault");
  });

  it("safely handles corrupted sessionStorage JSON without crashing", () => {
    window.sessionStorage.setItem(DEMO_STORAGE_KEY, "invalid-json{{{[");
    const store = getDemoStore();
    expect(store.vaults).toEqual({});
    expect(store.activity).toEqual([]);
  });

  it("safely handles malformed vaults in sessionStorage by validating with validateVaultResponse", () => {
    const corruptedState = {
      vaults: {
        "bad-vault": { id: "bad-vault", amount: "not-a-number" },
      },
      activity: [],
    };
    window.sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(corruptedState));
    const store = getDemoStore();
    expect(store.vaults["bad-vault"]).toBeUndefined();
  });

  it("falls back to in-memory store when sessionStorage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    const vault = demoCreateVault({
      name: "In-Memory Vault",
      amount: 100,
      currency: "USDC",
      deadline: "2026-12-31T00:00:00.000Z",
      creatorAddress: TEST_ADDRESS,
      successAddress: TEST_ADDRESS,
      failureAddress: TEST_ADDRESS,
      milestones: [],
    });

    expect(vault.name).toBe("In-Memory Vault");
    const store = getDemoStore();
    expect(store.vaults[vault.id]).toBeDefined();
  });
});
