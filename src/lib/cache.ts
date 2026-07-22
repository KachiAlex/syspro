/**
 * Simple in-memory TTL cache for permission lookups.
 * Reduces DB queries on every API request.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<any>>();

/**
 * Get a cached value or compute it.
 * @param key - Cache key
 * @param ttlMs - Time to live in milliseconds
 * @param compute - Function to compute the value if not cached
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  compute: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const existing = cache.get(key);
  if (existing && existing.expiresAt > now) {
    return existing.value as T;
  }

  const value = await compute();
  cache.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

/**
 * Invalidate a specific cache entry.
 */
export function invalidateCache(key: string): void {
  cache.delete(key);
}

/**
 * Invalidate all cache entries matching a prefix.
 */
export function invalidatePrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}
