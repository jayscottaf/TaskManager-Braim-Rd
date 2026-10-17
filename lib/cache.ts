type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();
const generations = new Map<string, number>();

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/** Share identical reads without allowing an invalidated read to restore stale data. */
export function getOrLoadCached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const cached = getCached<T>(key);
  if (cached !== null) return Promise.resolve(cached);
  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const generation = generations.get(key) ?? 0;
  const promise = Promise.resolve().then(loader).then((data) => {
    if ((generations.get(key) ?? 0) === generation) setCache(key, data, ttlMs);
    return data;
  }).finally(() => {
    if (inFlight.get(key) === promise) inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}

export function clearCache(key?: string): void {
  if (key !== undefined) {
    cache.delete(key);
    inFlight.delete(key);
    generations.set(key, (generations.get(key) ?? 0) + 1);
  } else {
    for (const existing of new Set([...cache.keys(), ...inFlight.keys()])) {
      clearCache(existing);
    }
  }
}

export function clearCachePrefix(prefix: string): void {
  for (const key of new Set([...cache.keys(), ...inFlight.keys()])) {
    if (key.startsWith(prefix)) clearCache(key);
  }
}

export const CACHE_TTL = {
  AI_PRIORITIZE: 60 * 60 * 1000,
  AI_SUGGEST: 60 * 60 * 1000,
  TASK_LIST: 5 * 60 * 1000,
  SCHEMA_SYNC: 60 * 60 * 1000,
  TASK_ANALYSIS: 24 * 60 * 60 * 1000,
} as const;
