import { describe, expect, it } from "vitest";
import {
  DEFAULT_FREQUENCY,
  DIGEST_PERIOD_MS,
  decideDelivery,
  isWithinQuietHours,
  normalizeFrequency,
  shouldFlushQueue,
  summarizeQueue,
  type DecideDeliveryInput,
  type DecideFlushInput,
  type DeliveryCandidate,
  type DeliveryPreferences,
} from "../delivery";
import { DEFAULT_QUIET_HOURS_END } from "../../utils/quietHours";

/** Fixed local dates: quiet hours are evaluated in the user's local time. */
const at = (hours: number, minutes = 0) => new Date(2026, 0, 15, hours, minutes);
const NOON = at(12);

const prefs = (over: Partial<DeliveryPreferences> = {}): DeliveryPreferences => ({
  push: true,
  frequency: "1",
  quietHours: "22:00",
  quietHoursEnd: "07:00",
  ...over,
});

const unread: DeliveryCandidate = { id: "ntf_001", isRead: false };
const alreadyRead: DeliveryCandidate = { id: "ntf_002", isRead: true };

function decide(over: Partial<DecideDeliveryInput> = {}) {
  return decideDelivery({
    item: unread,
    prefs: prefs(),
    permission: "granted",
    now: NOON,
    lastDigestAt: null,
    ...over,
  });
}

describe("normalizeFrequency", () => {
  it.each([
    ["1", "1"],
    ["2", "2"],
    ["3", "3"],
    ["4", "4"],
    ["", DEFAULT_FREQUENCY],
    ["0", DEFAULT_FREQUENCY],
    ["5", DEFAULT_FREQUENCY],
    ["daily", DEFAULT_FREQUENCY],
    [null, DEFAULT_FREQUENCY],
    [undefined, DEFAULT_FREQUENCY],
    [2, DEFAULT_FREQUENCY],
  ])("coerces %s to %s", (input, expected) => {
    expect(normalizeFrequency(input)).toBe(expected);
  });
});

describe("isWithinQuietHours", () => {
  it("uses the shared default end when none is stored", () => {
    const withoutEnd = prefs({ quietHours: "22:00" });
    expect(DEFAULT_QUIET_HOURS_END).toBe("07:00");
    expect(isWithinQuietHours(withoutEnd, at(23))).toBe(true);
    expect(isWithinQuietHours(withoutEnd, at(6, 30))).toBe(true);
    expect(isWithinQuietHours(withoutEnd, at(7, 30))).toBe(false);
  });

  it("treats the start minute as inside and the end minute as outside", () => {
    const overnight = prefs();
    expect(isWithinQuietHours(overnight, at(22, 0))).toBe(true);
    expect(isWithinQuietHours(overnight, at(21, 59))).toBe(false);
    expect(isWithinQuietHours(overnight, at(6, 59))).toBe(true);
    expect(isWithinQuietHours(overnight, at(7, 0))).toBe(false);
  });
});

interface DeliveryCase {
  name: string;
  over: Partial<DecideDeliveryInput>;
  expected: "show" | "suppress" | "queue";
}

const deliveryCases: DeliveryCase[] = [
  // Master switch and permission gate everything else.
  {
    name: "push disabled suppresses",
    over: { prefs: prefs({ push: false }) },
    expected: "suppress",
  },
  {
    name: "push disabled suppresses even during quiet hours",
    over: { prefs: prefs({ push: false }), now: at(23) },
    expected: "suppress",
  },
  { name: "permission denied suppresses", over: { permission: "denied" }, expected: "suppress" },
  {
    name: "permission not yet decided suppresses",
    over: { permission: "default" },
    expected: "suppress",
  },
  {
    name: "unsupported browser suppresses",
    over: { permission: "unsupported" },
    expected: "suppress",
  },

  // Frequency "Never" and already-read items are dropped outright.
  { name: "frequency never suppresses", over: { prefs: prefs({ frequency: "4" }) }, expected: "suppress" },
  {
    name: "frequency never suppresses during quiet hours too",
    over: { prefs: prefs({ frequency: "4" }), now: at(23) },
    expected: "suppress",
  },
  {
    name: "a read item is never shown",
    over: { item: alreadyRead, prefs: prefs({ frequency: "2" }) },
    expected: "suppress",
  },
  {
    name: "a read item is dropped before quiet hours defer it",
    over: { item: alreadyRead, now: at(23) },
    expected: "suppress",
  },

  // Occurrence frequency: show now, unless quiet hours defer it.
  { name: "occurrence outside quiet hours shows", over: {}, expected: "show" },
  {
    name: "unknown frequency falls back to occurrence and shows",
    over: { prefs: prefs({ frequency: "daily" }) },
    expected: "show",
  },
  {
    name: "occurrence at the quiet-hours end minute shows",
    over: { now: at(7, 0) },
    expected: "show",
  },
  {
    name: "occurrence one minute before the window ends queues",
    over: { now: at(6, 59) },
    expected: "queue",
  },
  {
    name: "occurrence at the quiet-hours start minute queues",
    over: { now: at(22, 0) },
    expected: "queue",
  },
  {
    name: "occurrence one minute before the window starts shows",
    over: { now: at(21, 59) },
    expected: "show",
  },
  {
    name: "overnight window queues at 23:00",
    over: { now: at(23) },
    expected: "queue",
  },

  // Same-day window boundaries.
  {
    name: "same-day window queues at its start",
    over: { prefs: prefs({ quietHours: "12:00", quietHoursEnd: "18:00" }), now: at(12) },
    expected: "queue",
  },
  {
    name: "same-day window queues inside",
    over: { prefs: prefs({ quietHours: "12:00", quietHoursEnd: "18:00" }), now: at(17, 59) },
    expected: "queue",
  },
  {
    name: "same-day window shows at its end",
    over: { prefs: prefs({ quietHours: "12:00", quietHoursEnd: "18:00" }), now: at(18) },
    expected: "show",
  },

  // Digest frequencies always queue so they can be batched.
  {
    name: "daily outside quiet hours queues for a digest",
    over: { prefs: prefs({ frequency: "2" }) },
    expected: "queue",
  },
  {
    name: "weekly outside quiet hours queues for a digest",
    over: { prefs: prefs({ frequency: "3" }) },
    expected: "queue",
  },
  {
    name: "daily inside quiet hours queues",
    over: { prefs: prefs({ frequency: "2" }), now: at(23) },
    expected: "queue",
  },
];

