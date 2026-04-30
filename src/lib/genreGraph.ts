/**
 * genreGraph.ts
 *
 * Builds the D3 force graph data structure from Spotify track + artist data.
 *
 * NODES: unique genres extracted from all artists in the track list
 * LINKS: two genres are linked if they share at least one artist
 * LINK WEIGHT: number of shared artists (drives link distance in simulation)
 *
 * WHY NOT USE TRACK GENRES:
 * Spotify does not expose genres on track objects — only on artist objects.
 * We have artist IDs from tracks, so we need a separate artist fetch to get
 * genres. This module handles the data shape once that fetch is complete.
 *
 * NODE SIZE:
 * Proportional to how many tracks in the current results belong to that genre.
 * More represented genres appear larger.
 */

import type { SpotifyArtist, SpotifyTrack } from '@/lib/spotifyApi'

export interface GenreNode {
  id: string          // genre string e.g. "indie rock"
  label: string
  count: number       // how many tracks belong to this genre
  trackIds: string[]  // which track IDs belong to this genre
  // D3 simulation adds these at runtime:
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
  weight: number      // shared artist count
}

export interface GenreGraphData {
  nodes: GenreNode[]
  links: GenreLink[]
}

export function buildGenreGraph(
  tracks: SpotifyTrack[],
  artists: SpotifyArtist[]
): GenreGraphData {
  // Map artist ID → genres
  const artistGenreMap = new Map<string, string[]>()
  artists.forEach(artist => {
    artistGenreMap.set(artist.id, artist.genres)
  })

  // Map genre → track IDs that belong to it
  const genreTrackMap = new Map<string, Set<string>>()

  tracks.forEach(track => {
    track.artists.forEach(trackArtist => {
      const genres = artistGenreMap.get(trackArtist.id) ?? []
      genres.forEach(genre => {
        if (!genreTrackMap.has(genre)) {
          genreTrackMap.set(genre, new Set())
        }
        genreTrackMap.get(genre)!.add(track.id)
      })
    })
  })

  // Build nodes — filter out genres with only 1 track (too sparse to be useful)
  const nodes: GenreNode[] = []
  genreTrackMap.forEach((trackIds, genre) => {
    if (trackIds.size < 1) return
    nodes.push({
      id: genre,
      label: genre,
      count: trackIds.size,
      trackIds: Array.from(trackIds),
    })
  })

  // Cap at 30 nodes — more than this makes the graph unreadable
  // Sort by count descending so we keep the most relevant genres
  nodes.sort((a, b) => b.count - a.count)
  const cappedNodes = nodes.slice(0, 30)
  const nodeIds = new Set(cappedNodes.map(n => n.id))

  // Build links — genres that share artists
  // Use artist → genres mapping to find co-occurrences
  const linkMap = new Map<string, number>()

  artists.forEach(artist => {
    const genres = artist.genres.filter(g => nodeIds.has(g))
    // Every pair of genres from this artist gets a link
    for (let i = 0; i < genres.length; i++) {
      for (let j = i + 1; j < genres.length; j++) {
        const key = [genres[i], genres[j]].sort().join('||')
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