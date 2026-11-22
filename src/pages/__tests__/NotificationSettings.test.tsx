import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NotificationSettings from "../NotificationSettings";
import { PREFERENCE_DEFAULTS, useNotificationPreferences } from "../../Zustand/notificationPreferences";
import { DEMO_ADDRESS } from "../../context/WalletContext";
import type { Vault } from "../../types/vault";

const { listVaultsMock } = vi.hoisted(() => ({ listVaultsMock: vi.fn() }));

vi.mock("../../services/vaultService", () => ({ listVaults: listVaultsMock }));
vi.mock("../../context/WalletContext", async () => {
  const actual = await vi.importActual<typeof import("../../context/WalletContext")>("../../context/WalletContext");
  return { ...actual, useWallet: () => ({ address: DEMO_ADDRESS }) };
});

const vault: Vault = {
  id: "v-101",
  name: "Creator vault",
  status: "active",
  amount: 10,
  currency: "USDC",
  createdAt: "2026-01-01",
  deadline: "2026-12-01",
  creatorAddress: DEMO_ADDRESS,
  successAddress: DEMO_ADDRESS,
  failureAddress: DEMO_ADDRESS,
  contractAddress: "GCONT123",
  milestones: [],
  transactions: [],
};

function renderSettings() {
  return render(<NotificationSettings />);
}

describe("NotificationSettings", () => {
  beforeEach(() => {
    localStorage.clear();
    useNotificationPreferences.getState().reset();
    listVaultsMock.mockResolvedValue([vault]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("persists quiet-hours values across unmount and remount", async () => {
    const view = renderSettings();
    fireEvent.change(screen.getByLabelText("Quiet Hours Start"), { target: { value: "23:00" } });
    fireEvent.change(screen.getByLabelText("Quiet Hours End"), { target: { value: "06:30" } });
    view.unmount();
    renderSettings();
    expect(screen.getByLabelText("Quiet Hours Start")).toHaveValue("23:00");
    expect(screen.getByLabelText("Quiet Hours End")).toHaveValue("06:30");
  });

  it("reset immediately restores defaults and clears vault toggles", async () => {
    renderSettings();
    await screen.findByText("Creator vault");
    fireEvent.change(screen.getByLabelText("Quiet Hours Start"), { target: { value: "23:00" } });
    fireEvent.change(screen.getByLabelText("Quiet Hours End"), { target: { value: "06:30" } });
    fireEvent.change(screen.getByLabelText("Notification Frequency"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("switch", { name: "Creator vault notifications" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset Preferences" }));
    expect(screen.getByLabelText("Quiet Hours Start")).toHaveValue(PREFERENCE_DEFAULTS.quietHours.start);
    expect(screen.getByLabelText("Quiet Hours End")).toHaveValue(PREFERENCE_DEFAULTS.quietHours.end);
    expect(screen.getByLabelText("Notification Frequency")).toHaveValue(PREFERENCE_DEFAULTS.frequency);
    expect(screen.getByRole("switch", { name: "Creator vault notifications" })).toHaveAttribute("aria-checked", "false");
  });

  it("shows an inline error for equal times without persisting the invalid range", () => {
    renderSettings();
    fireEvent.change(screen.getByLabelText("Quiet Hours Start"), { target: { value: "22:00" } });
    fireEvent.change(screen.getByLabelText("Quiet Hours End"), { target: { value: "22:00" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Start and end times must be different");
    expect(screen.getByLabelText("Quiet Hours End")).toHaveAttribute("aria-invalid", "true");
    expect(useNotificationPreferences.getState().quietHours).toEqual(PREFERENCE_DEFAULTS.quietHours);
  });

  it("renders the real vault list and persists per-vault preferences", async () => {
    const { unmount } = renderSettings();
    const toggle = await screen.findByRole("switch", { name: "Creator vault notifications" });
    fireEvent.click(toggle);
    expect(useNotificationPreferences.getState().vaultOverrides).toEqual({ "v-101": true });
    unmount();
    renderSettings();
    await waitFor(() => expect(screen.getByRole("switch", { name: "Creator vault notifications" })).toHaveAttribute("aria-checked", "true"));
  });

  it("shows loading and error states without pruning preferences on fetch failure", async () => {
    useNotificationPreferences.getState().setVaultOverride("v-101", true);
    let rejectFetch!: (reason: Error) => void;
    listVaultsMock.mockImplementationOnce(() => new Promise((_, reject) => { rejectFetch = reject; }));
    renderSettings();
    // jsdom has no Notification API, so the push hint is also a status region.
    expect(
      screen.getAllByRole("status").some((el) => /Loading vaults/.test(el.textContent ?? "")),
    ).toBe(true);
    await act(async () => rejectFetch(new Error("offline")));
    expect(screen.getByRole("alert")).toHaveTextContent("Vaults could not be loaded");
    expect(useNotificationPreferences.getState().vaultOverrides).toEqual({ "v-101": true });
  });
});