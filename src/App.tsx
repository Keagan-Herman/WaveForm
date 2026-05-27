/**
 * App.tsx — full AlbumColour propagation
 *
 * All visualiser components now receive the full AlbumColour object
 * instead of just accentHue or accentColour string.
 * This gives each component the lightness and saturation context
 * it needs to render correctly for any album type.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { AudioProvider } from '@/audio/AudioContext'
import { PreviewPlayer } from '@/components/player/PreviewPlayer'
import { PlayerBar } from '@/components/player/PlayerBar'
import { BackgroundPulse } from '@/components/visualiser/BackgroundPulse'
import { SearchOverlay } from '@/components/search/SearchOverlay'
import { NowPlaying } from '@/components/library/NowPlaying'
import { AlbumGravityField } from '@/components/library/AlbumGravityField'
import { usePlayerStore } from '@/stores/playerStore'
import { useVisualiserStore } from '@/stores/visualiserStore'
import { useAlbumColour } from '@/hooks/useAlbumColour'
import { useResize } from '@/hooks/useResize'
import type { AlbumColour } from '@/hooks/useAlbumColour'
import type { DeezerTrack } from '@/types/track'
import { RadialVisualiser } from './components/visualiser/RadialVisualiser'
import { FullscreenOverlay } from './components/visualiser/FullscreenOverlay'
import { QuadrantErrorBoundary } from '@/components/ui/QuadrantErrorBoundary'
import { useUIStore } from '@/stores/uiStore'
import { ArtistPanel } from '@/components/search/ArtistPanel'
import { TrackTransitionOverlay } from '@/components/ui/TrackTransitionOverlay'
import { hexToRgb } from '@/utils/color'

// Layout components
import { Header } from '@/components/layout/Header'
import { VisualisersPanel } from '@/components/layout/VisualisersPanel'
import { GenrePanelQuadrant } from '@/components/layout/GenrePanelQuadrant'

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
  const { width } = useResize(containerRef)
  const isMobile = (width || window.innerWidth) < 900

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

  const quadrantVariants: Variants = {
    hidden: (custom: string) => ({
      opacity: 0,
      x: custom.includes('left') ? -60 : 60,
      y: custom.includes('top') ? -60 : 60,
    }),
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
    },
  }

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

      <div
        style={{
          ...styles.grid,
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gridTemplateRows: isMobile ? 'repeat(4, auto)' : '1fr 1fr',
          overflowY: isMobile ? 'auto' : 'hidden',
        }}
      >
        {/* Top-left: library */}
        <motion.div
          initial={hasIntroPlayed ? 'visible' : 'hidden'}
          animate="visible"
          custom="top-left"
          variants={quadrantVariants}
          style={{
            ...styles.quadrant,
            ...styles.borderRight,
            ...styles.borderBottom,
            borderColor: 'var(--reactive-border, var(--border-color))',
          }}
        >
          <div style={styles.quadLabel}>Library</div>
          <QuadrantErrorBoundary label="Library" accent={accent.hex}>
            <SearchOverlay
              onResultsChange={setSearchTracks}
              filteredTrackIds={filteredTrackIds}
              accentColour={accent.hex}
            />
          </QuadrantErrorBoundary>
        </motion.div>

        {/* Top-right: visualisers or Hero Scene */}
        <motion.div
          initial={hasIntroPlayed ? 'visible' : 'hidden'}
          animate="visible"
          custom="top-right"
          variants={quadrantVariants}
          style={{
            ...styles.quadrant,
            overflowY: 'auto',
            ...styles.borderBottom,
            borderColor: 'var(--reactive-border, var(--border-color))',
          }}
        >
          <div style={styles.quadLabel}>{isPlaying ? 'Hero Scene' : 'Visualisers'}</div>
          <QuadrantErrorBoundary
            label={isPlaying ? 'Hero Scene' : 'Visualisers'}
            accent={accent.hex}
          >
            {isPlaying ? (
              <div style={styles.heroSceneWrap}>
                <AlbumGravityField tracks={searchTracks} width={680} height={340} accent={accent} />
                <div style={styles.heroOverlay}>
                  <RadialVisualiser width={300} height={300} accent={accent} />
                </div>
              </div>
            ) : (
              <VisualisersPanel accent={accent} />
            )}
          </QuadrantErrorBoundary>
        </motion.div>

        {/* Bottom-left: now playing */}
        <motion.div
          initial={hasIntroPlayed ? 'visible' : 'hidden'}
          animate="visible"
          custom="bottom-left"
          variants={quadrantVariants}
          style={{
            ...styles.quadrant,
            ...styles.borderRight,
            overflow: 'hidden',
            borderColor: 'var(--reactive-border, var(--border-color))',
          }}
        >
          <div style={styles.quadLabel}>Now Playing</div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <QuadrantErrorBoundary label="Now Playing" accent={accent.hex}>
              <NowPlaying accent={accent} />
            </QuadrantErrorBoundary>
          </div>
        </motion.div>

        {/* Bottom-right: genre map */}
        <motion.div
          initial={hasIntroPlayed ? 'visible' : 'hidden'}
          animate="visible"
          custom="bottom-right"
          variants={quadrantVariants}
          style={{
            ...styles.quadrant,
            borderColor: 'var(--reactive-border, var(--border-color))',
          }}
        >
          <QuadrantErrorBoundary label="Genre Map" accent={accent.hex}>
            <GenrePanelQuadrant
              tracks={searchTracks}
              onFilteredTracksChange={handleFilteredTracksChange}
              accent={accent}
            />
          </QuadrantErrorBoundary>
        </motion.div>
      </div>

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

const HEADER_H = 46
const PLAYER_H = 70

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
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: '1fr 1fr',
    height: `calc(100vh - ${HEADER_H}px - ${PLAYER_H}px)`,
    overflow: 'hidden',
  },
  quadrant: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  },
  borderRight: { borderRight: '1px solid var(--border-color)' },
  borderBottom: { borderBottom: '1px solid var(--border-color)' },
  quadLabel: {
    fontSize: '0.65rem',
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    opacity: 0.2,
    padding: '0.5rem 1rem 0.25rem',
    flexShrink: 0,
    fontFamily: 'monospace',
  },
  heroSceneWrap: {
    position: 'relative',
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroOverlay: {
    position: 'absolute',
    pointerEvents: 'none',
    zIndex: 5,
    opacity: 0.7,
  },
}
