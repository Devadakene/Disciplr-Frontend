import { dateBucket, groupNotificationsByDate } from "../groupNotifications";

describe("groupNotifications", () => {
  it("classifies a timestamp at midnight of the current local day as Today", () => {
    const now = new Date(2024, 4, 10, 12, 30, 0);
    const todayMidnight = new Date(2024, 4, 10, 0, 0, 0);

    expect(dateBucket(todayMidnight.toISOString(), now)).toBe("Today");
  });

  it("classifies a timestamp from exactly 24 hours ago as Yesterday", () => {
    const now = new Date(2024, 4, 10, 12, 0, 0);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    expect(dateBucket(twentyFourHoursAgo.toISOString(), now)).toBe("Yesterday");
  });

  it("classifies older timestamps as Earlier", () => {
    const now = new Date(2024, 4, 10, 12, 0, 0);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    expect(dateBucket(threeDaysAgo.toISOString(), now)).toBe("Earlier");
  });

  it("omits empty buckets and preserves item order within each bucket", () => {
    const now = new Date(2024, 4, 10, 12, 0, 0);
    const items = [
      { id: "today-1", timestamp: new Date(2024, 4, 10, 10, 0, 0).toISOString() },
      { id: "today-2", timestamp: new Date(2024, 4, 10, 11, 0, 0).toISOString() },
      { id: "earlier-1", timestamp: new Date(2024, 4, 4, 8, 0, 0).toISOString() },
    ];

    const result = groupNotificationsByDate(items, now);

    expect(result.map((group) => group.bucket)).toEqual(["Today", "Earlier"]);
    expect(result[0].items.map((item) => item.id)).toEqual(["today-1", "today-2"]);
    expect(result[1].items.map((item) => item.id)).toEqual(["earlier-1"]);
  });
});
