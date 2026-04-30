/**
 * useSpotifySearch.ts
 *
 * Debounced Spotify track search hook.
 *
 * Features:
 * - 400ms debounce — avoids firing on every keystroke
 * - Request caching — repeated identical queries hit the cache
 * - Cancels stale requests — if the query changes mid-flight,
 *   the previous result is discarded
 * - Handles empty queries gracefully
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { searchTracks, type SpotifyTrack } from '@/lib/spotifyApi'
import { fetchWithCache } from '@/lib/cache'

interface SearchState {
  tracks: SpotifyTrack[]
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

export function useSpotifySearch(query: string, debounceMs = 400) {
  const [state, setState] = useState<SearchState>(INITIAL_STATE)
  const latestQueryRef = useRef<string>('')
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>()

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setState(INITIAL_STATE)
      return
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const result = await fetchWithCache(
        `search:tracks:${q}`,
        () => searchTracks(q),
        3 * 60 * 1000 // 3 minute cache
      )

      // Discard result if query has changed since this request fired
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