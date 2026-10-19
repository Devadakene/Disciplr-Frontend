import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MASTER_VAULTS } from "../../fixtures/vaults";
import { clearCache } from "../queryCache";
import {
  listVaults,
  getVault,
  getTransactions,
  listAllActivity,
  createVault,
} from "../vaultService";

// The service is mock-backed, so "network requests" are reads of MASTER_VAULTS.
// Count them by spying on Object.values (used by listVaults' fetcher).
describe("vaultService caching", () => {
  let reads: ReturnType<typeof vi.spyOn>;

  const countVaultFetches = () =>
    reads.mock.calls.filter((c) => c[0] === MASTER_VAULTS).length;

  beforeEach(() => {
    vi.useFakeTimers();
    clearCache();
    reads = vi.spyOn(Object, "values");
  });
  afterEach(() => {
    reads.mockRestore();
    vi.useRealTimers();
  });

  it("Dashboard -> Vaults -> Transactions -> Dashboard fetches vaults once", async () => {
    await listVaults();
    await listVaults();
    await listAllActivity();
    await listVaults();
    expect(countVaultFetches()).toBe(1);
  });

  it("dedupes concurrent listVaults calls", async () => {
    const [a, b] = await Promise.all([listVaults(), listVaults()]);
    expect(a).toBe(b);
    expect(countVaultFetches()).toBe(1);
  });

  it("createVault invalidates lists and the new vault shows up", async () => {
    const before = (await listVaults()).length;
    const created = await createVault({
      name: "Cache test",
      amount: 1,
      currency: "USDC",
      deadline: "2030-01-01",
      creatorAddress: "G1",
      successAddress: "G2",
      failureAddress: "G3",
      milestones: [],
    });
    const after = await listVaults();
    expect(countVaultFetches()).toBe(2);
    expect(after.length).toBe(before + 1);
    expect(after.some((v) => v.id === created.id)).toBe(true);
    delete MASTER_VAULTS[created.id];
  });

  it("getTransactions reuses the cached vault", async () => {
    const id = Object.keys(MASTER_VAULTS)[0];
    reads.mockClear();
    const v = await getVault(id);
    expect(await getTransactions(id)).toBe(v?.transactions);
  });

  it("returns [] / undefined for unknown or hostile ids", async () => {
    expect(await getVault("__proto__x")).toBeUndefined();
    expect(await getTransactions("nope")).toEqual([]);
  });
});
