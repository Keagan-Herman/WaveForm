import { describe, it, expect, beforeEach } from 'vitest'
import { usePlayerStore } from './playerStore'
import { DeezerTrack } from '../lib/deezerApi'

const mockTrack: DeezerTrack = {
  id: 1,
  title: 'Test Track',
  duration: 180,
  preview: 'https://test.com/preview.mp3',
  artist: { id: 1, name: 'Test Artist', picture_medium: '', picture_big: '' },
  album: { id: 1, title: 'Test Album', cover_medium: '', cover_big: '' },
  source: 'deezer',
  rank: 1000,
  explicit_lyrics: false,
}

const mockTrack2: DeezerTrack = {
  ...mockTrack,
  id: 2,
  title: 'Test Track 2',
}

describe('playerStore', () => {
  beforeEach(() => {
    usePlayerStore.getState().clearQueue()
    usePlayerStore.setState({ currentTrack: null, isPlaying: false, currentTime: 0 })
  })

  it('should initialize with default state', () => {
    const state = usePlayerStore.getState()
    expect(state.currentTrack).toBeNull()
    expect(state.isPlaying).toBe(false)
    expect(state.queue).toEqual([])
  })

  it('should set track and start playing', () => {
    usePlayerStore.getState().setTrack(mockTrack)
    const state = usePlayerStore.getState()
    expect(state.currentTrack).toEqual(mockTrack)
    expect(state.isPlaying).toBe(true)
    expect(state.currentTime).toBe(0)
  })

  it('should toggle playback', () => {
    usePlayerStore.getState().play()
    expect(usePlayerStore.getState().isPlaying).toBe(true)
    usePlayerStore.getState().pause()
    expect(usePlayerStore.getState().isPlaying).toBe(false)
    usePlayerStore.getState().togglePlay()
    expect(usePlayerStore.getState().isPlaying).toBe(true)
  })

  it('should manage queue', () => {
    usePlayerStore.getState().addToQueue(mockTrack)
    usePlayerStore.getState().addToQueue(mockTrack2)
    expect(usePlayerStore.getState().queue).toHaveLength(2)

    usePlayerStore.getState().clearQueue()
    expect(usePlayerStore.getState().queue).toHaveLength(0)
  })

  it('should navigate tracks', () => {
    usePlayerStore.getState().addToQueue(mockTrack)
    usePlayerStore.getState().addToQueue(mockTrack2)
    usePlayerStore.getState().setTrack(mockTrack)

    usePlayerStore.getState().nextTrack()
    expect(usePlayerStore.getState().currentTrack?.id).toBe(2)

    usePlayerStore.getState().nextTrack()
    expect(usePlayerStore.getState().currentTrack?.id).toBe(1) // Circular

    usePlayerStore.getState().prevTrack()
    expect(usePlayerStore.getState().currentTrack?.id).toBe(2)
  })

  it('should restart track if currentTime > 3 on prevTrack', () => {
    usePlayerStore.getState().addToQueue(mockTrack)
    usePlayerStore.getState().addToQueue(mockTrack2)
    usePlayerStore.getState().setTrack(mockTrack2)
    usePlayerStore.setState({ currentTime: 5 })

    usePlayerStore.getState().prevTrack()
    expect(usePlayerStore.getState().currentTrack?.id).toBe(2)
    expect(usePlayerStore.getState().currentTime).toBe(0)
  })
})
