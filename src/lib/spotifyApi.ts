/**
 * spotifyApi.ts
 *
 * Client-side Spotify API wrapper. Fetches tokens from our proxy endpoint
 * (/api/spotify-token) — never directly from Spotify's token URL.
 *
 * TOKEN STRATEGY:
 * The client maintains its own lightweight token cache so we don't call
 * the proxy on every request. The proxy also caches server-side, so even
 * if the client cache misses, we won't spam Spotify.
 *
 * WHAT THIS MODULE HANDLES:
 * - Token fetching and caching
 * - Track search (with preview_url filtering)
 * - Artist search
 * - Genre/category browsing
 *
 * WHAT IT DOES NOT HANDLE:
 * - Playback (requires Premium + Web Playback SDK)
 * - User data (requires Authorization Code flow with user login)
 * - Full audio analysis (Spotify deprecated the audio-features endpoint)
 */

// ─── Types ────────────────────────────────────────────────────────────────

export interface SpotifyTrack {
  id: string
  name: string
  artists: { id: string; name: string }[]
  album: {
    id: string
    name: string
    images: { url: string; width: number; height: number }[]
    release_date: string
  }
  duration_ms: number
  preview_url: string | null
  external_urls: { spotify: string }
  popularity: number
}

export interface SpotifyArtist {
  id: string
  name: string
  genres: string[]
  images: { url: string; width: number; height: number }[]
  popularity: number
  followers: { total: number }
  external_urls: { spotify: string }
}

export interface TrackSearchResult {
  tracks: SpotifyTrack[]
  total: number
  hasMore: boolean
}

// ─── Token cache ──────────────────────────────────────────────────────────

let clientToken: string | null = null
let clientTokenExpiresAt = 0

async function getToken(): Promise<string> {
  const now = Date.now()

  // Return cached token if valid (60s buffer)
  if (clientToken && now < clientTokenExpiresAt - 60_000) {
    return clientToken
  }

  const res = await fetch('/api/spotify-token')

  if (!res.ok) {
    throw new Error(`Token proxy error: ${res.status}`)
  }

  const data = await res.json()

  // Client Credentials tokens last 3600 seconds (1 hour)
  clientToken = data.access_token
  clientTokenExpiresAt = now + 3_600_000

  return data.access_token
}

// ─── Request helper ───────────────────────────────────────────────────────

async function spotifyFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const token = await getToken()

  const url = new URL(`https://api.spotify.com/v1${path}`)
  if (params) {
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (res.status === 401) {
    // Token expired — clear cache and retry once
    clientToken = null
    return spotifyFetch<T>(path, params)
  }

  if (!res.ok) {
    throw new Error(`Spotify API error: ${res.status} on ${path}`)
  }

  return res.json()
}

// ─── API methods ──────────────────────────────────────────────────────────

/**
 * Search for tracks. Only returns tracks that have a preview_url —
 * tracks without previews can't be played in the demo.
 *
 * Note: Spotify's preview_url availability varies by region and catalogue.
 * Expect roughly 60–80% of tracks to have a preview on most markets.
 */
export async function searchTracks(
  query: string,
  offset = 0,
  limit = 20
): Promise<TrackSearchResult> {
  if (!query.trim()) return { tracks: [], total: 0, hasMore: false }

  const data = await spotifyFetch<{
    tracks: { items: SpotifyTrack[]; total: number; offset: number; limit: number }
  }>('/search', {
    q: query,
    type: 'track',
    limit: String(limit),
    offset: String(offset),
    market: 'GB', // Change to your market if needed
  })

  const allTracks = data.tracks.items
  const withPreviews = allTracks.filter(t => t.preview_url !== null)

  return {
    tracks: withPreviews,
    total: data.tracks.total,
    hasMore: offset + limit < data.tracks.total,
  }
}

/**
 * Search for artists.
 */
export async function searchArtists(query: string, limit = 10): Promise<SpotifyArtist[]> {
  if (!query.trim()) return []

  const data = await spotifyFetch<{
    artists: { items: SpotifyArtist[] }
  }>('/search', {
    q: query,
    type: 'artist',
    limit: String(limit),
  })

  return data.artists.items.filter(a => a.images.length > 0)
}

/**
 * Get full artist details including genres.
 */
export async function getArtist(artistId: string): Promise<SpotifyArtist> {
  return spotifyFetch<SpotifyArtist>(`/artists/${artistId}`)
}

/**
 * Get multiple artists in one request (max 50 IDs).
 */
export async function getArtists(artistIds: string[]): Promise<SpotifyArtist[]> {
  if (artistIds.length === 0) return []
  const ids = artistIds.slice(0, 50).join(',')
  const data = await spotifyFetch<{ artists: SpotifyArtist[] }>('/artists', { ids })
  return data.artists
}

/**
 * Get an artist's top tracks.
 */
export async function getArtistTopTracks(artistId: string): Promise<SpotifyTrack[]> {
  const data = await spotifyFetch<{ tracks: SpotifyTrack[] }>(
    `/artists/${artistId}/top-tracks`,
    { market: 'GB' }
  )
  return data.tracks.filter(t => t.preview_url !== null)
}

/**
 * Get the best available album art URL for a track.
 * Prefers medium size (300px) for performance.
 */
export function getAlbumArt(track: SpotifyTrack, size: 'small' | 'medium' | 'large' = 'medium'): string {
  const images = track.album.images
  if (images.length === 0) return ''

  // Spotify returns images sorted largest to smallest
  switch (size) {
    case 'large':  return images[0]?.url ?? ''
    case 'medium': return images[1]?.url ?? images[0]?.url ?? ''
    case 'small':  return images[2]?.url ?? images[1]?.url ?? ''
  }
}

/**
 * Format duration from milliseconds to m:ss string.
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}