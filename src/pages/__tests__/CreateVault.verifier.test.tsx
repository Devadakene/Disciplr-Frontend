import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_A, ACCOUNT_B, ACCOUNT_C, ACCOUNT_D } from "@/__tests__/fixtures/stellarAddresses";
import CreateVault from "../CreateVault";
import * as vaultService from "../../services/vaultService";
import type { Vault } from "../../types/vault";

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

const createdVault: Vault = {
  id: "created-vault",
  name: "Launch milestone vault",
  status: "active",
  amount: 100,
  currency: "USDC",
  createdAt: "2026-06-18T00:00:00Z",
  deadline: "2030-01-01T12:00",
  creatorAddress: ACCOUNT_A,
  verifierAddress: ACCOUNT_C,
  successAddress: ACCOUNT_B,
  failureAddress: ACCOUNT_D,
  contractAddress: ACCOUNT_A,
  milestones: [],
  transactions: [],
};

async function renderCreateVault() {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/create"]}>
      <Routes>
        <Route path="/create" element={<CreateVault />} />
        <Route path="/vaults/:id" element={<div>Created detail page</div>} />
      </Routes>
    </MemoryRouter>,
  );

  await user.type(screen.getByLabelText("Vault name"), "Launch milestone vault");
  await user.type(screen.getByLabelText("Amount (USDC)"), "100");
  await user.type(screen.getByLabelText("Deadline (ISO date)"), "2030-01-01T12:00");
  await user.type(
    screen.getByLabelText("Success destination (Stellar address)"),
    ACCOUNT_B,
  );
  await user.type(
    screen.getByLabelText("Failure destination (Stellar address)"),
    ACCOUNT_D,
  );

  return user;
}

describe("CreateVault verifier field", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    [ACCOUNT_A, "Verifier cannot be you."],
    [ACCOUNT_B, "Verifier must be different from the success destination."],
    [ACCOUNT_D, "Verifier must be different from the failure destination."],
  ])("blocks a verifier that conflicts with another address", async (verifier, message) => {
    const user = await renderCreateVault();
    await user.type(screen.getByLabelText("Verifier address"), verifier);
    await user.click(screen.getByRole("button", { name: "Create Vault" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(document.activeElement).toBe(screen.getByLabelText("Verifier address"));
    expect(screen.queryByRole("heading", { name: "Review Vault Details" })).not.toBeInTheDocument();
  }, 15000);

  it("shows name and verifier in review, then passes both to createVault", async () => {
    const createSpy = vi
      .spyOn(vaultService, "createVault")
      .mockResolvedValue(createdVault);
    const user = await renderCreateVault();
    await user.type(screen.getByLabelText("Verifier address"), ACCOUNT_C);
    await user.click(screen.getByRole("button", { name: "Create Vault" }));

    expect(
      await screen.findByRole("heading", { name: "Review Vault Details" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Launch milestone vault")).toBeInTheDocument();
    expect(screen.getByRole("text", { name: `Address ${ACCOUNT_C}` })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirm Vault" }));

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Launch milestone vault",
        verifierAddress: ACCOUNT_C,
      }),
    );
    expect(await screen.findByText("Created detail page")).toBeInTheDocument();
  });
});
