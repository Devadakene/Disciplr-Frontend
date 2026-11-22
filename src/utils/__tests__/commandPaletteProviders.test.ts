import { describe, expect, it, vi } from "vitest";
import type { Vault } from "../../types/vault";
import {
  getActionCommands,
  getNavigationCommands,
  getVaultCommands,
} from "../commandPaletteProviders";

const vault: Vault = {
  id: "alpha-1",
  name: "Alpha Vault",
  status: "active",
  amount: 12500,
  currency: "USDC",
  createdAt: "2024-01-01T00:00:00Z",
  deadline: "2024-07-01T00:00:00Z",
  creatorAddress: "GCREATOR",
  successAddress: "GSUCCESS",
  failureAddress: "GFAILURE",
  contractAddress: "CCONTRACT",
  milestones: [],
  transactions: [],
};

describe("command palette providers", () => {
  it("provides navigation and action items without requiring a DOM", () => {
    const toggleTheme = vi.fn();
    const items = [...getNavigationCommands(), ...getActionCommands(toggleTheme)];

    expect(items).toContainEqual(
      expect.objectContaining({ id: "action-dashboard", to: "/dashboard" }),
    );
    expect(items).toContainEqual(
      expect.objectContaining({ id: "action-theme-toggle", group: "Actions" }),
    );
    expect(items.find((item) => item.id === "action-theme-toggle")?.perform).toBe(
      toggleTheme,
    );
  });

  it("maps vaults to typed palette items", () => {
    expect(getVaultCommands([vault])).toEqual([
      expect.objectContaining({
        id: "vault-alpha-1",
        label: "Alpha Vault",
        to: "/vaults/alpha-1",
        kind: "vault",
        group: "Vaults",
      }),
    ]);
  });
});
