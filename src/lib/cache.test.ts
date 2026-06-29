import { describe, it, expect, beforeEach, vi } from 'vitest'
import { cache, fetchWithCache, RequestCache } from './cache'

describe('cache', () => {
  beforeEach(() => {
    cache.clear()
  })

  it('should store and retrieve data', () => {
    cache.set('test', { foo: 'bar' })
    expect(cache.get('test')).toEqual({ foo: 'bar' })
  })

  it('should return null for non-existent keys', () => {
    expect(cache.get('missing')).toBeNull()
  })

  it('should expire entries after TTL', async () => {
    vi.useFakeTimers()
    cache.set('expired', 'data', 100)

    // Check it exists initially
    expect(cache.get('expired')).toBe('data')

    // Advance time
    vi.advanceTimersByTime(101)

    expect(cache.get('expired')).toBeNull()
    vi.useRealTimers()
  })

  it('should invalidate specific keys', () => {
    cache.set('a', 1)
    cache.set('b', 2)
    cache.invalidate('a')
    expect(cache.get('a')).toBeNull()
    expect(cache.get('b')).toBe(2)
  })

  describe('fetchWithCache', () => {
    it('should call fetcher and cache result', async () => {
      const fetcher = vi.fn().mockResolvedValue('fresh data')
      const result = await fetchWithCache('key1', fetcher)

      expect(result).toBe('fresh data')
      expect(fetcher).toHaveBeenCalledTimes(1)

      // Second call should be cached
      const result2 = await fetchWithCache('key1', fetcher)
      expect(result2).toBe('fresh data')
      expect(fetcher).toHaveBeenCalledTimes(1)
    })
  })

  it('should evict the oldest entry when maxSize is reached', () => {
    const smallCache = new RequestCache(3)
    smallCache.set('a', 1)
    smallCache.set('b', 2)
    smallCache.set('c', 3)
    smallCache.set('d', 4) // should evict 'a'

    expect(smallCache.get('a')).toBeNull()
    expect(smallCache.get('b')).toBe(2)
    expect(smallCache.get('c')).toBe(3)
    expect(smallCache.get('d')).toBe(4)
  })
})
