import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import Vaults from "../Vaults";
import * as vaultService from "../../services/vaultService";
import type { Vault } from "../../types/vault";

const mockUseWallet = vi.fn();
vi.mock("../../context/WalletContext", () => ({
  useWallet: () => mockUseWallet(),
}));

vi.mock("../../components/Wallet/WalletConnectButton", () => ({
  WalletConnectButton: () => <button>Connect Wallet</button>,
}));

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname + location.search}</div>;
}

function renderVaults(initialEntry = "/vaults") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Vaults />
      <LocationDisplay />
    </MemoryRouter>,
  );
}

function generateVaults(count: number): Vault[] {
  const result: Vault[] = [];
  for (let i = 1; i <= count; i++) {
    result.push({
      id: `vault-${i}`,
      name: `Vault ${i}`,
      status: i % 2 === 0 ? "active" : "completed",
      amount: 100 * i,
      currency: "USDC",
      createdAt: new Date(2026, 0, i).toISOString(),
      deadline: new Date(2026, 5, i).toISOString(),
      creatorAddress: i <= 5 ? "GCREATOR_USER" : `GCREATOR_${i}`,
      verifierAddress: i >= 5 && i <= 8 ? "GVERIFIER_USER" : `GVERIFIER_${i}`,
      successAddress: "GSUCC",
      failureAddress: "GFAIL",
      contractAddress: `GCONT_${i}`,
      milestones: [
        {
          id: `m-${i}-1`,
          title: "Milestone 1",
          description: "Desc",
          criteria: "Crit",
          status: "validated",
        },
      ],
      transactions: [],
    });
  }
  return result;
}

