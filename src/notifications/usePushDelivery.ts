/**
 * Bridges the in-app notification store to the OS notification centre.
 *
 * The hook is mounted once, in `Layout`, so exactly one subscriber owns
 * delivery for the whole app. It diffs the store for ids it has not acted on
 * yet, asks `decideDelivery` what to do with each one, shows the ones that
 * should be shown, and holds the rest in an in-memory queue until
 * `shouldFlushQueue` says the queue may be released as a single summary.
 *
 * Invariants
 * ----------
 * 1. Items that existed before the hook mounted are never delivered — the
 *    baseline is seeded on the first effect run. Reopening the app must not
 *    replay history onto the lock screen.
 * 2. An id is remembered *before* anything is shown, so a re-render (or React
 *    StrictMode's double-invoked effects) can never show it twice.
 * 3. Nothing is shown while the tab is visible: the in-app bell already covers
 *    that, and an OS banner over the focused tab is noise.
 * 4. The queue and `lastDigestAt` live in memory only. They are never written
 *    to localStorage, so a browser restart cannot resurrect a stale digest.
 * 5. Delivery failures are swallowed by `showDesktopNotification`; notifying is
 *    best-effort and must never become an app error.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotification, useNotificationPreferences } from '../Zustand/Store';
import {
  decideDelivery,
  getNotificationPermission,
  shouldFlushQueue,
  showDesktopNotification,
  summarizeQueue,
  type DeliveryPreferences,
} from './delivery';

/** How often a non-empty queue is re-evaluated for release. */
export const PUSH_DELIVERY_TICK_MS = 60 * 1000;

/** Upper bound on remembered ids, so the dedupe set cannot grow forever. */
export const MAX_TRACKED_NOTIFICATION_IDS = 200;

/** Route an OS notification opens when the user activates it. */
export const NOTIFICATIONS_ROUTE = '/notifications';

/** Fixed tag so a new digest replaces the previous one in the OS centre. */
export const DIGEST_NOTIFICATION_TAG = 'disciplr-notification-digest';

const DIGEST_BODY = 'Open Disciplr to review them.';

interface DeliveryItem {
  id: string;
  isRead: boolean;
  title: string;
  body: string;
}

interface QueuedItem extends DeliveryItem {
  queuedAt: number;
}

/**
 * Narrows an unknown store entry to what delivery needs. The store already
 * filters non-objects on write, but `setState` can be reached directly, so
 * every field is checked before use.
 */
function toDeliveryItem(value: unknown): DeliveryItem | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const { id, title, message } = record;
  if (typeof id !== 'string' || id.length === 0) return null;
  return {
    id,
    isRead: record.isRead === true,
    title: typeof title === 'string' && title.length > 0 ? title : 'Disciplr',
    body: typeof message === 'string' ? message : '',
  };
}

/** Latest preferences, read straight from the store so timer callbacks agree. */
function currentPreferences(): DeliveryPreferences {
  const { push, frequency, quietHours } = useNotificationPreferences.getState();
  // Quiet hours are stored as { enabled, start, end }. A disabled window maps to
  // an empty start, which isQuietHoursActive treats as "never quiet".
  return {
    push,
    frequency,
    quietHours: quietHours.enabled ? quietHours.start : "",
    quietHoursEnd: quietHours.end,
  };
}

/** A visible tab is handled by the in-app bell, so the OS is left alone. */
function isTabVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

/** Adds `id`, evicting the oldest entries once the bound is exceeded. */
function rememberBounded(ids: Set<string>, id: string): void {
  ids.add(id);
  while (ids.size > MAX_TRACKED_NOTIFICATION_IDS) {
    const oldest = ids.values().next().value;
    if (typeof oldest !== 'string') return;
    ids.delete(oldest);
  }
}

/**
 * Subscribes to the notification store and delivers OS notifications.
 * Mount once per app; call from a component inside the router.
 */
export function usePushDelivery(): void {
  const navigate = useNavigate();

  const notifications = useNotification((state) => state.notification);

  const handledIdsRef = useRef<Set<string>>(new Set());
  const baselineSeededRef = useRef(false);
  const queueRef = useRef<QueuedItem[]>([]);
  const queuedDuringQuietHoursRef = useRef(false);
  const lastDigestAtRef = useRef<number | null>(null);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const openNotifications = useCallback(() => {
    navigate(NOTIFICATIONS_ROUTE);
  }, [navigate]);

  const stopTicker = useCallback(() => {
    if (tickerRef.current === null) return;
    clearInterval(tickerRef.current);
    tickerRef.current = null;
  }, []);

  /**
   * Releases the queue as a single summary when the decision function allows
   * it. A visible tab consumes the queue silently: the user can already see
   * the unread badge, and a summary banner would be redundant.
   */
  const flushQueue = useCallback(() => {
    const queue = queueRef.current;
    if (queue.length === 0) {
      stopTicker();
      return;
    }

    const now = new Date();
    const releasable = shouldFlushQueue({
      queueLength: queue.length,
      queuedDuringQuietHours: queuedDuringQuietHoursRef.current,
      oldestQueuedAt: queue[0]?.queuedAt ?? null,
      prefs: currentPreferences(),
      permission: getNotificationPermission(),
      now,
      lastDigestAt: lastDigestAtRef.current,
    });
    if (!releasable) return;

    const count = queue.length;
    queueRef.current = [];
    queuedDuringQuietHoursRef.current = false;
    lastDigestAtRef.current = now.getTime();
    stopTicker();

    if (isTabVisible()) return;

    showDesktopNotification({
      title: summarizeQueue(count),
      body: DIGEST_BODY,
      tag: DIGEST_NOTIFICATION_TAG,
      onClick: openNotifications,
    });
  }, [openNotifications, stopTicker]);

  const startTicker = useCallback(() => {
    if (tickerRef.current !== null || typeof window === 'undefined') return;
    tickerRef.current = setInterval(flushQueue, PUSH_DELIVERY_TICK_MS);
  }, [flushQueue]);

  useEffect(() => {
    if (!Array.isArray(notifications)) return;

    const items = notifications
      .map(toDeliveryItem)
      .filter((item): item is DeliveryItem => item !== null);

    // First run establishes the baseline: everything already in the store is
    // history, not news, so it is marked handled without being delivered.
    if (!baselineSeededRef.current) {
      baselineSeededRef.current = true;
      for (const item of items) rememberBounded(handledIdsRef.current, item.id);
      return;
    }

    for (const item of items) {
      if (handledIdsRef.current.has(item.id)) continue;
      // Remember first: showing is not allowed to happen twice, whatever the
      // rest of this iteration does.
      rememberBounded(handledIdsRef.current, item.id);

      const decision = decideDelivery({
        item,
        prefs: currentPreferences(),
        permission: getNotificationPermission(),
        now: new Date(),
        lastDigestAt: lastDigestAtRef.current,
      });

      if (decision === 'suppress') continue;

      if (decision === 'queue') {
        queueRef.current.push({ ...item, queuedAt: Date.now() });
        continue;
      }

      if (isTabVisible()) continue;

      showDesktopNotification({
        title: item.title,
        body: item.body,
        tag: item.id,
        onClick: openNotifications,
      });
    }
  }, [notifications, openNotifications]);

  // Safety net: whenever a render leaves items queued, make sure the release
  // timer is running. `startTicker` is a no-op when it already is, so this
  // cannot stack intervals.
  useEffect(() => {
    if (queueRef.current.length > 0) startTicker();
  });

  useEffect(() => stopTicker, [stopTicker]);
}
