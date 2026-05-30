/**
 * App.tsx — Modular layout
 *
 * Integrated with MainGrid for the core quadrant UI.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import { AudioProvider } from '@/audio/AudioContext'
import { PreviewPlayer } from '@/components/player/PreviewPlayer'
import { PlayerBar } from '@/components/player/PlayerBar'
import { BackgroundPulse } from '@/components/visualiser/BackgroundPulse'
import { usePlayerStore } from '@/stores/playerStore'
import { useVisualiserStore } from '@/stores/visualiserStore'
import { useAlbumColour } from '@/hooks/useAlbumColour'
import { useResize } from '@/hooks/useResize'
import type { AlbumColour } from '@/hooks/useAlbumColour'
import type { DeezerTrack } from '@/types/track'
import { FullscreenOverlay } from './components/visualiser/FullscreenOverlay'
import { useUIStore } from '@/stores/uiStore'
import { ArtistPanel } from '@/components/search/ArtistPanel'
import { TrackTransitionOverlay } from '@/components/ui/TrackTransitionOverlay'
import { hexToRgb } from '@/utils/color'

// Layout components
import { Header } from '@/components/layout/Header'
import { MainGrid } from '@/components/layout/MainGrid'

function useAppAccent(): AlbumColour {
  const currentTrack = usePlayerStore(state => state.currentTrack)
  const imageUrl = currentTrack
    ? currentTrack.source === 'local'
      ? currentTrack.album.cover
      : currentTrack.album.cover_medium
    : null
  return useAlbumColour(imageUrl)
}

// ─── Keyboard shortcuts ────────────────────────────────────────────────────

function KeyboardShortcuts() {
  const isPlaying = usePlayerStore(state => state.isPlaying)
  const play = usePlayerStore(state => state.play)
  const pause = usePlayerStore(state => state.pause)
  const currentTrack = usePlayerStore(state => state.currentTrack)
  const nextTrack = usePlayerStore(state => state.nextTrack)
  const prevTrack = usePlayerStore(state => state.prevTrack)

  const toggleFullscreen = useVisualiserStore(state => state.toggleFullscreen)
  const cycleVisualLayer = useVisualiserStore(state => state.cycleVisualLayer)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault()
          if (currentTrack) {
            if (isPlaying) pause()
            else play()
          }
          break
        case 'arrowright':
          e.preventDefault()
          nextTrack()
          break
        case 'arrowleft':
          e.preventDefault()
          prevTrack()
          break
        case 'f':
          e.preventDefault()
          toggleFullscreen()
          break
        case 'v':
          e.preventDefault()
          cycleVisualLayer()
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    isPlaying,
    currentTrack,
    play,
    pause,
    nextTrack,
    prevTrack,
    toggleFullscreen,
    cycleVisualLayer,
  ])
  return null
}

// ─── Root ──────────────────────────────────────────────────────────────────

function Waveform() {
  const containerRef = useRef<HTMLDivElement>(null)
  useResize(containerRef)

  const [searchTracks, setSearchTracks] = useState<DeezerTrack[]>([])
  const [filteredTrackIds, setFilteredTrackIds] = useState<string[] | null>(null)
  const [hasIntroPlayed, setHasIntroPlayed] = useState(() => {
    if (typeof sessionStorage === 'undefined') return false
    return !!sessionStorage.getItem('waveform_intro_played')
  })
  const accent = useAppAccent()

  const visualLayer = useVisualiserStore(state => state.visualLayer)

  const isPlaying = usePlayerStore(state => state.isPlaying)
  const currentTrack = usePlayerStore(state => state.currentTrack)
  const selectedArtistId = useUIStore(state => state.selectedArtistId)

  useEffect(() => {
    if (!currentTrack) {
      document.title = 'Waveform'
      return
    }
    const status = isPlaying ? '▶' : '⏸'
    document.title = `${status} ${currentTrack.title} · ${currentTrack.artist.name} | Waveform`
  }, [currentTrack, isPlaying])

  useEffect(() => {
    if (hasIntroPlayed) return

    const timer = setTimeout(() => {
      setHasIntroPlayed(true)
      sessionStorage.setItem('waveform_intro_played', 'true')
    }, 1200)
    return () => clearTimeout(timer)
  }, [hasIntroPlayed])

  // Inject CSS variables for global skinning
  useEffect(() => {
    const root = document.documentElement
    const { palette } = accent
    root.style.setProperty('--bg-color', palette.background)
    root.style.setProperty('--surface-color', palette.surface)
    root.style.setProperty('--primary-color', palette.primary)
    root.style.setProperty('--secondary-color', palette.secondary)
    root.style.setProperty('--accent-color', palette.accent)
    root.style.setProperty('--text-color', palette.text)
    root.style.setProperty('--text-dim', palette.textDim)
    root.style.setProperty('--border-color', palette.border)
  }, [accent])

  // Reactive border color based on bass power — updated imperatively to avoid root re-renders
  useEffect(() => {
    const root = document.documentElement
    const rgb = hexToRgb(accent.hex)

    if (!rgb) {
      root.style.setProperty('--reactive-border', 'var(--border-color)')
      return
    }

    const unsubscribe = useVisualiserStore.subscribe(
      state => state.bassPower,
      bassPower => {
        if (!isPlaying) {
          root.style.setProperty('--reactive-border', 'var(--border-color)')
          return
        }
        const alpha = 0.1 + bassPower * 0.3
        root.style.setProperty('--reactive-border', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`)
      }
    )
    return unsubscribe
  }, [accent.hex, isPlaying])

  const handleFilteredTracksChange = useCallback((ids: string[] | null) => {
    setFilteredTrackIds(ids)
  }, [])

  return (
    <div ref={containerRef} style={styles.root}>
      <BackgroundPulse accent={accent} />
      <PreviewPlayer />
      <KeyboardShortcuts />

      <Header
        accent={accent}
        hasIntroPlayed={hasIntroPlayed}
        visualLayer={visualLayer}
        filteredTrackIds={filteredTrackIds}
        onClearFilter={() => setFilteredTrackIds(null)}
      />

      <MainGrid
        accent={accent}
        hasIntroPlayed={hasIntroPlayed}
        searchTracks={searchTracks}
        filteredTrackIds={filteredTrackIds}
        handleFilteredTracksChange={handleFilteredTracksChange}
        onSearchTracksChange={setSearchTracks}
      />

      <PlayerBar accent={accent} />
      <TrackTransitionOverlay accent={accent} />

      <AnimatePresence>
        {selectedArtistId !== null && (
          <ArtistPanel
            artistId={selectedArtistId}
            accentColour={accent.hex}
            onClose={() => useUIStore.getState().setSelectedArtistId(null)}
          />
        )}
      </AnimatePresence>

      <FullscreenOverlay accent={accent} isPlaying={isPlaying} tracks={searchTracks} />
    </div>
  )
}

export default function App() {
  return (
    <AudioProvider>
      <Waveform />
    </AudioProvider>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    height: '100vh',
    backgroundColor: 'var(--bg-color, #050505)',
    color: 'var(--text-color, #f0f0f0)',
    fontFamily: 'monospace',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundImage: 'radial-gradient(circle at top right, var(--surface-color), transparent)',
  },
}
