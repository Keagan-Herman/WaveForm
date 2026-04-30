/**
 * cache.ts
 *
 * Simple in-memory request cache with TTL.
 * Used to avoid re-fetching on component remounts and rapid re-renders.
 *
 * This is intentionally simple — no LRU eviction, no persistence.
 * For a portfolio demo this is more than sufficient.
 * The cache lives for the duration of the browser session.
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

class RequestCache {
  private store = new Map<string, CacheEntry<unknown>>()

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }
    return entry.data as T
  }

  set<T>(key: string, data: T, ttlMs = 5 * 60 * 1000): void {
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs })
  }

  invalidate(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }
}

export const cache = new RequestCache()

/**
 * Wraps a fetch function with caching.
 *
 * Usage:
 *   const data = await fetchWithCache('my-key', () => fetchSomething(), 60_000)
 */
export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 5 * 60 * 1000
): Promise<T> {
  const cached = cache.get<T>(key)
  if (cached !== null) return cached

  const data = await fetcher()
  cache.set(key, data, ttlMs)
  return data
}