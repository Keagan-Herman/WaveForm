import { describe, it, expect } from 'vitest'
import { searchTracks, searchArtists, getTrack, formatDuration } from './deezerApi'

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
    it('should format seconds into m:ss', () => {
      expect(formatDuration(0)).toBe('0:00')
      expect(formatDuration(60)).toBe('1:00')
      expect(formatDuration(65)).toBe('1:05')
      expect(formatDuration(3601)).toBe('60:01')
    })
  })
})
