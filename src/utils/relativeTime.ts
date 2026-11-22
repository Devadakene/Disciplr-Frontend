import { formatRelative } from "./format";

/**
 * formatRelativeTime - Format a date as a relative time string (e.g., "2 hours ago")
 *
 * Uses Intl.RelativeTimeFormat for localized, human-readable time differences.
 * Handles seconds, minutes, hours, days, and weeks. Supports both past and future dates.
 *
 * @param date - The date to format (Date object, ISO string, or timestamp)
 * @param now - Optional reference time for testing (defaults to current time)
 * @returns A localized relative time string (e.g., "2 hours ago", "in 3 days")
 */
export function formatRelativeTime(
  date: Date | string | number,
  now: number = Date.now(),
): string {
  const result = formatRelative(date, now);
  if (result === "—") {
    return "Invalid date";
  }
  return result;
}

