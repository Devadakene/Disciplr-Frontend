import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, beforeEach } from "vitest";
import NotificationBell from "../NotificationBell";
import { useNotification, type NotificationItem } from "@/Zustand/Store";

function resetStore(notificationItems: Partial<NotificationItem>[]) {
  useNotification.setState({
    notification: notificationItems as NotificationItem[],
  });
}

function renderNotificationBell() {
  return render(
    <MemoryRouter>
      <NotificationBell />
    </MemoryRouter>,
  );
}

describe("NotificationBell Component", () => {
  beforeEach(() => {
    // Clear notifications before each test
    resetStore([]);
  });

  it("renders correctly without crashing", () => {
    renderNotificationBell();
    const bellLink = screen.getByRole("link");
    expect(bellLink).toBeInTheDocument();
  });

  it("handles zero unread notifications (no badge, correct aria-label)", () => {
    resetStore([
      { id: "1", title: "Read Notification", message: "Hello", isRead: true },
      { id: "2", title: "Another Read Notification", message: "Hi", isRead: true },
    ]);
    renderNotificationBell();
    
    // No badge should be present
    expect(screen.queryByText(/[0-9]+/)).not.toBeInTheDocument();
    
    // Check accessible label includes unread count
    const bellLink = screen.getByRole("link");
    expect(bellLink).toHaveAttribute("aria-label", "Notifications, 0 unread");
  });

  it("handles non-zero unread notifications (renders badge, correct aria-label)", () => {
    resetStore([
      { id: "1", title: "Unread 1", message: "Hello", isRead: false },
      { id: "2", title: "Read 1", message: "Hi", isRead: true },
      { id: "3", title: "Unread 2", message: "Hey", isRead: false },
    ]);
    renderNotificationBell();

    // Badge should show "2"
    const badge = screen.getByText("2");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("notification-bell-badge");

    // Check accessible label includes unread count
    const bellLink = screen.getByRole("link");
    expect(bellLink).toHaveAttribute("aria-label", "Notifications, 2 unread");
  });

  it("treats notification as unread if the isRead flag is missing/absent", () => {
    resetStore([
      { id: "1", title: "Missing isRead", message: "Hello" }, // isRead is undefined
      { id: "2", title: "Explicitly Read", message: "Hi", isRead: true },
      { id: "3", title: "Explicitly Unread", message: "Hey", isRead: false },
    ]);
    renderNotificationBell();

    // Out of 3 notifications:
    // id 1: absent flag => unread (1)
    // id 2: read => read (0)
    // id 3: unread => unread (1)
    // Total unread: 2
    const badge = screen.getByText("2");
    expect(badge).toBeInTheDocument();

    const bellLink = screen.getByRole("link");
    expect(bellLink).toHaveAttribute("aria-label", "Notifications, 2 unread");
  });

  it("links to the correct /notifications route", () => {
    renderNotificationBell();
    const bellLink = screen.getByRole("link");
    expect(bellLink).toHaveAttribute("href", "/notifications");
  });
});
