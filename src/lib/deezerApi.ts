/**
 * deezerApi.ts
 *
 * Deezer API wrapper. No auth required — all endpoints used here are public.
 *
 * CORS: Deezer's API blocks direct browser requests. We proxy through
 * our own Vercel domain via a rewrite in vercel.json:
 *   /deezer-api/* → https://api.deezer.com/*
 *
 * This means in development (vercel dev) and production, all requests
 * go to /deezer-api/... and Vercel forwards them to Deezer server-side.
 *
 * WHAT THIS REPLACES:
 * - spotifyApi.ts (entire file)
 * - api/spotify-token.ts (no longer needed — delete it)
 *
 * NOTABLE DIFFERENCES FROM SPOTIFY:
 * - Genre data comes directly on the track/artist object (no separate fetch)
 * - Preview URL is always present as `preview` (30s MP3, no Premium needed)
 * - Album art is `cover_medium` / `cover_big` on the album object
 * - Search returns max 25 results per request (use `index` param to paginate)
 */

const BASE = '/deezer-api'

// ─── Types ────────────────────────────────────────────────────────────────

export interface DeezerArtist {
  id: number
  name: string
  picture_medium: string
  picture_big: string
  nb_fan?: number
}

export interface DeezerAlbum {
  id: number
  title: string
  cover_medium: string
  cover_big: string
  release_date?: string
}

export interface DeezerGenre {
  id: number
  name: string
}

export interface DeezerTrack {
  source: 'deezer'
  id: number
  title: string
  duration: number // seconds
  preview: string // 30s MP3 URL — always present
  artist: DeezerArtist
  album: DeezerAlbum
  rank: number // popularity proxy (0–1,000,000)
  explicit_lyrics: boolean
}

export interface DeezerFullTrack extends DeezerTrack {
  genres?: { data: DeezerGenre[] }
}

export interface TrackSearchResult {
  tracks: DeezerTrack[]
  total: number
  hasMore: boolean
  nextIndex: number
}

// ─── Request helper ───────────────────────────────────────────────────────

export function isDeezerErrorBody(
  obj: unknown
): obj is { error: { code: number; message: string } } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'error' in obj &&
    typeof (obj as Record<string, unknown>).error === 'object' &&
    (obj as Record<string, unknown>).error !== null &&
    'code' in ((obj as Record<string, unknown>).error as object) &&
    'message' in ((obj as Record<string, unknown>).error as object)
  )
}

async function deezerFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}${path}`, window.location.origin)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Deezer API error: ${res.status} on ${path}`)

  const data = await res.json()

  // Deezer returns errors inside the response body
  if (isDeezerErrorBody(data)) {
    throw new Error(`Deezer error ${data.error.code}: ${data.error.message}`)
  } else if (data.error) {
    throw new Error(`Deezer error: ${String(data.error)}`)
  }

  return data as T
}

// ─── Search ───────────────────────────────────────────────────────────────

/**
 * Search for tracks. Every result has a preview URL — no filtering needed.
 */
export async function searchTracks(
  query: string,
  index = 0,
  limit = 25
): Promise<TrackSearchResult> {
  if (!query.trim()) return { tracks: [], total: 0, hasMore: false, nextIndex: 0 }

  const data = await deezerFetch<{
    data: DeezerTrack[]
    total: number
    next?: string
  }>('/search', {
    q: query,
    limit: String(limit),
    index: String(index),
  })

  return {
    tracks: (data.data ?? []).map(t => ({ ...t, source: 'deezer' })),
    total: data.total ?? 0,
    hasMore: !!data.next,
    nextIndex: index + limit,
  }
}

/**
 * Search for artists.
 */
export async function searchArtists(query: string, limit = 10): Promise<DeezerArtist[]> {
  if (!query.trim()) return []

  const data = await deezerFetch<{ data: DeezerArtist[] }>('/search/artist', {
    q: query,
    limit: String(limit),
  })

  return data.data ?? []
}

/**
 * Get full track details including genres.
 * Genres are nested under track.album on the full track endpoint.
 */
export async function getTrack(trackId: number): Promise<DeezerFullTrack> {
  const track = await deezerFetch<DeezerFullTrack>(`/track/${trackId}`)
  return { ...track, source: 'deezer' }
}

/**
 * Get artist details.
 */
export async function getArtist(
  artistId: number
): Promise<DeezerArtist & { genres?: { data: DeezerGenre[] } }> {
  return deezerFetch(`/artist/${artistId}`)
}

/**
 * Get artist's top tracks.
 */
export async function getArtistTopTracks(artistId: number, limit = 10): Promise<DeezerTrack[]> {
  const data = await deezerFetch<{ data: DeezerTrack[] }>(`/artist/${artistId}/top`, {
    limit: String(limit),
  })
  return (data.data ?? []).map(t => ({ ...t, source: 'deezer' }))
}

/**
 * Get genres for an album — used by the genre graph.
 * Returns an empty array if genres aren't available.
 */
export async function getAlbumGenres(albumId: number): Promise<DeezerGenre[]> {
  try {
    const data = await deezerFetch<{ genres?: { data: DeezerGenre[] } }>(`/album/${albumId}`)
    return data.genres?.data ?? []
  } catch {
    return []
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Get the best available album art URL.
 */
export function getAlbumArt(
  track: DeezerTrack,
  size: 'small' | 'medium' | 'large' = 'medium'
): string {
  switch (size) {
    case 'small':
      return track.album.cover_medium // 250x250
    case 'medium':
      return track.album.cover_medium // 250x250
    case 'large':
      return track.album.cover_big // 500x500
  }
}

/**
 * Format duration from seconds to m:ss string.
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
