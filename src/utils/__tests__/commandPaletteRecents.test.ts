import { describe, expect, it, vi } from "vitest";
import {
  getRecentCommandIds,
  MAX_RECENT_COMMANDS,
  RECENTS_STORAGE_KEY,
  rememberRecentCommand,
  type RecentCommandStorage,
} from "../commandPaletteRecents";

function createStorage(initialValue: string | null = null) {
  let value = initialValue;
  const storage: RecentCommandStorage = {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key, nextValue) => {
      value = nextValue;
    }),
    removeItem: vi.fn(() => {
      value = null;
    }),
  };
  return { storage, read: () => value };
}

describe("command palette recents", () => {
  it("keeps the newest eight commands and evicts the oldest", () => {
    const { storage } = createStorage();
    let recentIds: string[] = [];

    for (let index = 1; index <= MAX_RECENT_COMMANDS + 1; index += 1) {
      recentIds = rememberRecentCommand(`command-${index}`, storage);
    }

    expect(recentIds).toHaveLength(8);
    expect(recentIds[0]).toBe("command-9");
    expect(recentIds).not.toContain("command-1");
    expect(getRecentCommandIds(storage)).toEqual(recentIds);
  });

  it("ignores corrupt JSON and overwrites it when a command is remembered", () => {
    const { storage, read } = createStorage("{not json");

    expect(getRecentCommandIds(storage)).toEqual([]);
    expect(rememberRecentCommand("action-analytics", storage)).toEqual([
      "action-analytics",
    ]);
    expect(read()).toBe(JSON.stringify(["action-analytics"]));
    expect(storage.setItem).toHaveBeenCalledWith(
      RECENTS_STORAGE_KEY,
      JSON.stringify(["action-analytics"]),
    );
  });

  it("tolerates blocked storage reads and writes", () => {
    const storage: RecentCommandStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };

    expect(getRecentCommandIds(storage)).toEqual([]);
    expect(rememberRecentCommand("action-dashboard", storage)).toEqual([
      "action-dashboard",
    ]);
  });
});