describe("decideDelivery", () => {
  it.each(deliveryCases)("$name", ({ over, expected }) => {
    expect(decide(over)).toBe(expected);
  });
});

const flush = (over: Partial<DecideFlushInput> = {}) =>
  shouldFlushQueue({
    queueLength: 1,
    queuedDuringQuietHours: false,
    oldestQueuedAt: NOON.getTime(),
    prefs: prefs(),
    permission: "granted",
    now: NOON,
    lastDigestAt: null,
    ...over,
  });

const DAY = DIGEST_PERIOD_MS["2"];
const WEEK = DIGEST_PERIOD_MS["3"];

describe("shouldFlushQueue", () => {
  it("does nothing for an empty queue", () => {
    expect(flush({ queueLength: 0 })).toBe(false);
  });

  it("does nothing without the master switch or permission", () => {
    expect(flush({ prefs: prefs({ push: false }) })).toBe(false);
    expect(flush({ permission: "denied" })).toBe(false);
    expect(flush({ permission: "default" })).toBe(false);
    expect(flush({ permission: "unsupported" })).toBe(false);
  });

  it("never releases when the frequency is Never", () => {
    expect(flush({ prefs: prefs({ frequency: "4" }) })).toBe(false);
  });

  it("waits out quiet hours", () => {
    expect(flush({ now: at(23) })).toBe(false);
    expect(flush({ now: at(6, 59) })).toBe(false);
  });

  it("releases occurrence items as soon as quiet hours end", () => {
    expect(
      flush({ queuedDuringQuietHours: true, now: at(7), oldestQueuedAt: at(23).getTime() }),
    ).toBe(true);
  });

  it("releases quiet-hour-held digests immediately after the window", () => {
    expect(
      flush({
        prefs: prefs({ frequency: "2" }),
        queuedDuringQuietHours: true,
        oldestQueuedAt: at(23).getTime(),
      }),
    ).toBe(true);
  });

  it("holds a daily digest until a full day has passed", () => {
    expect(
      flush({ prefs: prefs({ frequency: "2" }), oldestQueuedAt: NOON.getTime() - (DAY - 60_000) }),
    ).toBe(false);
    expect(
      flush({ prefs: prefs({ frequency: "2" }), oldestQueuedAt: NOON.getTime() - DAY }),
    ).toBe(true);
  });

  it("holds a weekly digest until a full week has passed", () => {
    expect(
      flush({ prefs: prefs({ frequency: "3" }), oldestQueuedAt: NOON.getTime() - (WEEK - 60_000) }),
    ).toBe(false);
    expect(
      flush({ prefs: prefs({ frequency: "3" }), oldestQueuedAt: NOON.getTime() - WEEK }),
    ).toBe(true);
  });

  it("measures the digest period from the last release when there is one", () => {
    expect(
      flush({
        prefs: prefs({ frequency: "2" }),
        oldestQueuedAt: NOON.getTime() - 60_000,
        lastDigestAt: NOON.getTime() - (DAY - 60_000),
      }),
    ).toBe(false);
    expect(
      flush({
        prefs: prefs({ frequency: "2" }),
        oldestQueuedAt: NOON.getTime() - 60_000,
        lastDigestAt: NOON.getTime() - DAY,
      }),
    ).toBe(true);
  });

  it("releases defensive empty anchors", () => {
    expect(flush({ oldestQueuedAt: null })).toBe(true);
    expect(
      flush({ prefs: prefs({ frequency: "2" }), oldestQueuedAt: null, lastDigestAt: null }),
    ).toBe(true);
  });

  it("normalizes an unknown frequency to occurrence", () => {
    expect(flush({ prefs: prefs({ frequency: "nope" }) })).toBe(true);
  });
});

describe("summarizeQueue", () => {
  it("uses the singular form for one update", () => {
    expect(summarizeQueue(1)).toBe("1 update while you were away");
  });

  it("uses the plural form for several updates", () => {
    expect(summarizeQueue(3)).toBe("3 updates while you were away");
    expect(summarizeQueue(0)).toBe("0 updates while you were away");
  });
});
