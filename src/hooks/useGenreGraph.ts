/**
 * useGenreGraph.ts
 *
 * Fetches artist data for all tracks in the search results and builds
 * the genre graph data structure.
 *
 * FETCH STRATEGY:
 * Spotify's GET /artists endpoint accepts up to 50 IDs in one request.
 * We collect all unique artist IDs from the track list, batch them into
 * groups of 50, and fetch in parallel. Results are cached so repeated
 * searches don't re-fetch the same artists.
 *
 * IMPORTANT:
 * This hook fires when tracks change. It does NOT fire on every render.
 * Artist data is stable once fetched — genres don't change.
 */

import { useState, useEffect, useRef } from 'react'
import { getArtists } from '@/lib/spotifyApi'
import { buildGenreGraph, type GenreGraphData } from '@/lib/genreGraph'
import { fetchWithCache } from '@/lib/cache'
import type { SpotifyTrack } from '@/lib/spotifyApi'

const EMPTY_GRAPH: GenreGraphData = { nodes: [], links: [] }

export function useGenreGraph(tracks: SpotifyTrack[]) {
  const [graphData, setGraphData] = useState<GenreGraphData>(EMPTY_GRAPH)
  const [isLoading, setIsLoading] = useState(false)
  const abortRef = useRef(false)

  useEffect(() => {
    if (tracks.length === 0) {
      setGraphData(EMPTY_GRAPH)
      return
    }

    abortRef.current = false

    // Collect unique artist IDs across all tracks
    const artistIds = Array.from(
      new Set(tracks.flatMap(t => t.artists.map(a => a.id)))
    )

    if (artistIds.length === 0) {
      setGraphData(EMPTY_GRAPH)
      return
    }

    setIsLoading(true)

    async function fetchAndBuild() {
      try {
        // Batch into groups of 50 (Spotify API limit)
        const batches: string[][] = []
        for (let i = 0; i < artistIds.length; i += 50) {
          batches.push(artistIds.slice(i, i + 50))
        }

        // Fetch all batches — use cache to avoid re-fetching
        const batchResults = await Promise.all(
          batches.map(batch =>
            fetchWithCache(
              `artists:${batch.sort().join(',')}`,
              () => getArtists(batch),
              30 * 60 * 1000 // 30 min cache — genres are stable
            )
          )
        )

        if (abortRef.current) return

        const allArtists = batchResults.flat()
        const graph = buildGenreGraph(tracks, allArtists)
        setGraphData(graph)
      } catch (err) {
        console.warn('Genre graph fetch failed:', err)
        setGraphData(EMPTY_GRAPH)
      } finally {
        if (!abortRef.current) setIsLoading(false)
      }
    }

    fetchAndBuild()

    return () => {
      abortRef.current = true
    }
  }, [tracks])

  return { graphData, isLoading }
}