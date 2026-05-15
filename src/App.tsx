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
import { FrequencyBars } from '@/components/visualiser/FrequencyBars'
import { BackgroundPulse } from '@/components/visualiser/BackgroundPulse'
import { SearchOverlay } from '@/components/search/SearchOverlay'
import { NowPlaying } from '@/components/library/NowPlaying'
import { GenrePanel } from '@/components/library/GenrePanel'
import { AlbumGravityField } from '@/components/library/AlbumGravityField'
import { usePlayerStore } from '@/stores/playerStore'
import { useVisualiserStore } from '@/stores/visualiserStore'
import { useAlbumColour } from '@/hooks/useAlbumColour'
import { useResize } from '@/hooks/useResize'
import type { AlbumColour } from '@/hooks/useAlbumColour'
import type { DeezerTrack } from '@/types/track'
import { Spectrogram } from './components/visualiser/Spectrogram'
import { RadialVisualiser } from './components/visualiser/RadialVisualiser'
import { FullscreenOverlay } from './components/visualiser/FullscreenOverlay'
import { QuadrantErrorBoundary } from '@/components/ui/QuadrantErrorBoundary'
import { useUIStore } from '@/stores/uiStore'
import { ArtistPanel } from '@/components/search/ArtistPanel'
import { TrackTransitionOverlay } from '@/components/ui/TrackTransitionOverlay'

function useAppAccent(): AlbumColour {
  const currentTrack = usePlayerStore(state => state.currentTrack)
  const imageUrl = currentTrack
    ? currentTrack.source === 'local'
      ? currentTrack.album.cover
      : currentTrack.album.cover_medium
    : null
  return useAlbumColour(imageUrl)
}

// ─── Top-right: visualisers ────────────────────────────────────────────────

