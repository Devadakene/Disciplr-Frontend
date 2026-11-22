import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CreateVault from "../CreateVault";
import { useToastStore } from "../../Zustand/toastStore";
import { useConnectivityStore } from "../../services/connectivity";
import {
  ACCOUNT_A,
  ACCOUNT_B,
  ACCOUNT_C,
  ACCOUNT_D,
} from "@/__tests__/fixtures/stellarAddresses";

const creator = ACCOUNT_A;
const successAddress = ACCOUNT_B;
const failureAddress = ACCOUNT_C;
const verifier = ACCOUNT_D;

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

function apiResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as Response;
}

function vaultRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "vault-reconciled",
    name: "Vault 100 USDC",
    creator,
    amount: "100",
    status: "active",
    startDate: "2026-10-19T00:00:00.000Z",
    endDate: "2030-01-01T12:00:00.000Z",
    verifier,
    successDestination: successAddress,
    failureDestination: failureAddress,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    milestones: [
      {
        id: "milestone-1",
        title: "Milestone 1",
        amount: "100",
        dueDate: "2030-01-01T12:00:00.000Z",
        status: "pending",
      },
    ],
    activity: [],
    ...overrides,
  };
}

function renderCreateVault() {
  return render(
    <MemoryRouter initialEntries={["/create"]}>
      <Routes>
        <Route path="/create" element={<CreateVault />} />
        <Route path="/vaults/:id" element={<div>Vault Detail Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function enterValidDetails(amount = "100") {
  fireEvent.change(screen.getByLabelText("Vault name"), {
    target: { value: `Vault ${amount} USDC` },
  });
  fireEvent.change(screen.getByLabelText(/amount/i), {
    target: { value: amount },
  });
  fireEvent.change(screen.getByLabelText(/deadline/i), {
    target: { value: "2030-01-01T12:00" },
  });
  fireEvent.change(screen.getByLabelText(/success destination/i), {
    target: { value: successAddress },
  });
  fireEvent.change(screen.getByLabelText(/failure destination/i), {
    target: { value: failureAddress },
  });
  fireEvent.change(screen.getByLabelText("Verifier address"), {
    target: { value: verifier },
  });
}

function openReview(amount?: string) {
  enterValidDetails(amount);
  fireEvent.click(screen.getByRole("button", { name: /^create vault$/i }));
  return screen.findByRole("heading", { name: /review vault details/i });
}

// Full form + review + reconciliation flows are slow under jsdom.
vi.setConfig({ testTimeout: 15_000 });

describe("CreateVault create outcomes", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv("VITE_API", "https://api.example.test/api");
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    useToastStore.getState().clear();
    // These tests assert the create/reconcile requests only; keep the global
    // connectivity monitor from flipping to degraded mode and probing /health.
    useConnectivityStore.getState().reset();
    vi.spyOn(useConnectivityStore.getState(), "reportApiFailure").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    useToastStore.getState().clear();
  });

  it("shows API validation details, returns to edit, and can resubmit", async () => {
    fetchMock
      .mockResolvedValueOnce(
        apiResponse(
          {
            error: "Validation failed",
            details: ["verifier must be an active Stellar account", "amount exceeds limit"],
          },
          400,
        ),
      )
      .mockResolvedValueOnce(apiResponse({ data: vaultRecord({ amount: "101", name: "Vault 101 USDC" }) }));

    renderCreateVault();
    await openReview("100");
    fireEvent.click(screen.getByRole("button", { name: /confirm vault/i }));

    expect(
      await screen.findByText("verifier must be an active Stellar account"),
    ).toBeInTheDocument();
    expect(screen.getByText("amount exceeds limit")).toBeInTheDocument();
    expect(screen.getByText("Verifier:")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /back to edit/i }));
    expect(screen.getByLabelText(/amount/i)).toHaveValue("100");
    fireEvent.change(screen.getByLabelText(/amount/i), {
      target: { value: "101" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^create vault$/i }));
    await screen.findByRole("heading", { name: /review vault details/i });
    fireEvent.click(screen.getByRole("button", { name: /confirm vault/i }));

    expect(await screen.findByText("Vault Detail Page", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([url, init]) =>
      String(url).endsWith("/vaults") && init?.method === "POST",
    )).toHaveLength(2);
  });

  it("reconciles a network failure to a single matching vault", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("network failure"))
      .mockImplementationOnce(() =>
        Promise.resolve(apiResponse({ data: [vaultRecord()] })),
      );

    renderCreateVault();
    await openReview();
    fireEvent.click(screen.getByRole("button", { name: /confirm vault/i }));

    expect(await screen.findByText("Vault Detail Page", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain(
      `creator=${encodeURIComponent(creator)}`,
    );
    expect(useToastStore.getState().toasts[0]?.message).toBe(
      "Your vault was created.",
    );
  });

  it("allows a retry after two empty reconciliation lookups", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("network failure"))
      .mockResolvedValueOnce(apiResponse({ data: [] }))
      .mockResolvedValueOnce(apiResponse({ data: [] }));

    renderCreateVault();
    await openReview();
    fireEvent.click(screen.getByRole("button", { name: /confirm vault/i }));

    expect(await screen.findByRole("button", { name: /try again/i })).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("offers Check again when a 503 and reconciliation lookup both fail", async () => {
    fetchMock
      .mockResolvedValueOnce(apiResponse({ error: "Unavailable" }, 503))
      .mockResolvedValueOnce(apiResponse({ error: "Unavailable" }, 503));

    renderCreateVault();
    await openReview();
    fireEvent.click(screen.getByRole("button", { name: /confirm vault/i }));

    expect(await screen.findByRole("button", { name: /check again/i })).toBeEnabled();
    expect(screen.getByText(/couldn't check whether your vault was created/i)).toBeInTheDocument();
  });

  it("sends only one POST when Confirm Vault is clicked twice rapidly", async () => {
    let resolvePost: (response: Response) => void = () => {};
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolvePost = resolve;
        }),
    );

    renderCreateVault();
    await openReview();
    const confirmButton = screen.getByRole("button", { name: /confirm vault/i });
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][1]?.method).toBe("POST");
    resolvePost(apiResponse({ data: vaultRecord() }));
    expect(await screen.findByText("Vault Detail Page", {}, { timeout: 5000 })).toBeInTheDocument();
  });
});
