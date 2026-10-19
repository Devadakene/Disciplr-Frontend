/**
 * groupNotifications.ts
 *
 * Pure, timezone-stable utility for grouping notification items
 * under "Today", "Yesterday", and "Earlier" date buckets.
 */

export type DateBucket = 'Today' | 'Yesterday' | 'Earlier';

export interface NotificationGroup<T> {
  bucket: DateBucket;
  items: T[];
}

/**
 * Determine the date bucket for a given ISO timestamp relative to `now`.
 *
 * Comparison is done in local calendar days (year/month/date) so the
 * bucketing is stable across midnight boundaries regardless of timezone.
 */
export function dateBucket(timestamp: string, now: Date): DateBucket {
  const itemDate = new Date(timestamp);
  const itemDay = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffMs = today.getTime() - itemDay.getTime();
  if (diffMs === 0) return 'Today';
  if (diffMs === 86400000) return 'Yesterday';
  return 'Earlier';
}

const BUCKET_ORDER: DateBucket[] = ['Today', 'Yesterday', 'Earlier'];

/**
 * Group notification items by date bucket relative to `now`.
 *
 * - Items within each group preserve their original order (stable).
 * - Groups are returned in the canonical order: Today → Yesterday → Earlier.
 * - Empty groups are omitted.
 *
 * @param items - Array of items that each have a `timestamp` ISO string.
 * @param now - Reference time; defaults to `new Date()`.
 */
export function groupNotificationsByDate<T extends { timestamp: string }>(
  items: T[],
  now: Date = new Date(),
): NotificationGroup<T>[] {
  const buckets = new Map<DateBucket, T[]>();

  for (const item of items) {
    const bucket = dateBucket(item.timestamp, now);
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket)!.push(item);
  }

  return BUCKET_ORDER
    .filter((b) => buckets.has(b))
    .map((bucket) => ({ bucket, items: buckets.get(bucket)! }));
}