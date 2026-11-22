import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NotificationSettings from "../NotificationSettings";
import { useNotificationPreferences } from "@/Zustand/Store";
import { DEMO_ADDRESS } from "../../context/WalletContext";

vi.mock("../../services/vaultService", () => ({ listVaults: vi.fn(() => Promise.resolve([])) }));
vi.mock("../../context/WalletContext", async () => {
  const actual = await vi.importActual<typeof import("../../context/WalletContext")>("../../context/WalletContext");
  return { ...actual, useWallet: () => ({ address: DEMO_ADDRESS }) };
});

/**
 * Only the static permission surface is needed here: the settings page asks the
 * browser for permission but never constructs a notification itself.
 */
class FakeNotification {
  static permission: string = "default";
  static requestPermission = vi.fn(() => Promise.resolve("denied"));
}

function installNotificationStub(permission: string, response: string) {
  FakeNotification.permission = permission;
  FakeNotification.requestPermission = vi.fn(() => Promise.resolve(response));
  (window as any).Notification = FakeNotification;
}

function removeNotificationApi() {
  Object.defineProperty(window, "Notification", {
    configurable: true,
    writable: true,
    value: undefined,
  });
}

const pushSwitch = () =>
  screen.getByRole("switch", { name: "Push Notification" });

describe("NotificationSettings push permission flow", () => {
  beforeEach(() => {
    useNotificationPreferences.setState({
      email: true,
      push: false,
      frequency: "1",
      quietHours: { enabled: false, start: "22:00", end: "07:00" },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("asks for permission exactly once and keeps the switch on when granted", async () => {
    installNotificationStub("default", "granted");
    render(<NotificationSettings />);

    expect(pushSwitch()).toHaveAttribute("aria-checked", "false");
    fireEvent.click(pushSwitch());

    await waitFor(() =>
      expect(pushSwitch()).toHaveAttribute("aria-checked", "true"),
    );

    expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1);
    expect(useNotificationPreferences.getState().push).toBe(true);
    expect(screen.queryByTestId("push-notification-hint")).not.toBeInTheDocument();
  });

  it("reverts the switch and explains how to re-enable when permission is denied", async () => {
    installNotificationStub("default", "denied");
    render(<NotificationSettings />);

    fireEvent.click(pushSwitch());

    await waitFor(() =>
      expect(screen.getByTestId("push-notification-hint")).toBeInTheDocument(),
    );

    expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1);
    expect(pushSwitch()).toHaveAttribute("aria-checked", "false");
    expect(useNotificationPreferences.getState().push).toBe(false);
    expect(screen.getByTestId("push-notification-hint")).toHaveTextContent(
      /blocked for this site/i,
    );
  });

  it("disables the switch with an explanation when the browser has no Notification API", () => {
    removeNotificationApi();
    render(<NotificationSettings />);

    expect(pushSwitch()).toBeDisabled();
    expect(screen.getByTestId("push-notification-hint")).toHaveTextContent(
      /does not support desktop notifications/i,
    );

    fireEvent.click(pushSwitch());
    expect(useNotificationPreferences.getState().push).toBe(false);
  });
});
