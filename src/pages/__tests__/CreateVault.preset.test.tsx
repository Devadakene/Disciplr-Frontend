import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import CreateVault from "../CreateVault";
import { ACCOUNT_A } from "@/__tests__/fixtures/stellarAddresses";

vi.mock("../../context/WalletContext", () => ({
  useWallet: () => ({
    address: ACCOUNT_A,
    network: "TESTNET",
    balance: "10000",
    balanceStatus: "success",
    isConnecting: false,
    error: null,
    connect: async () => {},
    disconnect: () => {},
    checkConnection: async () => {},
  }),
}));

describe("CreateVault preset highlight persistence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("persists preset active state after 1 minute passes", async () => {
    render(
      <MemoryRouter>
        <CreateVault />
      </MemoryRouter>
    );

    const preset7dButton = screen.getByRole("button", { name: "7 days" });

    // Initially not highlighted (fontWeight not 600 or check style)
    expect(preset7dButton).toHaveStyle({ fontWeight: 400 });

    // Click preset button
    await act(async () => {
      preset7dButton.click();
    });

    // Now highlighted
    expect(preset7dButton).toHaveStyle({ fontWeight: 600 });

    // Advance clock by 2 minutes
    await act(async () => {
      vi.advanceTimersByTime(120_000);
    });

    // Preset button highlight should persist because state tracks selectedPreset
    expect(preset7dButton).toHaveStyle({ fontWeight: 600 });
  });
});
