/**
 * useDeezerSearch.ts
 *
 * Debounced Deezer track search hook.
 * Drop-in replacement for useSpotifySearch — same interface, same behaviour.
 *
 * Differences from the Spotify version:
 * - No preview filtering needed — Deezer always returns a preview URL
 * - Cache key prefix changed to deezer:
 * - Returns DeezerTrack instead of SpotifyTrack
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { searchTracks, type DeezerTrack } from '@/lib/deezerApi'
import { fetchWithCache } from '@/lib/cache'

interface SearchState {
  tracks: DeezerTrack[]
  isLoading: boolean
  error: string | null
  total: number
  hasMore: boolean
}

const INITIAL_STATE: SearchState = {
  tracks: [],
  isLoading: false,
  error: null,
  total: 0,
  hasMore: false,
}

export function useDeezerSearch(query: string, debounceMs = 400) {
  const [state, setState] = useState<SearchState>(INITIAL_STATE)
  const latestQueryRef = useRef<string>('')
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setState(INITIAL_STATE)
      return
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const result = await fetchWithCache(
        `deezer:search:tracks:${q}`,
        () => searchTracks(q),
        3 * 60 * 1000
      )

      if (latestQueryRef.current !== q) return

      setState({
        tracks: result.tracks,
        isLoading: false,
        error: null,
        total: result.total,
        hasMore: result.hasMore,
      })
    } catch (err) {
      if (latestQueryRef.current !== q) return

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Search failed',
      }))
    }
  }, [])

  useEffect(() => {
    latestQueryRef.current = query
    clearTimeout(debounceTimer.current)

    if (!query.trim()) {
      setState(INITIAL_STATE)
      return
    }

    debounceTimer.current = setTimeout(() => search(query), debounceMs)
    return () => clearTimeout(debounceTimer.current)
  }, [query, debounceMs, search])

  return state
}
