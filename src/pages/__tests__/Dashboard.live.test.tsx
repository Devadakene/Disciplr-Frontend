import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Vault } from "../../types/vault";

let mockAddress: string | null = null;
vi.mock("../../context/WalletContext", () => ({
  useWallet: () => ({ address: mockAddress, connect: vi.fn() }),
}));

const listVaults = vi.fn();
const getStats = vi.fn();
const listTransactionsForVaults = vi.fn();
vi.mock("../../services/vaultService", () => ({
  listVaults: (...a: unknown[]) => listVaults(...a),
  getStats: (...a: unknown[]) => getStats(...a),
  listTransactionsForVaults: (...a: unknown[]) => listTransactionsForVaults(...a),
}));
vi.mock("../../services/api", () => ({ isApiEnabled: () => true }));

import Dashboard from "../Dashboard";

const mk = (id: string, name: string, creator: string, verifier = "NOBODY"): Vault =>
  ({
    id,
    name,
    status: "active",
    amount: 100,
    currency: "USDC",
    createdAt: "2026-01-01T00:00:00.000Z",
    deadline: "2099-12-01T00:00:00.000Z",
    creatorAddress: creator,
    verifierAddress: verifier,
    milestones: [],
    transactions: [],
  }) as Vault;

const ALL = [mk("1", "Alpha vault", "A"), mk("2", "Beta vault", "B"), mk("3", "Gamma vault", "C", "A")];

function setup() {
  listVaults.mockImplementation(async (filter?: { creator?: string }) =>
    filter?.creator ? ALL.filter((v) => v.creatorAddress === filter.creator) : ALL,
  );
  getStats.mockResolvedValue({ totalLocked: 100, active: 1 });
  listTransactionsForVaults.mockResolvedValue([]);
}

const ui = () => (
  <MemoryRouter>
    <Dashboard />
  </MemoryRouter>
);

describe("Dashboard (live)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup();
  });
  afterEach(cleanup);

  it("shows a connect prompt and no vault data when disconnected", () => {
    mockAddress = null;
    render(ui());
    expect(screen.getByText(/connect your wallet/i)).toBeTruthy();
    expect(screen.queryByText("Alpha vault")).toBeNull();
    expect(listVaults).not.toHaveBeenCalled();
  });

  it("lists only the creator's and verifier's vaults", async () => {
    mockAddress = "A";
    render(ui());
    await waitFor(() => expect(screen.getAllByText("Alpha vault").length).toBeGreaterThan(0));
    expect(screen.getAllByText("Gamma vault").length).toBeGreaterThan(0);
    expect(screen.queryByText("Beta vault")).toBeNull();
    expect(listVaults).toHaveBeenCalledWith({ creator: "A" });
    expect(getStats).toHaveBeenCalledWith({ creator: "A" });
  });

  it("shows the empty state for a wallet with no vaults", async () => {
    mockAddress = "NEW";
    render(ui());
    await waitFor(() => expect(screen.getByText("No vaults yet")).toBeTruthy());
  });

  it("ignores a slow response for the previous wallet after a switch", async () => {
    let releaseOld!: (v: Vault[]) => void;
    listVaults.mockImplementation((filter?: { creator?: string }) => {
      if (!filter) return Promise.resolve(ALL);
      if (filter.creator === "A") return new Promise<Vault[]>((r) => (releaseOld = r));
      return Promise.resolve(ALL.filter((v) => v.creatorAddress === filter.creator));
    });

    mockAddress = "A";
    const { rerender } = render(ui());

    mockAddress = "B";
    rerender(ui());
    await waitFor(() => expect(screen.getAllByText("Beta vault").length).toBeGreaterThan(0));

    await act(async () => {
      releaseOld([ALL[0]]);
    });
    expect(screen.queryByText("Alpha vault")).toBeNull();
    expect(screen.getAllByText("Beta vault").length).toBeGreaterThan(0);
  });
});
