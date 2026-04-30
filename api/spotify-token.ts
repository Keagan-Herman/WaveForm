/**
 * api/spotify-token.ts
 *
 * Vercel serverless function that proxies the Spotify Client Credentials
 * token exchange. The client secret never touches the browser bundle.
 *
 * The client calls GET /api/spotify-token and receives an access token.
 * This function calls Spotify's token endpoint server-side using the
 * secret stored as a Vercel environment variable.
 *
 * ENVIRONMENT VARIABLES REQUIRED (set in Vercel dashboard + .env.local):
 * - SPOTIFY_CLIENT_ID      (no VITE_ prefix — server only)
 * - SPOTIFY_CLIENT_SECRET  (no VITE_ prefix — server only)
 *
 * Note: VITE_SPOTIFY_CLIENT_ID is also set (with prefix) for client-side
 * use where only the ID is needed (e.g. constructing auth URLs).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'

// Simple in-memory cache — persists for the lifetime of the function instance.
// Vercel reuses warm instances, so this meaningfully reduces token requests.
let cachedToken: string | null = null
let tokenExpiresAt = 0

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Return cached token if still valid (with 60s buffer)
  const now = Date.now()
  if (cachedToken && now < tokenExpiresAt - 60_000) {
    return res.status(200).json({ access_token: cachedToken })
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.error('Missing Spotify credentials in environment')
    return res.status(500).json({ error: 'Server misconfiguration' })
  }

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    const response = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('Spotify token error:', response.status, text)
      return res.status(502).json({ error: 'Failed to fetch token from Spotify' })
    }

    const data = await response.json()

    // Cache the token
    cachedToken = data.access_token
    tokenExpiresAt = now + data.expires_in * 1000 // expires_in is in seconds

    // Tell the browser not to cache this response — token management
    // is handled server-side only
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ access_token: data.access_token })
  } catch (err) {
    console.error('Token proxy error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}