describe("Vaults Explorer Page", () => {
  const mockVaults = generateVaults(50);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(vaultService, "listVaults").mockResolvedValue(mockVaults);
    mockUseWallet.mockReturnValue({
      address: null,
      isConnecting: false,
      sessionStatus: "anonymous",
      connectDemo: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("restores exact view from URL parameters on initial load", async () => {
    mockUseWallet.mockReturnValue({
      address: "GCREATOR_USER",
      isConnecting: false,
      sessionStatus: "authenticated",
      connectDemo: vi.fn(),
    });

    renderVaults("/vaults?scope=mine&status=active&q=Vault&sort=-amount&page=1");

    await waitFor(() => {
      expect(screen.queryByText(/loading vaults/i)).not.toBeInTheDocument();
    });

    // Vaults are fetched once; the "mine" scope is applied client-side
    expect(vaultService.listVaults).toHaveBeenCalled();

    // Scope 'mine' should be pressed
    const mineScopeBtn = screen.getByRole("button", { name: "Created by me" });
    expect(mineScopeBtn).toHaveAttribute("aria-pressed", "true");

    // Status 'active' tab should be selected
    const activeTab = screen.getByRole("tab", { name: /active/i });
    expect(activeTab).toHaveAttribute("aria-selected", "true");

    // Search input should have 'Vault'
    const searchInput = screen.getByLabelText(/search vaults/i) as HTMLInputElement;
    expect(searchInput.value).toBe("Vault");
  });

  it("falls back to defaults gracefully without errors on invalid parameters", async () => {
    renderVaults("/vaults?scope=invalid&status=hacked&sort=random&page=-5");

    await waitFor(() => {
      expect(screen.queryByText(/loading vaults/i)).not.toBeInTheDocument();
    });

    const allScopeBtn = screen.getByRole("button", { name: "All Vaults" });
    expect(allScopeBtn).toHaveAttribute("aria-pressed", "true");

    const allTab = screen.getByRole("tab", { name: /^all$/i });
    expect(allTab).toHaveAttribute("aria-selected", "true");
  });

  it("paginates 12 items per page with 50 vaults and navigates pages", async () => {
    renderVaults("/vaults");

    await waitFor(() => {
      expect(screen.queryByText(/loading vaults/i)).not.toBeInTheDocument();
    });

    // 12 vaults rendered on page 1
    const cards = screen.getAllByRole("link").filter((l) => l.getAttribute("href")?.startsWith("/vaults/vault-"));
    expect(cards).toHaveLength(12);

    // Pagination info
    expect(screen.getByText(/page 1 of 5/i)).toBeInTheDocument();

    // Navigate to page 2
    const nextBtn = screen.getByRole("button", { name: /go to next page/i });
    fireEvent.click(nextBtn);

    expect(screen.getByTestId("location-display")).toHaveTextContent("page=2");
  });

  it("resets to page 1 when filter or search changes", async () => {
    vi.useFakeTimers();
    renderVaults("/vaults?page=3");

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Change status tab
    const activeTab = screen.getByRole("tab", { name: /active/i });
    fireEvent.click(activeTab);

    expect(screen.getByTestId("location-display")).toHaveTextContent("status=active");
    expect(screen.getByTestId("location-display")).not.toHaveTextContent("page=3");

    // Search input change debounces and resets page
    const searchInput = screen.getByLabelText(/search vaults/i);
    fireEvent.change(searchInput, { target: { value: "test" } });

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.getByTestId("location-display")).toHaveTextContent("q=test");
    expect(screen.getByTestId("location-display")).not.toHaveTextContent("page=");

    vi.useRealTimers();
  });

  it("handles keyboard navigation across tabs (ArrowRight, ArrowLeft, Home, End)", async () => {
    renderVaults("/vaults");

    await waitFor(() => {
      expect(screen.queryByText(/loading vaults/i)).not.toBeInTheDocument();
    });

    const allTab = screen.getByRole("tab", { name: /^all$/i });
    allTab.focus();
    expect(allTab).toHaveFocus();

    // ArrowRight moves to 'Active'
    fireEvent.keyDown(allTab, { key: "ArrowRight" });
    const activeTab = screen.getByRole("tab", { name: /active/i });
    expect(activeTab).toHaveAttribute("aria-selected", "true");
    expect(activeTab).toHaveFocus();

    // End key moves to last tab ('Cancelled')
    fireEvent.keyDown(activeTab, { key: "End" });
    const cancelledTab = screen.getByRole("tab", { name: /cancelled/i });
    expect(cancelledTab).toHaveAttribute("aria-selected", "true");
    expect(cancelledTab).toHaveFocus();

    // Home key moves back to first tab ('All')
    fireEvent.keyDown(cancelledTab, { key: "Home" });
    expect(screen.getByRole("tab", { name: /^all$/i })).toHaveAttribute("aria-selected", "true");
  });

  it("shows connect prompt when scope=mine or scope=verifying and wallet is disconnected", async () => {
    mockUseWallet.mockReturnValue({
      address: null,
      isConnecting: false,
      sessionStatus: "anonymous",
      connectDemo: vi.fn(),
    });

    renderVaults("/vaults?scope=mine");

    await waitFor(() => {
      expect(screen.queryByText(/loading vaults/i)).not.toBeInTheDocument();
    });

    expect(screen.getByRole("heading", { name: /connect your wallet/i })).toBeInTheDocument();
    expect(screen.getByText(/you need a connected wallet to view your created vaults/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try the demo account/i })).toBeInTheDocument();
  });

  it("shows connect prompt if wallet disconnects while on scope=mine", async () => {
    const { rerender } = renderVaults("/vaults?scope=mine");

    mockUseWallet.mockReturnValue({
      address: "GADDR",
      isConnecting: false,
      sessionStatus: "authenticated",
      connectDemo: vi.fn(),
    });

    rerender(
      <MemoryRouter initialEntries={["/vaults?scope=mine"]}>
        <Vaults />
        <LocationDisplay />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: /connect your wallet/i })).not.toBeInTheDocument();
    });

    // Now disconnect
    mockUseWallet.mockReturnValue({
      address: null,
      isConnecting: false,
      sessionStatus: "anonymous",
      connectDemo: vi.fn(),
    });

    rerender(
      <MemoryRouter initialEntries={["/vaults?scope=mine"]}>
        <Vaults />
        <LocationDisplay />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /connect your wallet/i })).toBeInTheDocument();
    });
  });

  it("displays error with working Retry button when load fails", async () => {
    const listSpy = vi.spyOn(vaultService, "listVaults")
      .mockRejectedValueOnce(new Error("Network exploded"))
      .mockResolvedValueOnce(mockVaults);

    renderVaults("/vaults");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network exploded");
    });

    const retryBtn = screen.getByRole("button", { name: /retry/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getAllByRole("link").filter((l) => l.getAttribute("href")?.startsWith("/vaults/vault-")).length).toBeGreaterThan(0);
    });

    expect(listSpy).toHaveBeenCalledTimes(2);
  });

  it("exposes correct ARIA semantics for tablist and tabpanel", async () => {
    renderVaults("/vaults");

    await waitFor(() => {
      expect(screen.queryByText(/loading vaults/i)).not.toBeInTheDocument();
    });

    const tablist = screen.getByRole("tablist", { name: /filter vaults by status/i });
    expect(tablist).toBeInTheDocument();

    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBe(6);

    const activeTab = tabs.find((t) => t.getAttribute("aria-selected") === "true");
    expect(activeTab).toBeDefined();
    expect(activeTab).toHaveAttribute("aria-controls", "vaults-tabpanel");

    const tabpanel = screen.getByRole("tabpanel");
    expect(tabpanel).toHaveAttribute("aria-labelledby", activeTab?.id);
  });
});
