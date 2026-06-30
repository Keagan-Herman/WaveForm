import { describe, it, expect } from 'vitest'
import {
  searchTracks,
  searchArtists,
  getTrack,
  formatDuration,
  isDeezerErrorBody,
} from './deezerApi'

describe('deezerApi', () => {
  describe('searchTracks', () => {
    it('should return tracks for a valid query', async () => {
      const result = await searchTracks('Daft Punk')
      expect(result.tracks.length).toBeGreaterThan(0)
      expect(result.tracks[0].title).toBeDefined()
      expect(result.tracks[0].source).toBe('deezer')
    })

    it('should return empty results for an empty query', async () => {
      const result = await searchTracks('')
      expect(result.tracks).toEqual([])
      expect(result.total).toBe(0)
    })
  })

  describe('searchArtists', () => {
    it('should return artists for a valid query', async () => {
      const artists = await searchArtists('Justice')
      expect(artists.length).toBeGreaterThan(0)
      expect(artists[0].name).toBeDefined()
    })
  })

  describe('getTrack', () => {
    it('should return track details for a valid ID', async () => {
      // "Harder, Better, Faster, Stronger" by Daft Punk
      const trackId = 3135556
      const track = await getTrack(trackId)
      expect(track.id).toBe(trackId)
      expect(track.title).toContain('Harder, Better, Faster, Stronger')
    })
  })

  describe('formatDuration', () => {
    it('formats seconds into mm:ss with leading zeros', () => {
      expect(formatDuration(0)).toBe('00:00')
      expect(formatDuration(60)).toBe('01:00')
      expect(formatDuration(65)).toBe('01:05')
      expect(formatDuration(3601)).toBe('60:01')
    })

    it('returns 00:00 for invalid input', () => {
      expect(formatDuration(-1)).toBe('00:00')
      expect(formatDuration(Infinity)).toBe('00:00')
    })
  })

  describe('isDeezerErrorBody', () => {
    it('returns true for a valid Deezer error body', () => {
      expect(isDeezerErrorBody({ error: { code: 800, message: 'No data' } })).toBe(true)
    })

    it('returns false when error is a string', () => {
      expect(isDeezerErrorBody({ error: 'something went wrong' })).toBe(false)
    })

    it('returns false when error lacks code', () => {
      expect(isDeezerErrorBody({ error: { message: 'No data' } })).toBe(false)
    })

    it('returns false when error is null', () => {
      expect(isDeezerErrorBody({ error: null })).toBe(false)
    })

    it('returns false when there is no error key', () => {
      expect(isDeezerErrorBody({ data: [] })).toBe(false)
    })
  })
})
