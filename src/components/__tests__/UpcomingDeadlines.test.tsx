import React from "react";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import UpcomingDeadlines from "../UpcomingDeadlines";
import type { Deadline } from "../../utils/dashboard";
import type { Vault } from "../../types/vault";
import * as icsUtils from "../../utils/ics";

const fixedNow = new Date("2026-06-18T12:00:00Z");

const deadlines: Deadline[] = [
  {
    id: "safe",
    name: "Safe Vault",
    deadline: "2026-06-28T12:00:00Z",
    amount: 9000,
  },
  {
    id: "expired",
    name: "Expired Vault",
    deadline: "2026-06-18T11:00:00Z",
    amount: 1200,
  },
  {
    id: "soon",
    name: "Soon Vault",
    deadline: "2026-06-21T12:00:00Z",
    amount: 3500,
  },
  {
    id: "critical",
    name: "Critical Vault",
    deadline: "2026-06-18T18:00:00Z",
    amount: 800,
  },
];

describe("UpcomingDeadlines", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("sorts deadlines by remaining time ascending including expired first", () => {
    render(<UpcomingDeadlines deadlines={deadlines} />);

    const items = screen.getAllByTestId(/upcoming-deadline-/);
    expect(items).toHaveLength(4);
    expect(within(items[0]).getByText("Expired Vault")).toBeInTheDocument();
    expect(within(items[1]).getByText("Critical Vault")).toBeInTheDocument();
    expect(within(items[2]).getByText("Soon Vault")).toBeInTheDocument();
    expect(within(items[3]).getByText("Safe Vault")).toBeInTheDocument();
  });

  it("uses urgency token colors for critical, soon, safe, and expired rows", () => {
    render(<UpcomingDeadlines deadlines={deadlines} />);

    expect(screen.getByTestId("upcoming-deadline-critical")).toHaveAttribute(
      "style",
      expect.stringContaining("border-left: 3px solid var(--danger);"),
    );
    expect(screen.getByTestId("upcoming-deadline-soon")).toHaveAttribute(
      "style",
      expect.stringContaining("border-left: 3px solid var(--warning);"),
    );
    expect(screen.getByTestId("upcoming-deadline-safe")).toHaveAttribute(
      "style",
      expect.stringContaining("border-left: 3px solid var(--success);"),
    );
    expect(screen.getByTestId("upcoming-deadline-expired")).toHaveAttribute(
      "style",
      expect.stringContaining("border-left: 3px solid var(--danger);"),
    );
  });

  it("renders CountdownDeadline output for each row", () => {
    render(<UpcomingDeadlines deadlines={deadlines} />);

    expect(screen.getByLabelText(/Deadline .* Overdue/)).toBeInTheDocument();
    expect(screen.getByText("6h 0m remaining")).toBeInTheDocument();
    expect(screen.getByText("3d 0h remaining")).toBeInTheDocument();
    expect(screen.getByText("10d 0h remaining")).toBeInTheDocument();
  });

  it("renders invalid deadlines last with a neutral label", () => {
    render(
      <UpcomingDeadlines
        deadlines={[
          ...deadlines,
          {
            id: "invalid",
            name: "Invalid Vault",
            deadline: "not-a-date",
            amount: 100,
          },
        ]}
      />,
    );

    const items = screen.getAllByTestId(/upcoming-deadline-/);
    expect(
      within(items[items.length - 1]).getByText("Invalid Vault"),
    ).toBeInTheDocument();
    expect(
      within(items[items.length - 1]).getByText("Invalid"),
    ).toBeInTheDocument();
    expect(
      within(items[items.length - 1]).getByText("Invalid deadline"),
    ).toBeInTheDocument();
  });

  it("shows an empty state when there are no deadlines", () => {
    render(<UpcomingDeadlines deadlines={[]} />);

    expect(screen.getByText("No upcoming deadlines.")).toBeInTheDocument();
  });

  describe("Calendar export actions", () => {
    it("disables the export-all button when there are no deadlines", () => {
      render(<UpcomingDeadlines deadlines={[]} />);

      const exportAllBtn = screen.getByRole("button", {
        name: /Export all deadlines \(\.ics\)/i,
      });
      expect(exportAllBtn).toBeDisabled();
    });

    it("enables the export-all button when deadlines are available", () => {
      render(<UpcomingDeadlines deadlines={deadlines} />);

      const exportAllBtn = screen.getByRole("button", {
        name: /Export all deadlines \(\.ics\)/i,
      });
      expect(exportAllBtn).not.toBeDisabled();
    });

    it("calls downloadIcsCalendar with all deadlines when export-all is clicked", () => {
      const downloadSpy = vi
        .spyOn(icsUtils, "downloadIcsCalendar")
        .mockReturnValue(true);

      render(<UpcomingDeadlines deadlines={deadlines} />);

      const exportAllBtn = screen.getByRole("button", {
        name: /Export all deadlines \(\.ics\)/i,
      });
      fireEvent.click(exportAllBtn);

      expect(downloadSpy).toHaveBeenCalledTimes(1);
      const [events, filename, options] = downloadSpy.mock.calls[0];
      expect(events).toHaveLength(4);
      expect(filename).toBe("disciplr-all-deadlines.ics");
      expect(options?.alarms).toBe("both");
      expect(options?.calendarName).toBe("Disciplr deadlines");

      // Verify UIDs contain @disciplr.app and use vaultDeadlineUid format
      expect(events[0].uid).toBe("vault-safe@disciplr.app");
      expect(events[1].uid).toBe("vault-expired@disciplr.app");
    });

    it("bundles every active vault when vaults prop is provided", () => {
      const downloadSpy = vi
        .spyOn(icsUtils, "downloadIcsCalendar")
        .mockReturnValue(true);

      const mockVaults: Vault[] = [
        {
          id: "v-active-1",
          name: "Active Vault 1",
          status: "active",
          amount: 5000,
          currency: "USDC",
          createdAt: "2026-01-01T00:00:00Z",
          deadline: "2026-07-01T00:00:00Z",
          creatorAddress: "G1",
          successAddress: "G2",
          failureAddress: "G3",
          contractAddress: "C1",
          milestones: [],
          transactions: [],
        },
        {
          id: "v-pending-2",
          name: "Pending Vault 2",
          status: "pending_validation",
          amount: 10000,
          currency: "USDC",
          createdAt: "2026-01-01T00:00:00Z",
          deadline: "2026-08-01T00:00:00Z",
          creatorAddress: "G1",
          successAddress: "G2",
          failureAddress: "G3",
          contractAddress: "C2",
          milestones: [],
          transactions: [],
        },
        {
          id: "v-completed-3",
          name: "Completed Vault 3",
          status: "completed",
          amount: 20000,
          currency: "USDC",
          createdAt: "2026-01-01T00:00:00Z",
          deadline: "2026-05-01T00:00:00Z",
          creatorAddress: "G1",
          successAddress: "G2",
          failureAddress: "G3",
          contractAddress: "C3",
          milestones: [],
          transactions: [],
        },
      ];

      render(<UpcomingDeadlines deadlines={deadlines} vaults={mockVaults} />);

      const exportAllBtn = screen.getByRole("button", {
        name: /Export all deadlines \(\.ics\)/i,
      });
      fireEvent.click(exportAllBtn);

      expect(downloadSpy).toHaveBeenCalledTimes(1);
      const [events] = downloadSpy.mock.calls[0];

      // Only the 2 active/pending vaults are bundled, completed is excluded
      expect(events).toHaveLength(2);
      expect(events[0].title).toBe("Active Vault 1 deadline");
      expect(events[0].uid).toBe("vault-v-active-1@disciplr.app");
      expect(events[1].title).toBe("Pending Vault 2 deadline");
      expect(events[1].uid).toBe("vault-v-pending-2@disciplr.app");
    });

    it("respects the selected alarm preference", () => {
      const downloadSpy = vi
        .spyOn(icsUtils, "downloadIcsCalendar")
        .mockReturnValue(true);

      render(<UpcomingDeadlines deadlines={deadlines} />);

      const alarmSelect = screen.getByLabelText(/Alarm preference/i);
      fireEvent.change(alarmSelect, { target: { value: "1hour" } });

      const exportAllBtn = screen.getByRole("button", {
        name: /Export all deadlines \(\.ics\)/i,
      });
      fireEvent.click(exportAllBtn);

      expect(downloadSpy).toHaveBeenCalledTimes(1);
      const [, , options] = downloadSpy.mock.calls[0];
      expect(options?.alarms).toBe("1hour");
    });

    it("exports an individual vault deadline with identical UID helper format", () => {
      const downloadEventSpy = vi
        .spyOn(icsUtils, "downloadIcsEvent")
        .mockReturnValue(true);

      render(<UpcomingDeadlines deadlines={deadlines} />);

      const individualBtn = screen.getByLabelText(
        "Export Safe Vault deadline to calendar"
      );
      fireEvent.click(individualBtn);

      expect(downloadEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Safe Vault deadline",
          deadline: "2026-06-28T12:00:00Z",
          uid: "vault-safe@disciplr.app",
        })
      );
    });
  });
});
