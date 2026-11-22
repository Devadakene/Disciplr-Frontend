import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  cached,
  invalidate,
  subscribe,
  clearCache,
  setMaxEntries,
  DEFAULT_MAX_ENTRIES,
} from "../queryCache";

describe("queryCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setMaxEntries(DEFAULT_MAX_ENTRIES);
    clearCache();
  });
  afterEach(() => {
    setMaxEntries(DEFAULT_MAX_ENTRIES);
    vi.useRealTimers();
  });

  it("serves fresh data without refetching", async () => {
    const f = vi.fn().mockResolvedValue("a");
    await cached("k", f);
    vi.advanceTimersByTime(14_000);
    expect(await cached("k", f)).toBe("a");
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("returns stale data and revalidates in background", async () => {
    const f = vi.fn().mockResolvedValueOnce("a").mockResolvedValueOnce("b");
    await cached("k", f);
    vi.advanceTimersByTime(20_000);
    expect(await cached("k", f)).toBe("a");
    expect(f).toHaveBeenCalledTimes(2);
    await Promise.resolve();
    await Promise.resolve();
    expect(await cached("k", f)).toBe("b");
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("dedupes concurrent requests", async () => {
    const f = vi.fn().mockResolvedValue("a");
    const [x, y] = await Promise.all([cached("k", f), cached("k", f)]);
    expect(x).toBe(y);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("evicts entries older than maxAgeMs", async () => {
    const f = vi.fn().mockResolvedValueOnce("a").mockResolvedValueOnce("b");
    await cached("k", f);
    vi.advanceTimersByTime(5 * 60_000 + 1);
    expect(await cached("k", f)).toBe("b");
  });

  it("invalidates by prefix only", async () => {
    const f = vi.fn().mockResolvedValue("a");
    const g = vi.fn().mockResolvedValue("b");
    await cached("vault:1", f);
    await cached("other", g);
    invalidate("vault:");
    await cached("vault:1", f);
    await cached("other", g);
    expect(f).toHaveBeenCalledTimes(2);
    expect(g).toHaveBeenCalledTimes(1);
  });

  it("does not store results of requests invalidated in flight", async () => {
    const f = vi.fn().mockResolvedValue("a");
    const p = cached("k", f);
    invalidate("k");
    await p;
    await cached("k", f);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("does not cache errors", async () => {
    const f = vi.fn().mockRejectedValueOnce(new Error("x")).mockResolvedValue("ok");
    await expect(cached("k", f)).rejects.toThrow("x");
    expect(await cached("k", f)).toBe("ok");
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("force bypasses cache and notifies subscribers", async () => {
    const f = vi.fn().mockResolvedValueOnce("a").mockResolvedValueOnce("b");
    const cb = vi.fn();
    const off = subscribe("k", cb);
    await cached("k", f);
    expect(await cached("k", f, { force: true })).toBe("b");
    expect(cb).toHaveBeenCalledTimes(2);
    off();
  });

  it("handles __proto__ keys safely", async () => {
    expect(await cached("vault:__proto__", async () => "p")).toBe("p");
    expect(({} as Record<string, unknown>).data).toBeUndefined();
  });

  it("evicts least recently used key when cap is exceeded and reads refresh recency", async () => {
    setMaxEntries(3);
    const fa = vi.fn().mockResolvedValue("A");
    const fb = vi.fn().mockResolvedValue("B");
    const fc = vi.fn().mockResolvedValue("C");
    const fd = vi.fn().mockResolvedValue("D");

    await cached("a", fa);
    await cached("b", fb);
    await cached("c", fc);

    // Read "a" so "b" becomes the least recently used key.
    expect(await cached("a", fa)).toBe("A");
    expect(fa).toHaveBeenCalledTimes(1);

    // Writing "d" exceeds cap 3 and should evict "b".
    await cached("d", fd);

    expect(await cached("a", fa)).toBe("A");
    expect(await cached("c", fc)).toBe("C");
    expect(await cached("d", fd)).toBe("D");
    expect(fa).toHaveBeenCalledTimes(1);
    expect(fc).toHaveBeenCalledTimes(1);
    expect(fd).toHaveBeenCalledTimes(1);

    // "b" was evicted, so reading it triggers a new fetch.
    expect(await cached("b", fb)).toBe("B");
    expect(fb).toHaveBeenCalledTimes(2);
  });

  it("never evicts an in-flight key when cap is exceeded", async () => {
    setMaxEntries(3);
    const fa = vi.fn().mockResolvedValue("A1");
    const fb = vi.fn().mockResolvedValue("B1");
    const fc = vi.fn().mockResolvedValue("C1");
    const fd = vi.fn().mockResolvedValue("D1");

    await cached("a", fa);
    await cached("b", fb);
    await cached("c", fc);

    // Start an in-flight force refresh on the oldest key "a".
    let resolveA2!: (v: string) => void;
    const inflightA = cached(
      "a",
      () =>
        new Promise<string>((resolve) => {
          resolveA2 = resolve;
        }),
      { force: true },
    );

    // Insert "d" while "a" is in-flight: "a" must not be evicted, so "b" is evicted.
    await cached("d", fd);

    // "b" should have been evicted.
    await cached("b", fb);
    expect(fb).toHaveBeenCalledTimes(2);

    // "a" is still in-flight and resolves cleanly without being dropped.
    resolveA2("A2");
    expect(await inflightA).toBe("A2");
    expect(await cached("a", fa)).toBe("A2");
    expect(fa).toHaveBeenCalledTimes(1);
  });

  it("validates setMaxEntries and trims existing overflow", async () => {
    expect(() => setMaxEntries(0)).toThrow(RangeError);
    expect(() => setMaxEntries(-5)).toThrow(RangeError);
    expect(() => setMaxEntries(Number.NaN)).toThrow(RangeError);

    const fa = vi.fn().mockResolvedValue("A");
    const fb = vi.fn().mockResolvedValue("B");
    const fc = vi.fn().mockResolvedValue("C");
    await cached("a", fa);
    await cached("b", fb);
    await cached("c", fc);

    setMaxEntries(2);
    // "a" (oldest) should be trimmed immediately.
    await cached("b", fb);
    await cached("c", fc);
    expect(fb).toHaveBeenCalledTimes(1);
    expect(fc).toHaveBeenCalledTimes(1);

    await cached("a", fa);
    expect(fa).toHaveBeenCalledTimes(2);
  });
});
