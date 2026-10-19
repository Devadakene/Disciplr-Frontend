/**
 * queryCache.ts
 *
 * Small in-memory query cache for the service layer. Dedupes concurrent
 * requests per key, serves fresh data instantly, revalidates stale data in the
 * background (stale-while-revalidate) and evicts entries older than `maxAgeMs`.
 * Errors are never cached. Backed by a Map so keys like "__proto__" are safe.
 */

export interface CacheOptions {
  /** Entries younger than this are served without refetching. */
  staleMs?: number;
  /** Entries older than this are evicted and refetched before returning. */
  maxAgeMs?: number;
  /** Bypass the cache and fetch now (result still populates the cache). */
  force?: boolean;
}

interface Entry {
  data: unknown;
  at: number;
}

const DEFAULT_STALE_MS = 15_000;
const DEFAULT_MAX_AGE_MS = 5 * 60_000;

const entries = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const generations = new Map<string, number>();
const listeners = new Map<string, Set<() => void>>();

function generationOf(key: string): number {
  return generations.get(key) ?? 0;
}

function notify(key: string): void {
  listeners.get(key)?.forEach((cb) => cb());
}

function load<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const gen = generationOf(key);
  const promise = fetcher()
    .then((data) => {
      // Skip storing if the key was invalidated while the request was in flight.
      if (generationOf(key) === gen) {
        entries.set(key, { data, at: Date.now() });
        notify(key);
      }
      return data;
    })
    .finally(() => {
      if (inflight.get(key) === promise) inflight.delete(key);
    });
  inflight.set(key, promise);
  return promise;
}

export function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {},
): Promise<T> {
  const {
    staleMs = DEFAULT_STALE_MS,
    maxAgeMs = DEFAULT_MAX_AGE_MS,
    force = false,
  } = options;

  if (force) return load(key, fetcher);

  const entry = entries.get(key);
  if (entry) {
    const age = Date.now() - entry.at;
    if (age < staleMs) return Promise.resolve(entry.data as T);
    if (age < maxAgeMs) {
      // Stale-while-revalidate: return old data, refresh in background.
      load(key, fetcher).catch(() => undefined);
      return Promise.resolve(entry.data as T);
    }
    entries.delete(key);
  }
  return load(key, fetcher);
}

/** Clear every key starting with `prefix` (and drop matching in-flight results). */
export function invalidate(prefix: string): void {
  for (const key of [...entries.keys()]) {
    if (key.startsWith(prefix)) entries.delete(key);
  }
  for (const key of [...inflight.keys()]) {
    if (key.startsWith(prefix)) {
      generations.set(key, generationOf(key) + 1);
      inflight.delete(key);
    }
  }
  for (const key of [...listeners.keys()]) {
    if (key.startsWith(prefix)) notify(key);
  }
}

/** Clear the whole cache (e.g. on wallet switch or disconnect). */
export function clearCache(): void {
  invalidate("");
}

/** Subscribe to revalidation of `key`. Returns an unsubscribe function. */
export function subscribe(key: string, cb: () => void): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(cb);
  return () => {
    set?.delete(cb);
    if (set?.size === 0) listeners.delete(key);
  };
}
