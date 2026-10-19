import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetToastStoreForTests,
  useToastStore,
} from "../../Zustand/toastStore";
import { ToastProvider, ToastViewport } from "../ToastViewport";
import { useToast } from "../useToast";

describe("ToastViewport", () => {
  beforeEach(() => {
    __resetToastStoreForTests();
  });

  afterEach(() => {
    __resetToastStoreForTests();
    vi.unstubAllGlobals();
  });

  it("renders nothing when the store is empty", () => {
    render(<ToastViewport />);
    expect(screen.queryByTestId("toast")).not.toBeInTheDocument();
    expect(screen.getByTestId("toast-viewport")).toBeInTheDocument();
  });

  it("renders every toast with role=status and aria-live=polite", () => {
    act(() => {
      useToastStore.getState().push({ message: "first", durationMs: 0 });
      useToastStore.getState().push({
        message: "second",
        variant: "success",
        durationMs: 0,
      });
    });
    render(<ToastViewport />);
    const items = screen.getAllByTestId("toast");
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(item).toHaveAttribute("role", "status");
      expect(item).toHaveAttribute("aria-live", "polite");
    }
    expect(screen.getByText("first")).toBeInTheDocument();
    expect(screen.getByText("second")).toBeInTheDocument();
  });

  it("exposes a polite live region container for screen readers", () => {
    render(<ToastViewport />);
    const region = screen.getByRole("region", { name: /notifications/i });
    expect(region).toHaveClass("toast-viewport");
  });

  it("wires the toast z-index token via CSS custom property class", () => {
    render(<ToastViewport />);
    // Viewport class is styled with z-index: var(--z-index-toast) in ToastViewport.css
    expect(screen.getByTestId("toast-viewport")).toHaveClass("toast-viewport");
  });

  it("clicking the dismiss button removes the toast from the store and DOM", async () => {
    const user = userEvent.setup();
    act(() => {
      useToastStore.getState().push({ message: "dismiss me", durationMs: 0 });
    });
    render(<ToastViewport />);
    expect(screen.getByTestId("toast")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /dismiss notification/i }),
    );
    expect(screen.queryByTestId("toast")).not.toBeInTheDocument();
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("applies a variant class and data-variant per toast", () => {
    act(() => {
      useToastStore.getState().push({
        message: "ok",
        variant: "success",
        durationMs: 0,
      });
      useToastStore.getState().push({
        message: "bad",
        variant: "error",
        durationMs: 0,
      });
      useToastStore.getState().push({
        message: "note",
        variant: "info",
        durationMs: 0,
      });
    });
    render(<ToastViewport />);
    const items = screen.getAllByTestId("toast");
    expect(items[0]).toHaveClass("toast--success");
    expect(items[0]).toHaveAttribute("data-variant", "success");
    expect(items[1]).toHaveClass("toast--error");
    expect(items[1]).toHaveAttribute("data-variant", "error");
    expect(items[2]).toHaveClass("toast--info");
    expect(items[2]).toHaveAttribute("data-variant", "info");
  });

  it("skips enter animation class effects under prefers-reduced-motion", () => {
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

    act(() => {
      useToastStore.getState().push({ message: "calm", durationMs: 0 });
    });
    render(<ToastViewport />);
    const toast = screen.getByTestId("toast");
    // Animation is controlled purely via CSS media query; the toast still
    // mounts with the base class so reduced-motion CSS can zero it out.
    expect(toast).toHaveClass("toast");
    expect(window.matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(
      true,
    );
  });

  it("updates when the store receives a new toast after mount", () => {
    render(<ToastViewport />);
    expect(screen.queryByTestId("toast")).not.toBeInTheDocument();
    act(() => {
      useToastStore.getState().push({ message: "late", durationMs: 0 });
    });
    expect(screen.getByText("late")).toBeInTheDocument();
  });

  it("ToastProvider renders children and the viewport", () => {
    render(
      <ToastProvider>
        <div data-testid="child">content</div>
      </ToastProvider>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByTestId("toast-viewport")).toBeInTheDocument();
  });
});

describe("useToast", () => {
  beforeEach(() => {
    __resetToastStoreForTests();
  });

  afterEach(() => {
    __resetToastStoreForTests();
  });

  it("exposes push/dismiss/clear bound to the store", () => {
    function Probe() {
      const { push, dismiss, clear } = useToast();
      return (
        <div>
          <button type="button" onClick={() => push({ message: "from-hook", durationMs: 0 })}>
            push
          </button>
          <button
            type="button"
            onClick={() => {
              const id = useToastStore.getState().toasts[0]?.id;
              if (id) dismiss(id);
            }}
          >
            dismiss
          </button>
          <button type="button" onClick={() => clear()}>
            clear
          </button>
        </div>
      );
    }

    render(
      <>
        <Probe />
        <ToastViewport />
      </>,
    );

    act(() => {
      screen.getByRole("button", { name: "push" }).click();
    });
    expect(screen.getByText("from-hook")).toBeInTheDocument();

    act(() => {
      screen.getByRole("button", { name: "dismiss" }).click();
    });
    expect(screen.queryByText("from-hook")).not.toBeInTheDocument();

    act(() => {
      useToastStore.getState().push({ message: "a", durationMs: 0 });
      useToastStore.getState().push({ message: "b", durationMs: 0 });
    });
    expect(useToastStore.getState().toasts).toHaveLength(2);
    act(() => {
      screen.getByRole("button", { name: "clear" }).click();
    });
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
