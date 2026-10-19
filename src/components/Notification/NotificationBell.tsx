import { Bell } from "lucide-react";
import { useUnreadCount } from "@/Zustand/Store";
import NavLink from "../NavLink";
import "./NotificationBell.css";

export default function NotificationBell() {
  const unreadCount = useUnreadCount();

  const hasUnread = unreadCount > 0;
  
  // Accessible label: always includes the unread count
  const ariaLabel = `Notifications, ${unreadCount} unread`;

  return (
    <NavLink
      to="/notifications"
      className="notification-bell-link"
      ariaLabel={ariaLabel}
      title={ariaLabel}
    >
      <div className="notification-bell-icon-wrapper">
        <Bell className="notification-bell-icon" size={20} aria-hidden="true" />
        {hasUnread && (
          <span className="notification-bell-badge" aria-hidden="true">
            {unreadCount}
          </span>
        )}
      </div>
    </NavLink>
  );
}
