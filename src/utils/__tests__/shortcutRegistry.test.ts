// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetRegistryForTesting,
  getRegisteredShortcuts,
  isEditableTarget,
  registerShortcut,
} from "../shortcutRegistry";

describe("shortcutRegistry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _resetRegistryForTesting();
  });

  afterEach(() => {
    vi.useRealTimers();
    _resetRegistryForTesting();
    vi.restoreAllMocks();
  });

  it("installs only one document-level keydown listener", () => {
    const addEventListenerSpy = vi.spyOn(document, "addEventListener");

    registerShortcut({
      keys: "g d",
      description: "Go to Dashboard",
      handler: vi.fn(),
    });

    registerShortcut({
      keys: "g v",
      description: "Go to Vaults",
      handler: vi.fn(),
    });

    registerShortcut({
      keys: "mod+k",
      description: "Open command palette",
      handler: vi.fn(),
    });

    // Only 1 document keydown listener should be added
    const keydownListeners = addEventListenerSpy.mock.calls.filter(
      ([event]) => event === "keydown",
    );
    expect(keydownListeners.length).toBe(1);
  });

  it("warns on duplicate shortcut registration", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    registerShortcut({
      keys: "g d",
      description: "Go to Dashboard",
      handler: vi.fn(),
    });

    registerShortcut({
      keys: "g d",
      description: "Another Dashboard shortcut",
      handler: vi.fn(),
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Duplicate shortcut registration for keys: "g d"'),
    );
  });

  it("unregisters shortcut when calling returned cleanup function", () => {
    const handler = vi.fn();
    const unregister = registerShortcut({
      keys: "c",
      description: "Create Vault",
      handler,
    });

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "c" }));
    expect(handler).toHaveBeenCalledTimes(1);

    unregister();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "c" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("handles two-key sequences with timeout", () => {
    const dashboardHandler = vi.fn();
    registerShortcut({
      keys: "g d",
      description: "Go to Dashboard",
      handler: dashboardHandler,
    });

    // Press 'g' then 'd' within 1 second
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "g" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "d" }));

    expect(dashboardHandler).toHaveBeenCalledTimes(1);

    // Press 'g', wait > 1 second (timeout expires), then press 'd'
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "g" }));
    vi.advanceTimersByTime(1100);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "d" }));

    // Handler should not have been called a second time
    expect(dashboardHandler).toHaveBeenCalledTimes(1);
  });

  it("suppresses shortcuts when target or activeElement is editable", () => {
    const handler = vi.fn();
    registerShortcut({
      keys: "c",
      description: "Create Vault",
      handler,
    });

    const input = document.createElement("input");
    document.body.appendChild(input);

    const event = new KeyboardEvent("keydown", { key: "c" });
    Object.defineProperty(event, "target", { value: input, writable: false });

    document.dispatchEvent(event);
    expect(handler).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it("respects when predicate", () => {
    let allowed = false;
    const handler = vi.fn();

    registerShortcut({
      keys: "c",
      description: "Create Vault",
      handler,
      when: () => allowed,
    });

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "c" }));
    expect(handler).not.toHaveBeenCalled();

    allowed = true;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "c" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("handles mod+k on Mac (Meta) and Windows (Ctrl)", () => {
    const handler = vi.fn();
    registerShortcut({
      keys: "mod+k",
      description: "Open command palette",
      handler,
    });

    // Ctrl+K
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true }),
    );
    expect(handler).toHaveBeenCalledTimes(1);

    // Meta+K (Cmd+K)
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true }),
    );
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("formats registered shortcuts for display in getRegisteredShortcuts", () => {
    registerShortcut({
      keys: "mod+k",
      description: "Open command palette",
      handler: vi.fn(),
    });
    registerShortcut({
      keys: "g v",
      description: "Go to Vaults",
      handler: vi.fn(),
    });

    const entries = getRegisteredShortcuts();
    expect(entries).toEqual([
      { key: "Ctrl/⌘ K", description: "Open command palette" },
      { key: "g v", description: "Go to Vaults" },
    ]);
  });
});
