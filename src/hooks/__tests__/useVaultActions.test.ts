// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVaultActions } from "../useVaultActions";
import { submitVaultAction } from "../../services/vaultService";
import { MASTER_VAULTS } from "../../fixtures/vaults";

vi.mock("../../services/vaultService", () => ({
  submitVaultAction: vi.fn(),
}));

const mockSubmitVaultAction = vi.mocked(submitVaultAction);

describe("useVaultActions", () => {
  const vault = MASTER_VAULTS["1"];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets isVaultActionPending while in flight and ignores a second validate click", async () => {
    let resolveSubmit!: () => void;
    mockSubmitVaultAction.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );

    const onChanged = vi.fn();
    const { result } = renderHook(() =>
      useVaultActions(vault, {
        walletAddress: vault.verifierAddress,
        walletNetwork: "TESTNET",
        onChanged,
      }),
    );

    expect(result.current.isVaultActionPending).toBe(false);

    act(() => {
      result.current.handleActionClick("validate_milestone");
    });
    expect(result.current.activeAction).toBe("validate_milestone");

    let firstConfirmPromise!: Promise<void>;
    act(() => {
      firstConfirmPromise = result.current.handleActionConfirm();
    });

    expect(result.current.isVaultActionPending).toBe(true);
    expect(mockSubmitVaultAction).toHaveBeenCalledTimes(1);

    // Attempting a second validate click / confirm while pending is ignored
    act(() => {
      result.current.handleActionClick("validate_milestone");
    });
    await act(async () => {
      await result.current.handleActionConfirm();
    });
    expect(mockSubmitVaultAction).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSubmit();
      await firstConfirmPromise;
    });

    expect(result.current.isVaultActionPending).toBe(false);
    expect(result.current.activeAction).toBeNull();
    expect(onChanged).toHaveBeenCalledTimes(1);
  });
});
