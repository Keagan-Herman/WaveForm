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

export class RequestCache {
  private store = new Map<string, CacheEntry<unknown>>()
  private readonly maxSize: number

  constructor(maxSize = 50) {
    this.maxSize = maxSize
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }
    // LRU: re-insert to move to end of Map iteration order
    this.store.delete(key)
    this.store.set(key, entry)
    return entry.data as T
  }

  set<T>(key: string, data: T, ttlMs = 5 * 60 * 1000): void {
    if (!this.store.has(key) && this.store.size >= this.maxSize) {
      const oldestKey = this.store.keys().next().value
      if (oldestKey !== undefined) this.store.delete(oldestKey)
    }
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
