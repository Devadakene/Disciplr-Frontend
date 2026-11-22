/**
 * Push delivery decisions.
 *
 * The settings page advertises push notifications, but a preference toggle on
 * its own cannot deliver anything: something has to decide *whether* a given
 * notification becomes an OS notification, and *when*. That decision is the
 * whole of this module and is deliberately pure — `now` is always passed in,
 * nothing is read from the clock or from storage here — so it can be exhaustively
 * table-tested.
 *
 * The module also owns the two browser-facing pieces the delivery contract needs
 * (permission + constructing the notification). They only touch `window` inside
 * their bodies, so importing this module is safe outside a browser.
 *
 * Invariants
 * ----------
 * 1. Nothing is shown unless push is enabled *and* permission is granted.
 * 2. Quiet hours never drop a notification; they defer it (see `shouldFlushQueue`).
 * 3. Frequency "4" (Never) suppresses outright.
 * 4. Already-read items are never shown.
 * 5. No function here throws — a failure to notify must not become an app error.
 */
import { isQuietHoursActive, DEFAULT_QUIET_HOURS_END } from '../utils/quietHours';

export type DeliveryDecision = 'show' | 'suppress' | 'queue';

/** The four values the frequency <select> offers. */
export const DELIVERY_FREQUENCIES = ['1', '2', '3', '4'] as const;
export type DeliveryFrequency = (typeof DELIVERY_FREQUENCIES)[number];

/** Frequency used when the stored value is missing or unrecognised. */
export const DEFAULT_FREQUENCY: DeliveryFrequency = '1';

/** Frequency "2" (daily) and "3" (weekly) batch into a digest. */
export const DIGEST_PERIOD_MS: Record<'2' | '3', number> = {
  '2': 24 * 60 * 60 * 1000,
  '3': 7 * 24 * 60 * 60 * 1000,
};

export type NotificationPermissionState =
  | 'granted'
  | 'denied'
  | 'default'
  | 'unsupported';

export interface DeliveryPreferences {
  /** Master switch stored in notificationPreferences. */
  push: boolean;
  /** "1" occurrence / "2" daily / "3" weekly / "4" never. */
  frequency: string;
  /** Quiet-hours start, "HH:MM". */
  quietHours: string;
  /** Quiet-hours end, "HH:MM". Defaults to DEFAULT_QUIET_HOURS_END. */
  quietHoursEnd?: string;
}

export interface DeliveryCandidate {
  id: string;
  isRead: boolean;
}

export interface DecideDeliveryInput {
  item: DeliveryCandidate;
  prefs: DeliveryPreferences;
  permission: NotificationPermissionState;
  now: Date;
  /**
   * Epoch ms of the last digest released. Part of the delivery context but not
   * consulted here: a queued item is always queued — `shouldFlushQueue` is what
   * decides when the queue is released.
   */
  lastDigestAt: number | null;
}

export interface DecideFlushInput {
  /** Number of items waiting in the queue. */
  queueLength: number;
  /** True when at least one queued item was held back by quiet hours. */
  queuedDuringQuietHours: boolean;
  /** Epoch ms of the oldest queued item, or null when the queue is empty. */
  oldestQueuedAt: number | null;
  prefs: DeliveryPreferences;
  permission: NotificationPermissionState;
  now: Date;
  lastDigestAt: number | null;
}

/** Coerces a stored frequency to a known value, defaulting to "1". */
export function normalizeFrequency(value: unknown): DeliveryFrequency {
  return typeof value === 'string' &&
    (DELIVERY_FREQUENCIES as readonly string[]).includes(value)
    ? (value as DeliveryFrequency)
    : DEFAULT_FREQUENCY;
}

function quietWindow(prefs: DeliveryPreferences): [string, string] {
  return [prefs.quietHours, prefs.quietHoursEnd ?? DEFAULT_QUIET_HOURS_END];
}

/** True while `now` falls inside the configured quiet-hours window. */
export function isWithinQuietHours(
  prefs: DeliveryPreferences,
  now: Date,
): boolean {
  const [start, end] = quietWindow(prefs);
  return isQuietHoursActive(now, start, end);
}

