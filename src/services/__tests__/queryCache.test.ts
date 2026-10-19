import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cached, invalidate, subscribe, clearCache } from "../queryCache";

describe("queryCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearCache();
  });
  afterEach(() => {
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
});