function VisualisersPanel({ accent }: { accent: AlbumColour }) {
  const isPlaying = usePlayerStore(state => state.isPlaying)

  return (
    <div style={{ ...styles.quadrant, overflowY: 'auto', ...styles.borderBottom }}>
      <div style={styles.quadLabel}>Visualisers</div>
      <div style={styles.visInner}>
        <div style={styles.canvasBlock}>
          <p style={styles.canvasLabel}>Spectrogram · hover for frequency</p>
          <Spectrogram width={680} height={160} accent={accent} />
        </div>

        <div style={styles.canvasBlock}>
          <p style={styles.canvasLabel}>Frequency Spectrum</p>
          <FrequencyBars width={680} height={160} mirrorMode accent={accent} />
        </div>

        {!isPlaying && (
          <div style={styles.idleOverlay}>
            <p style={styles.idleText}>Select a track to visualise</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Bottom-right: genre map ───────────────────────────────────────────────

function GenrePanelQuadrant({
  tracks,
  accent,
  onFilteredTracksChange,
}: {
  tracks: DeezerTrack[]
  accent: AlbumColour
  onFilteredTracksChange: (ids: string[] | null) => void
}) {
  return (
    <div style={{ ...styles.quadrant, overflowY: 'auto' }}>
      <div style={styles.quadLabel}>Genre Map</div>
      <div style={styles.genreInner}>
        {tracks.length > 0 ? (
          <GenrePanel
            tracks={tracks}
            width={680}
            onFilteredTracksChange={onFilteredTracksChange}
            accent={accent}
          />
        ) : (
          <div style={styles.stateWrap}>
            <p style={styles.stateIcon}>◈</p>
            <p style={styles.stateDesc}>Search for tracks to see genre relationships</p>
          </div>
        )}
      </div>
    </div>
  )
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

  const toggleFullscreen = useVisualiserStore(state => state.toggleFullscreen)
  const visualLayer = useVisualiserStore(state => state.visualLayer)
  const isLowQuality = useVisualiserStore(state => state.isLowQuality)
  const toggleLowQuality = useVisualiserStore(state => state.toggleLowQuality)

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
    if (!hasIntroPlayed) {
      const timer = setTimeout(() => {
        setHasIntroPlayed(true)
        sessionStorage.setItem('waveform_intro_played', 'true')
      }, 1200)
      return () => clearTimeout(timer)
    }
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

  const logoVariants: Variants = {
    hidden: { opacity: 0, letterSpacing: '0.1em' },
    visible: {
      opacity: 0.85,
      letterSpacing: '0.35em',
      transition: { duration: 1.5, ease: 'easeOut' },
    },
  }

  return (
    <div ref={containerRef} style={styles.root}>
      <BackgroundPulse accent={accent} />
      <PreviewPlayer />
      <KeyboardShortcuts />

      <header style={{ ...styles.header, borderBottomColor: `${accent.hex}28` }}>
        <motion.h1
          initial={hasIntroPlayed ? 'visible' : 'hidden'}
          animate="visible"
          variants={logoVariants}
          style={styles.logo}
        >
          Waveform
        </motion.h1>
        <div style={styles.headerMid}>
          <div
            style={{ ...styles.accentSwatch, background: accent.hex }}
            title={`Album colour: ${accent.hex}`}
          />
        </div>
        <div style={styles.headerSub}>
          <kbd style={{ ...styles.kbd, borderColor: `${accent.hex}44` }}>/</kbd> search ·{' '}
          <kbd style={{ ...styles.kbd, borderColor: `${accent.hex}44` }}>Space</kbd> play ·{' '}
          <kbd style={{ ...styles.kbd, borderColor: `${accent.hex}44` }}>←</kbd>{' '}
          <kbd style={{ ...styles.kbd, borderColor: `${accent.hex}44` }}>→</kbd> navigate ·{' '}
          <kbd style={{ ...styles.kbd, borderColor: `${accent.hex}44` }}>F</kbd> full ·{' '}
          <kbd style={{ ...styles.kbd, borderColor: `${accent.hex}44` }}>V</kbd> {visualLayer}
          <button
            onClick={toggleFullscreen}
            style={{ ...styles.headerBtn, borderColor: `${accent.hex}44`, color: accent.hex }}
          >
            Fullscreen
          </button>
          {filteredTrackIds && (
            <button
              onClick={() => setFilteredTrackIds(null)}
              style={{
                ...styles.headerBtn,
                borderColor: `${accent.hex}aa`,
                background: `${accent.hex}22`,
                color: '#fff',
              }}
            >
              Clear Filter ✕
            </button>
          )}
          <button
            onClick={toggleLowQuality}
            style={{
              ...styles.headerBtn,
              borderColor: `${accent.hex}44`,
              color: isLowQuality ? '#ff4444' : accent.hex,
            }}
          >
            {isLowQuality ? 'HQ Off' : 'HQ On'}
          </button>
        </div>
      </header>

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
          style={{ ...styles.quadrant, ...styles.borderRight, ...styles.borderBottom }}
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
          style={{ ...styles.quadrant, overflowY: 'auto', ...styles.borderBottom }}
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
          style={{ ...styles.quadrant, ...styles.borderRight, overflow: 'hidden' }}
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
          style={styles.quadrant}
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
  header: {
    height: HEADER_H,
    padding: '0 1.75rem',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    backdropFilter: 'blur(16px)',
    flexShrink: 0,
    zIndex: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    transition: 'border-color 1s ease',
  },
  logo: {
    fontSize: '0.85rem',
    letterSpacing: '0.35em',
    textTransform: 'uppercase',
    opacity: 0.85,
    fontWeight: 500,
    flexShrink: 0,
  },
  headerMid: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
  },
  accentSwatch: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    transition: 'background 1s ease',
    flexShrink: 0,
  },
  headerSub: {
    fontSize: '0.65rem',
    letterSpacing: '0.05em',
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    flexShrink: 0,
    color: 'var(--text-dim)',
  },
  headerBtn: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid',
    borderRadius: '4px',
    padding: '0.2rem 0.5rem',
    fontSize: '0.65rem',
    cursor: 'pointer',
    fontFamily: 'monospace',
    marginLeft: '0.5rem',
    textTransform: 'uppercase',
    transition: 'all 0.2s ease',
  },
  kbd: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '3px',
    padding: '0.08rem 0.3rem',
    fontSize: '0.65rem',
    fontFamily: 'monospace',
    transition: 'border-color 1s ease',
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
  borderRight: { borderRight: '1px solid rgba(255,255,255,0.07)' },
  borderBottom: { borderBottom: '1px solid rgba(255,255,255,0.07)' },
  quadLabel: {
    fontSize: '0.65rem',
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    opacity: 0.2,
    padding: '0.5rem 1rem 0.25rem',
    flexShrink: 0,
    fontFamily: 'monospace',
  },
  visInner: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    padding: '0.5rem 1.25rem 1.25rem',
    flex: 1,
    position: 'relative',
  },
  genreInner: {
    flex: 1,
    padding: '0 1.25rem 1.25rem',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  idleOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(3px)',
    pointerEvents: 'none',
    zIndex: 5,
  },
  idleText: {
    opacity: 0.2,
    fontSize: '0.75rem',
    letterSpacing: '0.12em',
  },
  canvasBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.3rem',
    background: 'rgba(0,0,0,0.2)',
    padding: '0.75rem',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    backdropFilter: 'blur(8px)',
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
  canvasLabel: {
    fontSize: '0.6rem',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    opacity: 0.3,
    fontFamily: 'monospace',
  },
  stateWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: '0.5rem',
    opacity: 0.3,
    textAlign: 'center',
  },
  stateIcon: { fontSize: '1.5rem' },
  stateDesc: {
    fontSize: '0.72rem',
    lineHeight: 1.6,
    maxWidth: 220,
    fontFamily: 'monospace',
  },
}