/**
 * What to do with a single notification the moment it appears.
 *
 * Order matters and is asserted by the tests: the master switch and permission
 * are checked before anything else, then "Never", then whether the item was
 * already read, then quiet hours, and only then the frequency.
 */
export function decideDelivery(input: DecideDeliveryInput): DeliveryDecision {
  const { item, prefs, permission, now } = input;

  if (!prefs.push) return 'suppress';
  if (permission !== 'granted') return 'suppress';

  const frequency = normalizeFrequency(prefs.frequency);
  if (frequency === '4') return 'suppress';

  // A read (or previously dismissed) item must never re-surface on the OS.
  if (item.isRead) return 'suppress';

  // Quiet hours defer rather than drop, so nothing is lost overnight.
  if (isWithinQuietHours(prefs, now)) return 'queue';

  return frequency === '1' ? 'show' : 'queue';
}

/**
 * Whether the queued items should now be released as a single summary.
 *
 * Two things release the queue: quiet hours ending (the collapsed "while you
 * were away" summary) and a digest period elapsing for the daily/weekly
 * frequencies. Occurrence-frequency items only ever queue because of quiet
 * hours, so they release as soon as the window closes.
 */
export function shouldFlushQueue(input: DecideFlushInput): boolean {
  const {
    queueLength,
    queuedDuringQuietHours,
    oldestQueuedAt,
    prefs,
    permission,
    now,
    lastDigestAt,
  } = input;

  if (queueLength <= 0) return false;
  if (!prefs.push) return false;
  if (permission !== 'granted') return false;

  const frequency = normalizeFrequency(prefs.frequency);
  if (frequency === '4') return false;

  if (isWithinQuietHours(prefs, now)) return false;

  if (frequency === '1') return true;

  // Digest frequencies: items held back by quiet hours are released the moment
  // the window closes; otherwise the digest waits out its period.
  if (queuedDuringQuietHours) return true;

  const anchor = lastDigestAt ?? oldestQueuedAt;
  if (anchor === null) return true;
  return now.getTime() - anchor >= DIGEST_PERIOD_MS[frequency];
}

/** Body of the collapsed summary shown when the queue is released. */
export function summarizeQueue(count: number): string {
  return `${count} update${count === 1 ? '' : 's'} while you were away`;
}

/** Whether this browser can display notifications at all. */
export function isNotificationSupported(): boolean {
  return (
    typeof window !== 'undefined' && typeof window.Notification === 'function'
  );
}

/** Current permission, normalised to `NotificationPermissionState`. */
export function getNotificationPermission(): NotificationPermissionState {
  if (!isNotificationSupported()) return 'unsupported';
  const permission = window.Notification.permission;
  return permission === 'granted' || permission === 'denied'
    ? permission
    : 'default';
}

/**
 * Asks for permission exactly once.
 *
 * `requestPermission` returns a Promise in modern browsers but only invokes a
 * callback in older Safari, so both are handled. Never rejects: a browser that
 * refuses to answer is treated as "denied".
 */
export function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!isNotificationSupported()) return Promise.resolve('unsupported');

  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: unknown) => {
      if (settled) return;
      settled = true;
      resolve(value === 'granted' || value === 'denied' ? value : 'default');
    };

    try {
      const result = window.Notification.requestPermission((status: unknown) =>
        settle(status),
      );
      if (result && typeof result.then === 'function') {
        result.then(settle, () => settle('denied'));
      }
    } catch {
      settle('denied');
    }
  });
}

export interface DesktopNotificationOptions {
  title: string;
  body: string;
  /** Dedupe key surfaced to the OS notification centre. */
  tag: string;
  /** Invoked when the user activates the notification. */
  onClick: () => void;
}

/**
 * Shows one OS notification. Returns whether one was actually created —
 * callers use that to remember the id for duplicate suppression.
 */
export function showDesktopNotification(
  options: DesktopNotificationOptions,
): boolean {
  if (getNotificationPermission() !== 'granted') return false;

  try {
    const notification = new window.Notification(options.title, {
      body: options.body,
      tag: options.tag,
    });

    notification.onclick = () => {
      try {
        window.focus();
        options.onClick();
      } catch {
        // Focus/navigation failure must not surface as an uncaught error.
      }
    };

    return true;
  } catch {
    // Constructing a notification can throw (e.g. blocked by policy).
    return false;
  }
}
