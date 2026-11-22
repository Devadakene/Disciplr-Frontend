// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetVaultSessionCacheForTesting,
  useCommandPalette,
} from "../useCommandPalette";
import { RECENTS_STORAGE_KEY } from "../../utils/commandPaletteRecents";

const walletState = vi.hoisted(() => ({ address: null as string | null }));
vi.mock("../../context/WalletContext", () => ({
  useOptionalWallet: () => ({ address: walletState.address }),
}));

function createWrapper() {
  return function Wrapper({ children }: PropsWithChildren) {
    return <MemoryRouter>{children}</MemoryRouter>;
  };
}

beforeEach(() => {
  localStorage.clear();
  walletState.address = null;
  _resetVaultSessionCacheForTesting();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  _resetVaultSessionCacheForTesting();
});

describe("useCommandPalette", () => {
  it("moves a selected command to the front of recents when reopened", async () => {
    const loadVaults = vi.fn().mockResolvedValue([]);
    const { result } = renderHook(() => useCommandPalette({ loadVaults }), {
      wrapper: createWrapper(),
    });

    act(() => result.current.open());
    await waitFor(() => expect(loadVaults).toHaveBeenCalledOnce());
    const analytics = result.current.results.find(
      ({ item }) => item.id === "action-analytics",
    );
    expect(analytics).toBeDefined();

    act(() => result.current.runItem(analytics!.item));
    expect(JSON.parse(localStorage.getItem(RECENTS_STORAGE_KEY) ?? "[]")).toEqual([
      "action-analytics",
    ]);

    act(() => result.current.open());
    await waitFor(() =>
      expect(result.current.results[0].item.id).toBe("action-analytics"),
    );
  });

  it("keeps command results available when localStorage reads throw", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    const loadVaults = vi.fn().mockResolvedValue([]);
    const { result } = renderHook(() => useCommandPalette({ loadVaults }), {
      wrapper: createWrapper(),
    });

    act(() => result.current.open());

    expect(result.current.results.some(({ item }) => item.id === "action-dashboard")).toBe(
      true,
    );
    expect(result.current.results.some(({ item }) => item.id === "action-create-vault")).toBe(
      true,
    );
    return waitFor(() => expect(result.current.isLoadingVaults).toBe(false));
  });

  it("clears recent commands when a connected wallet disconnects", async () => {
    localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(["action-analytics"]));
    walletState.address = "GCONNECTED";
    const { result, rerender } = renderHook(() => useCommandPalette(), {
      wrapper: createWrapper(),
    });

    expect(result.current.results[0].item.id).toBe("action-analytics");
    act(() => {
      walletState.address = null;
      rerender();
    });

    await waitFor(() =>
      expect(localStorage.getItem(RECENTS_STORAGE_KEY)).toBeNull(),
    );
    expect(result.current.results[0].item.id).toBe("action-dashboard");
  });
});
