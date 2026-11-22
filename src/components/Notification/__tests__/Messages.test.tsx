import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Message from "../Messages";

const defaultProps = {
  id: "n1",
  type: "vault_created_successfully",
  title: "Vault Created",
  message: "Short message",
  timestamp: new Date(Date.now() - 60_000).toISOString(),
  read: false,
  isFullPage: false,
  setRead: vi.fn(),
  onDismiss: vi.fn(),
};

describe("Message", () => {
  describe("message preview truncation", () => {
    it("truncates messages longer than 30 characters with ellipsis", () => {
      const longMessage = "a".repeat(31);
      render(<Message {...defaultProps} message={longMessage} />);

      expect(screen.getByText(`${"a".repeat(30)}...`)).toBeInTheDocument();
    });

    it("leaves messages of 30 characters or fewer untouched", () => {
      const exactMessage = "a".repeat(30);
      const { rerender } = render(
        <Message {...defaultProps} message={exactMessage} />,
      );

      expect(screen.getByText(exactMessage)).toBeInTheDocument();

      rerender(<Message {...defaultProps} message="Short message" />);
      expect(screen.getByText("Short message")).toBeInTheDocument();
    });

    it("handles non-string hostile message props safely", () => {
      const { container } = render(
        <Message {...defaultProps} message={null as never} />,
      );

      const preview = container.querySelector("p.text-sm.text-\\[\\#667589\\]");
      expect(preview).toHaveTextContent("");
    });
  });

  describe("title fallback", () => {
    it("shows Untitled notification for blank or whitespace-only titles", () => {
      const { rerender } = render(<Message {...defaultProps} title=" " />);
      expect(screen.getByText("Untitled notification")).toBeInTheDocument();

      rerender(<Message {...defaultProps} title="" />);
      expect(screen.getByText("Untitled notification")).toBeInTheDocument();
    });

    it("shows Untitled notification for non-string hostile title props", () => {
      const { rerender } = render(
        <Message {...defaultProps} title={undefined as never} />,
      );
      expect(screen.getByText("Untitled notification")).toBeInTheDocument();

      rerender(<Message {...defaultProps} title={123 as never} />);
      expect(screen.getByText("Untitled notification")).toBeInTheDocument();
    });

    it("renders a valid title as provided", () => {
      render(<Message {...defaultProps} title="Milestone Validated" />);
      expect(screen.getByText("Milestone Validated")).toBeInTheDocument();
    });
  });

  describe("opening and marking as read", () => {
    it("calls setRead(id) once and opens full message modal when clicked", () => {
      const setRead = vi.fn();
      const longMessage = "b".repeat(40);
      render(
        <Message
          {...defaultProps}
          id="n1"
          message={longMessage}
          setRead={setRead}
        />,
      );

      fireEvent.click(screen.getByText("Vault Created"));

      expect(setRead).toHaveBeenCalledTimes(1);
      expect(setRead).toHaveBeenCalledWith("n1");
      expect(screen.getByText(longMessage)).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Close message" }));
      expect(screen.queryByText(longMessage)).not.toBeInTheDocument();
    });

    it("does not call setRead or open modal when id is empty", () => {
      const setRead = vi.fn();
      render(<Message {...defaultProps} id="" setRead={setRead} />);

      fireEvent.click(screen.getByText("Vault Created"));

      expect(setRead).not.toHaveBeenCalled();
      expect(
        screen.queryByRole("button", { name: "Close message" }),
      ).not.toBeInTheDocument();
    });

    it("does not call setRead or open modal when id is a non-string hostile value", () => {
      const setRead = vi.fn();
      render(<Message {...defaultProps} id={null as never} setRead={setRead} />);

      fireEvent.click(screen.getByText("Vault Created"));

      expect(setRead).not.toHaveBeenCalled();
      expect(
        screen.queryByRole("button", { name: "Close message" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("notification type fallback", () => {
    it("falls back to the Notification label for unknown types", () => {
      render(<Message {...defaultProps} type="unknown_event_type" />);

      expect(
        screen.getByRole("img", { name: "Notification" }),
      ).toBeInTheDocument();
    });

    it("falls back to the Notification label for hostile non-string types", () => {
      render(<Message {...defaultProps} type={undefined as never} />);

      expect(
        screen.getByRole("img", { name: "Notification" }),
      ).toBeInTheDocument();
    });

    it("uses the mapped label for known notification types", () => {
      render(<Message {...defaultProps} type="funds_released" />);

      expect(
        screen.getByRole("img", { name: "Funds released" }),
      ).toBeInTheDocument();
    });
  });

  describe("dismiss action", () => {
    it("calls onDismiss(id) when Delete is clicked in full-page mode", () => {
      const onDismiss = vi.fn();
      render(
        <Message
          {...defaultProps}
          id="n1"
          isFullPage={true}
          onDismiss={onDismiss}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Delete" }));

      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(onDismiss).toHaveBeenCalledWith("n1");
    });

    it("does not render Delete button when isFullPage is false", () => {
      render(<Message {...defaultProps} isFullPage={false} />);

      expect(
        screen.queryByRole("button", { name: "Delete" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("timestamp handling", () => {
    it("renders no time text for blank or non-string timestamps", () => {
      const { rerender } = render(<Message {...defaultProps} timestamp="" />);
      expect(screen.getByTestId("message-time-ago")).toHaveTextContent("");

      rerender(<Message {...defaultProps} timestamp="   " />);
      expect(screen.getByTestId("message-time-ago")).toHaveTextContent("");

      rerender(<Message {...defaultProps} timestamp={null as never} />);
      expect(screen.getByTestId("message-time-ago")).toHaveTextContent("");

      rerender(<Message {...defaultProps} timestamp={12345 as never} />);
      expect(screen.getByTestId("message-time-ago")).toHaveTextContent("");
    });

    it("renders relative time text for a valid timestamp", () => {
      render(
        <Message
          {...defaultProps}
          timestamp={new Date(Date.now() - 5 * 60_000).toISOString()}
        />,
      );

      expect(screen.getByTestId("message-time-ago").textContent).toBeTruthy();
    });
  });

  describe("read state badge", () => {
    it("shows New badge when unread and hides it when read", () => {
      const { rerender } = render(<Message {...defaultProps} read={false} />);
      expect(screen.getByText("New")).toBeInTheDocument();

      rerender(<Message {...defaultProps} read={true} />);
      expect(screen.queryByText("New")).not.toBeInTheDocument();
    });
  });
});
