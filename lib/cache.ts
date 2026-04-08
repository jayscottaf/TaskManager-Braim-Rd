type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function clearCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

// TTL constants
export const CACHE_TTL = {
  AI_PRIORITIZE: 60 * 60 * 1000,  // 1 hour
  AI_SUGGEST: 60 * 60 * 1000,     // 1 hour
  TASK_LIST: 5 * 60 * 1000,       // 5 minutes
} as const;
