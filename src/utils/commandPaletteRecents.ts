export const RECENTS_STORAGE_KEY = "disciplr:palette:recent:v1";
export const MAX_RECENT_COMMANDS = 8;

export interface RecentCommandStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getStorage(storage?: RecentCommandStorage): RecentCommandStorage | null {
  if (storage) return storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function getRecentCommandIds(storage?: RecentCommandStorage): string[] {
  const target = getStorage(storage);
  if (!target) return [];

  try {
    const raw = target.getItem(RECENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((id): id is string => typeof id === "string"))].slice(
      0,
      MAX_RECENT_COMMANDS,
    );
  } catch {
    return [];
  }
}

export function rememberRecentCommand(
  id: string,
  storage?: RecentCommandStorage,
): string[] {
  const next = [id, ...getRecentCommandIds(storage).filter((recentId) => recentId !== id)].slice(
    0,
    MAX_RECENT_COMMANDS,
  );
  const target = getStorage(storage);
  try {
    target?.setItem(RECENTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Keep the in-memory result usable when persistence is blocked.
  }
  return next;
}

export function clearRecentCommands(storage?: RecentCommandStorage): void {
  const target = getStorage(storage);
  try {
    target?.removeItem(RECENTS_STORAGE_KEY);
  } catch {
    // Clearing recents must not interrupt wallet disconnection.
  }
}
