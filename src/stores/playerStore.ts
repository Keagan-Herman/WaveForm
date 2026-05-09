/**
 * playerStore.ts
 *
 * Zustand store for all playback state.
 *
 * RESPONSIBILITIES:
 * - Current track
 * - Play/pause state
 * - Queue management
 * - Progress tracking (updated imperatively, not via React state)
 *
 * WHAT DOES NOT LIVE HERE:
 * - The actual HTMLAudioElement — that lives in PreviewPlayer via a ref
 * - Frequency/beat data — that lives in visualiserStore
 * - The AudioEngine instance — that's a singleton imported directly
 */

/**
 * playerStore.ts — Deezer version
 *
 * Identical structure to the Spotify version.
 * Only change: SpotifyTrack → DeezerTrack
 */

import { create } from 'zustand'
import type { DeezerTrack } from '@/lib/deezerApi'

interface PlayerStore {
  currentTrack: DeezerTrack | null
  isPlaying: boolean
  isLoading: boolean
  progress: number
  duration: number
  queue: DeezerTrack[]
  queueIndex: number
  isTransitioning: boolean

  setTrack: (track: DeezerTrack) => void
  setIsPlaying: (playing: boolean) => void
  setIsLoading: (loading: boolean) => void
  setProgress: (progress: number) => void
  setDuration: (duration: number) => void
  setQueue: (tracks: DeezerTrack[], startIndex?: number) => void
  nextTrack: () => DeezerTrack | null
  prevTrack: () => DeezerTrack | null
  playTrackByAlbumId: (albumId: number) => void
  clearQueue: () => void
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  isLoading: false,
  progress: 0,
  duration: 0,
  queue: [],
  queueIndex: 0,
  isTransitioning: false,

  setTrack: track => {
    set({ currentTrack: track, progress: 0, isTransitioning: true })
    setTimeout(() => {
      set({ isTransitioning: false })
    }, 2000)
  },
  setIsPlaying: isPlaying => set({ isPlaying }),
  setIsLoading: isLoading => set({ isLoading }),
  setProgress: progress => set({ progress }),
  setDuration: duration => set({ duration }),

  setQueue: (tracks, startIndex = 0) =>
    set({ queue: tracks, queueIndex: startIndex }),

  nextTrack: () => {
    const { queue, queueIndex } = get()
    const nextIndex = queueIndex + 1
    if (nextIndex >= queue.length) return null
    const next = queue[nextIndex]
    set({ queueIndex: nextIndex, currentTrack: next, progress: 0, isTransitioning: true })
    setTimeout(() => set({ isTransitioning: false }), 2000)
    return next
  },

  prevTrack: () => {
    const { queue, queueIndex } = get()
    const prevIndex = queueIndex - 1
    if (prevIndex < 0) return null
    const prev = queue[prevIndex]
    set({ queueIndex: prevIndex, currentTrack: prev, progress: 0, isTransitioning: true })
    setTimeout(() => set({ isTransitioning: false }), 2000)
    return prev
  },

  playTrackByAlbumId: (albumId: number) => {
    const { queue } = get()
    const trackIndex = queue.findIndex(t => t.album.id === albumId)
    if (trackIndex !== -1) {
      set({
        queueIndex: trackIndex,
        currentTrack: queue[trackIndex],
        progress: 0,
        isPlaying: true
      })
    }
  },

  clearQueue: () => set({ queue: [], queueIndex: 0 }),
}))