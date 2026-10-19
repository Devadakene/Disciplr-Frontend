import { SiInternetarchive } from "react-icons/si";
import { HiOutlineCheckBadge } from "react-icons/hi2";
import { FiAlertTriangle, FiRefreshCw } from "react-icons/fi";
import { FaSquareArrowUpRight, FaUserCheck } from "react-icons/fa6";
import { IoMegaphoneOutline } from "react-icons/io5";
import { CiBellOn } from "react-icons/ci";
import { IconType } from "react-icons";

export type NotificationTypeKey =
  | "vault_created_successfully"
  | "milestone_validated"
  | "vault_deadline_approaching"
  | "funds_released"
  | "funds_redirected"
  | "verification_requested"
  | "system_announcement";

export interface NotificationTypeMapping {
  icon: IconType;
  /** CSS color value (hex, named, or a CSS variable reference) */
  color: string;
  /** Accessible screen-reader label for this notification category */
  label: string;
}

const FALLBACK_MAPPING: NotificationTypeMapping = {
  icon: CiBellOn,
  color: "var(--muted)",
  label: "Notification",
};

const NOTIFICATION_TYPE_MAP: Record<NotificationTypeKey, NotificationTypeMapping> = {
  vault_created_successfully: {
    icon: SiInternetarchive,
    color: "var(--muted)",
    label: "Vault created successfully",
  },
  milestone_validated: {
    icon: HiOutlineCheckBadge,
    color: "var(--warning)",
    label: "Milestone validated",
  },
  vault_deadline_approaching: {
    icon: FiAlertTriangle,
    color: "var(--danger)",
    label: "Vault deadline approaching",
  },
  funds_released: {
    icon: FaSquareArrowUpRight,
    color: "var(--success)",
    label: "Funds released",
  },
  funds_redirected: {
    icon: FiRefreshCw,
    color: "var(--accent)",
    label: "Funds redirected",
  },
  verification_requested: {
    icon: FaUserCheck,
    color: "var(--accent)",
    label: "Verification requested",
  },
  system_announcement: {
    icon: IoMegaphoneOutline,
    color: "var(--muted)",
    label: "System announcement",
  },
};

/**
 * Returns the icon, color, and accessible label for a given notification type.
 * Falls back to a safe default for any unknown or missing type.
 */
export function getNotificationTypeMapping(type: string): NotificationTypeMapping {
  return (
    NOTIFICATION_TYPE_MAP[type as NotificationTypeKey] ?? FALLBACK_MAPPING
  );
}

export { FALLBACK_MAPPING, NOTIFICATION_TYPE_MAP };
