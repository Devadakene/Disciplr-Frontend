import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import CreateVault from "../CreateVault";
import * as vaultService from "../../services/vaultService";
import { CreateIntegrityError } from "../../services/createIntegrity";
import { ACCOUNT_A, ACCOUNT_B, ACCOUNT_C, ACCOUNT_D } from "@/__tests__/fixtures/stellarAddresses";
import type { Vault } from "../../types/vault";

// Mock useWallet
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

describe("CreateVault integrity handling", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows an alert and does not navigate when the API returns a rewritten failure destination", async () => {
    const mockReturnedVault: Vault = {
      id: "vault-integrity-123",
      name: "Vault 100 USDC",
      status: "active",
      amount: 100,
      currency: "USDC",
      createdAt: "2026-06-18T00:00:00Z",
      deadline: "2026-06-19T00:00:00Z",
      creatorAddress: ACCOUNT_A,
      verifierAddress: ACCOUNT_A,
      successAddress: ACCOUNT_B,
      failureAddress: ACCOUNT_C, // rewritten by API!
      contractAddress: ACCOUNT_A,
      milestones: [],
      transactions: [],
    };

    const integrityError = new CreateIntegrityError(
      {
        failureDestination: {
          expected: ACCOUNT_D,
          actual: ACCOUNT_C,
        },
      },
      mockReturnedVault,
    );

    vi.spyOn(vaultService, "createVault").mockRejectedValue(integrityError);

    const prefillState = {
      createVaultPrefill: {
        amount: "100",
        successAddress: ACCOUNT_B,
        failureAddress: ACCOUNT_D,
        milestones: [{ title: "Milestone 1", criteria: "Criteria 1" }],
      },
    };

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/create",
            state: prefillState,
          },
        ]}
      >
        <Routes>
          <Route path="/create" element={<CreateVault />} />
          <Route path="/vaults/:id" element={<div>Vault Detail Page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    // Set a valid future deadline
    const deadlineInput = screen.getByLabelText(/deadline/i);
    await user.clear(deadlineInput);
    await user.type(deadlineInput, "2030-01-01T12:00");

    // Click "Create Vault" to go to review step
    const createBtn = screen.getByRole("button", { name: /^create vault$/i });
    await user.click(createBtn);

    // Verify Review step is displayed
    expect(
      await screen.findByRole("heading", { name: /review vault details/i }),
    ).toBeInTheDocument();

    // Click "Confirm Vault"
    const confirmBtn = screen.getByRole("button", { name: /confirm vault/i });
    await user.click(confirmBtn);

    // Verify that the blocking alert is shown
    const alert = await screen.findByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(screen.getByText(/Vault Verification Warning/i)).toBeInTheDocument();
    expect(screen.getByText(/failureDestination/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(ACCOUNT_D, "i"))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(ACCOUNT_C, "i"))).toBeInTheDocument();

    // Verify we did NOT navigate to the vault detail page
    expect(screen.queryByText("Vault Detail Page")).not.toBeInTheDocument();

    // Verify link to review vault is provided
    const reviewLink = screen.getByRole("link", { name: /review vault/i });
    expect(reviewLink).toBeInTheDocument();
    expect(reviewLink).toHaveAttribute("href", "/vaults/vault-integrity-123");
  });
});
