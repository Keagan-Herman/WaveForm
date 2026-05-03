/**
 * useGenreGraph.ts — Deezer version
 *
 * Fetches album genre data for all tracks and builds the genre graph.
 *
 * DIFFERENCE FROM SPOTIFY VERSION:
 * Spotify required a separate /artists batch fetch to get genres.
 * Deezer puts genres on the /album/{id} endpoint instead.
 *
 * We deduplicate by album ID (many tracks share an album), then fetch
 * each unique album's genres. Results are cached for 30 minutes.
 *
 * NOTE: Deezer's genre data is less granular than Spotify's artist genres.
 * You'll see broader categories like "Pop", "Rock", "Electronic" rather
 * than micro-genres like "indie dream pop". The graph still works — it
 * just clusters at a higher level.
 */

import { useState, useEffect, useRef } from 'react'
import { getAlbumGenres } from '@/lib/deezerApi'
import { buildGenreGraph, type GenreGraphData } from '@/lib/genreGraph'
import { fetchWithCache } from '@/lib/cache'
import type { DeezerTrack } from '@/lib/deezerApi'

const EMPTY_GRAPH: GenreGraphData = { nodes: [], links: [] }

export function useGenreGraph(tracks: DeezerTrack[]) {
  const [graphData, setGraphData] = useState<GenreGraphData>(EMPTY_GRAPH)
  const [isLoading, setIsLoading] = useState(false)
  const abortRef = useRef(false)

  useEffect(() => {
    if (tracks.length === 0) {
      setGraphData(EMPTY_GRAPH)
      return
    }

    abortRef.current = false

    // Deduplicate album IDs — many tracks share an album
    const uniqueAlbumIds = Array.from(new Set(tracks.map(t => t.album.id)))

    setIsLoading(true)

    async function fetchAndBuild() {
      try {
        // Fetch genres for each unique album in parallel
        const genreResults = await Promise.all(
          uniqueAlbumIds.map(albumId =>
            fetchWithCache(
              `deezer:album:genres:${albumId}`,
              () => getAlbumGenres(albumId),
              30 * 60 * 1000
            ).then(genres => ({ albumId, genres }))
          )
        )

        if (abortRef.current) return

        // Build album → genres map
        const albumGenreMap = new Map<number, string[]>()
        genreResults.forEach(({ albumId, genres }) => {
          if (genres.length > 0) {
            albumGenreMap.set(albumId, genres.map(g => g.name))
          }
        })

        const graph = buildGenreGraph(tracks, albumGenreMap)
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