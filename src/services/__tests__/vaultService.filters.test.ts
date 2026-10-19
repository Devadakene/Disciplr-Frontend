import { describe, it, expect } from "vitest";
import { buildVaultQuery } from "../api";
import { filterVaults, listVaults, MASTER_VAULTS } from "../vaultService";

describe("buildVaultQuery", () => {
  it("is empty without a filter", () => {
    expect(buildVaultQuery()).toBe("");
    expect(buildVaultQuery({})).toBe("");
  });

  it("builds creator and status params", () => {
    expect(buildVaultQuery({ creator: "GABC" })).toBe("?creator=GABC");
    expect(buildVaultQuery({ creator: "GABC", status: "active" })).toBe(
      "?creator=GABC&status=active",
    );
  });

  it("encodes values so they cannot inject extra params", () => {
    expect(buildVaultQuery({ creator: "a&status=x#y" })).toBe(
      `?creator=${encodeURIComponent("a&status=x#y")}`,
    );
  });
});

describe("offline filter", () => {
  const all = Object.values(MASTER_VAULTS);
  const creator = all[0].creatorAddress;

  it("returns everything with no filter", () => {
    expect(filterVaults(all)).toEqual(all);
  });

  it("filters by creator", () => {
    const out = filterVaults(all, { creator });
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((v) => v.creatorAddress === creator)).toBe(true);
  });

  it("filters by status and combines filters", () => {
    const status = all[0].status;
    const out = filterVaults(all, { creator, status });
    expect(out.every((v) => v.creatorAddress === creator && v.status === status)).toBe(true);
  });

  it("returns [] for an unknown creator via listVaults", async () => {
    expect(await listVaults({ creator: "GUNKNOWN" }, { force: true })).toEqual([]);
  });

  it("listVaults applies the creator filter offline", async () => {
    const out = await listVaults({ creator }, { force: true });
    expect(out.every((v) => v.creatorAddress === creator)).toBe(true);
  });
});
