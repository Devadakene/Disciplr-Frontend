/**
 * @vitest-environment jsdom
 *
 * jsdom is required so `setupTests.ts` can define `window.matchMedia` and so
 * reduced-motion duration tests can stub the media query API.
 */
import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TOAST_MAX_VISIBLE,
  TOAST_DEFAULT_DURATION_MS,
  TOAST_REDUCED_MOTION_DURATION_MS,
  __resetToastStoreForTests,
  useToastStore,
} from "../toastStore";

describe("toastStore", () => {
  beforeEach(() => {
    __resetToastStoreForTests();
  });

  afterEach(() => {
    __resetToastStoreForTests();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("pushes a toast with a generated id and default info variant", () => {
    const id = useToastStore.getState().push({ message: "hello" });
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].id).toBe(id);
    expect(toasts[0].variant).toBe("info");
    expect(toasts[0].message).toBe("hello");
    expect(typeof toasts[0].createdAt).toBe("number");
  });

  it("respects an explicit variant", () => {
    useToastStore.getState().push({ message: "boom", variant: "error" });
    expect(useToastStore.getState().toasts[0].variant).toBe("error");
  });

  it("dismisses a specific toast by id", () => {
    const a = useToastStore.getState().push({ message: "a" });
    useToastStore.getState().push({ message: "b" });
    useToastStore.getState().dismiss(a);
    const remaining = useToastStore.getState().toasts;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].message).toBe("b");
  });

  it("dismissing an unknown id is a no-op", () => {
    useToastStore.getState().push({ message: "a" });
    useToastStore.getState().dismiss("does-not-exist");
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it("auto-dismisses after the supplied duration", () => {
    vi.useFakeTimers();
    useToastStore.getState().push({ message: "short", durationMs: 1000 });
    expect(useToastStore.getState().toasts).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("uses the default duration when durationMs is omitted", () => {
    vi.useFakeTimers();
    useToastStore.getState().push({ message: "default" });
    act(() => {
      vi.advanceTimersByTime(TOAST_DEFAULT_DURATION_MS - 1);
    });
    expect(useToastStore.getState().toasts).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("uses the reduced-motion duration when prefers-reduced-motion is set", () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));

    useToastStore.getState().push({ message: "reduced" });
    act(() => {
      vi.advanceTimersByTime(TOAST_REDUCED_MOTION_DURATION_MS - 1);
    });
    expect(useToastStore.getState().toasts).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("durationMs: 0 disables auto-dismiss entirely", () => {
    vi.useFakeTimers();
    useToastStore.getState().push({ message: "sticky", durationMs: 0 });
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it("negative durationMs also disables auto-dismiss", () => {
    vi.useFakeTimers();
    useToastStore.getState().push({ message: "sticky", durationMs: -1 });
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it("clear() removes every toast and cancels pending timers", () => {
    vi.useFakeTimers();
    useToastStore.getState().push({ message: "a", durationMs: 1000 });
    useToastStore.getState().push({ message: "b", durationMs: 2000 });
    useToastStore.getState().push({ message: "c", durationMs: 3000 });
    useToastStore.getState().clear();
    expect(useToastStore.getState().toasts).toHaveLength(0);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("two pushes with the same message get distinct ids (no id collision)", () => {
    const a = useToastStore.getState().push({ message: "dup" });
    const b = useToastStore.getState().push({ message: "dup" });
    expect(a).not.toBe(b);
    expect(useToastStore.getState().toasts).toHaveLength(2);
  });

  it("evicts oldest toasts FIFO when maxVisible is exceeded", () => {
    vi.useFakeTimers();
    const ids: string[] = [];
    for (let i = 0; i < TOAST_MAX_VISIBLE + 2; i += 1) {
      ids.push(
        useToastStore.getState().push({
          message: `msg-${i}`,
          durationMs: 10_000,
        }),
      );
    }

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(TOAST_MAX_VISIBLE);
    expect(toasts.map((t) => t.message)).toEqual(
      Array.from({ length: TOAST_MAX_VISIBLE }, (_, i) => `msg-${i + 2}`),
    );

    // Timers for evicted toasts must not re-introduce them later.
    useToastStore.getState().clear();
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("manual dismiss cancels the auto-dismiss timer", () => {
    vi.useFakeTimers();
    const id = useToastStore.getState().push({
      message: "manual",
      durationMs: 2000,
    });
    useToastStore.getState().dismiss(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
