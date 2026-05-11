/**
 * genreGraph.ts — Deezer version
 *
 * Builds the D3 force graph data structure from Deezer track data.
 *
 * KEY DIFFERENCE FROM SPOTIFY VERSION:
 * Deezer does not return genres on the basic track search result.
 * Genres are available on the full album endpoint (/album/{id}).
 * The useGenreGraph hook fetches album genres separately and passes
 * them in as a map. This file just handles the data transformation.
 *
 * NODES: unique genres across all albums in the track list
 * LINKS: two genres are linked if they appear on the same album
 */

import type { DeezerTrack } from '@/lib/deezerApi'

export interface GenreNode {
  id: string
  label: string
  count: number
  trackIds: string[]
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
}

export interface GenreLink {
  source: string | GenreNode
  target: string | GenreNode
  weight: number
}

export interface GenreGraphData {
  nodes: GenreNode[]
  links: GenreLink[]
}

/**
 * @param tracks - current search results
 * @param albumGenreMap - map of albumId → genre names, fetched separately
 */
export function buildGenreGraph(
  tracks: DeezerTrack[],
  albumGenreMap: Map<number, string[]>
): GenreGraphData {
  // Map genre → track IDs
  const genreTrackMap = new Map<string, Set<string>>()

  tracks.forEach(track => {
    const genres = albumGenreMap.get(track.album.id) ?? []
    genres.forEach(genre => {
      if (!genreTrackMap.has(genre)) {
        genreTrackMap.set(genre, new Set())
      }
      genreTrackMap.get(genre)!.add(String(track.id))
    })
  })

  // Build nodes
  const nodes: GenreNode[] = []
  genreTrackMap.forEach((trackIds, genre) => {
    nodes.push({
      id: genre,
      label: genre,
      count: trackIds.size,
      trackIds: Array.from(trackIds),
    })
  })

  nodes.sort((a, b) => b.count - a.count)
  const cappedNodes = nodes.slice(0, 30)
  const nodeIds = new Set(cappedNodes.map(n => n.id))

  // Build links — genres that co-occur on the same album
  const linkMap = new Map<string, number>()

  albumGenreMap.forEach(genres => {
    const validGenres = genres.filter(g => nodeIds.has(g))
    for (let i = 0; i < validGenres.length; i++) {
      for (let j = i + 1; j < validGenres.length; j++) {
        const key = [validGenres[i], validGenres[j]].sort().join('||')
        linkMap.set(key, (linkMap.get(key) ?? 0) + 1)
      }
    }
  })

  const links: GenreLink[] = []
  linkMap.forEach((weight, key) => {
    const [source, target] = key.split('||')
    links.push({ source, target, weight })
  })

  return { nodes: cappedNodes, links }
}
