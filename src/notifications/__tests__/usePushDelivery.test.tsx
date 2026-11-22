import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePushDelivery, PUSH_DELIVERY_TICK_MS } from "../usePushDelivery";
import {
  useNotification,
  useNotificationPreferences,
  type NotificationItem,
} from "@/Zustand/Store";

/** Minimal stand-in for the browser Notification API. */
class FakeNotification {
  static permission: string = "granted";
  static requestPermission = vi.fn(() => Promise.resolve("granted"));
  static instances: FakeNotification[] = [];

  onclick: (() => void) | null = null;
  readonly title: string;
  readonly options?: NotificationOptions;

  constructor(title: string, options?: NotificationOptions) {
    this.title = title;
    this.options = options;
    FakeNotification.instances.push(this);
  }

  close() {
    // no-op
  }
}

function installNotificationStub(permission: string = "granted") {
  FakeNotification.permission = permission;
  FakeNotification.requestPermission = vi.fn(() => Promise.resolve(permission));
  FakeNotification.instances = [];
  (window as any).Notification = FakeNotification;
}

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

const shownTags = () => FakeNotification.instances.map((n) => n.options?.tag);

function item(id: string, over: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id,
    type: "vault_deadline_approaching",
    isUrgent: false,
    title: `Title ${id}`,
    message: `Message ${id}`,
    timestamp: "2026-04-24T08:00:00Z",
    isRead: false,
    category: "vault",
    ...over,
  } as NotificationItem;
}

/** Mounts the hook and exposes the current route so navigation is observable. */
function PushDeliveryHost() {
  usePushDelivery();
  const location = useLocation();
  return <div data-testid="pathname">{location.pathname}</div>;
}

function renderHost() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <PushDeliveryHost />
    </MemoryRouter>,
  );
}

function publish(items: NotificationItem[]) {
  act(() => {
    useNotification.setState({ notification: items });
  });
}

describe("usePushDelivery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Noon local time, outside the 22:00-07:00 quiet window.
    vi.setSystemTime(new Date(2026, 0, 15, 12, 0));
    installNotificationStub();
    setVisibility("hidden");
    useNotification.setState({ notification: [] });
    useNotificationPreferences.setState({
      push: true,
      frequency: "1",
      quietHours: { enabled: true, start: "22:00", end: "07:00" },
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("never delivers notifications that already existed at mount time", () => {
    useNotification.setState({ notification: [item("ntf_001"), item("ntf_002")] });

    renderHost();

    expect(FakeNotification.instances).toHaveLength(0);
  });

  it("shows one OS notification tagged with the notification id while hidden", () => {
    renderHost();

    publish([item("ntf_010")]);

    expect(FakeNotification.instances).toHaveLength(1);
    expect(FakeNotification.instances[0].title).toBe("Title ntf_010");
    expect(FakeNotification.instances[0].options?.body).toBe("Message ntf_010");
    expect(FakeNotification.instances[0].options?.tag).toBe("ntf_010");
  });

  it("does not show anything while the tab is visible, and does not replay it later", () => {
    setVisibility("visible");
    renderHost();

    publish([item("ntf_011")]);
    expect(FakeNotification.instances).toHaveLength(0);

    // The in-app bell covered it, so it must not surface as a stale banner.
    setVisibility("hidden");
    act(() => {
      vi.advanceTimersByTime(PUSH_DELIVERY_TICK_MS * 5);
    });
    expect(FakeNotification.instances).toHaveLength(0);
  });

  it("never shows the same id twice", () => {
    renderHost();

    publish([item("ntf_012")]);
    publish([item("ntf_012")]);
    publish([item("ntf_012"), item("ntf_013")]);

    expect(shownTags()).toEqual(["ntf_012", "ntf_013"]);
  });

  it("never shows an already-read notification", () => {
    renderHost();

    publish([item("ntf_014", { isRead: true })]);

    expect(FakeNotification.instances).toHaveLength(0);
  });

  it("never shows anything when the frequency is Never", () => {
    useNotificationPreferences.setState({ frequency: "4" });
    renderHost();

    publish([item("ntf_015")]);

    expect(FakeNotification.instances).toHaveLength(0);
  });

  it("suppresses delivery when the push switch is off or permission is missing", () => {
    useNotificationPreferences.setState({ push: false });
    renderHost();
    publish([item("ntf_016")]);
    expect(FakeNotification.instances).toHaveLength(0);
  });

  it("holds notifications through quiet hours and releases one summary at the end", () => {
    vi.setSystemTime(new Date(2026, 0, 15, 23, 0));
    renderHost();

    publish([item("ntf_020"), item("ntf_021"), item("ntf_022")]);
    expect(FakeNotification.instances).toHaveLength(0);

    // Still inside the window: nothing escapes.
    act(() => {
      vi.advanceTimersByTime(PUSH_DELIVERY_TICK_MS);
    });
    expect(FakeNotification.instances).toHaveLength(0);

    // Cross the 07:00 boundary.
    vi.setSystemTime(new Date(2026, 0, 16, 7, 1));
    act(() => {
      vi.advanceTimersByTime(PUSH_DELIVERY_TICK_MS);
    });

    expect(FakeNotification.instances).toHaveLength(1);
    expect(FakeNotification.instances[0].title).toBe("3 updates while you were away");
  });

  it("batches daily-frequency items into one digest per period", () => {
    useNotificationPreferences.setState({ frequency: "2" });
    renderHost();

    publish([item("ntf_030")]);
    expect(FakeNotification.instances).toHaveLength(0);

    // Before the period elapses the digest is withheld.
    act(() => {
      vi.advanceTimersByTime(PUSH_DELIVERY_TICK_MS * 10);
    });
    expect(FakeNotification.instances).toHaveLength(0);

    vi.setSystemTime(new Date(2026, 0, 16, 12, 1));
    act(() => {
      vi.advanceTimersByTime(PUSH_DELIVERY_TICK_MS);
    });

    expect(FakeNotification.instances).toHaveLength(1);
    expect(FakeNotification.instances[0].title).toBe("1 update while you were away");
  });

  it("focuses the tab and navigates when an OS notification is activated", () => {
    const focusSpy = vi.spyOn(window, "focus").mockImplementation(() => {});
    renderHost();

    publish([item("ntf_040")]);
    expect(FakeNotification.instances).toHaveLength(1);

    act(() => {
      FakeNotification.instances[0].onclick?.();
    });

    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("pathname")).toHaveTextContent("/notifications");
  });
});
