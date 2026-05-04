/**
 * App.tsx — Phase 7
 *
 * Final feature-complete layout. Adds GenrePanel to the visualiser column.
 * Genre selection feeds filtered track IDs back up to SearchOverlay
 * so matching tracks are highlighted in the results list.
 *
 * FULL DATA FLOW:
 * SearchOverlay → onResultsChange → searchTracks state (App)
 *   → AlbumGravityField (R3F album art)
 *   → GenrePanel → useGenreGraph → fetches artist data → builds graph
 *     → onFilteredTracksChange → filteredTrackIds state (App)
 *       → SearchOverlay → highlights matching TrackRows
 *
 * THREE RENDER LOOPS CONFIRMED:
 * 1. rAF canvas loop — FrequencyBars + WaveformLine
 * 2. R3F useFrame loop — AlbumGravityField
 * 3. D3 simulation tick — GenreForceGraph (not rAF-based, D3 manages its own timer)
 * All three are independent. No shared mutable state between them.
 */
/**
 * 
 * App.tsx — Deezer version
 *
 * Changes from Spotify version:
 * - SpotifyTrack → DeezerTrack throughout
 * - No Spotify credentials, no token proxy
 * - Everything else identical
 */

/**
 * App.tsx — enhanced "wow" version
 *
 * WHAT CHANGED:
 * - AlbumGravityField removed — R3F dependency conflicts + it wasn't earning its space
 * - RadialVisualiser added as the visual hero — full-width polar frequency plot
 * - Spectrogram added — scrolling frequency-over-time heatmap
 * - Dynamic colour theming from album art via useAlbumColour
 * - All colours, visualisers, and background pulse themed to current album
 * - Contrast fixed throughout — text opacity bumped up significantly
 * - Genre panel now in a scrollable area so it's always reachable
 * - Layout remains three-panel but visualiser centre is now dominant
 */

import React, { useEffect, useState, useCallback } from 'react'
import { AudioProvider } from '@/audio/AudioContext'
import { PreviewPlayer } from '@/components/player/PreviewPlayer'
import { PlayerBar } from '@/components/player/PlayerBar'
import { FrequencyBars } from '@/components/visualiser/FrequencyBars'
import { WaveformLine } from '@/components/visualiser/WaveformLine'
import { BackgroundPulse } from '@/components/visualiser/BackgroundPulse'
import { RadialVisualiser } from '@/components/visualiser/RadialVisualiser'
import { SearchOverlay } from '@/components/search/SearchOverlay'
import { NowPlaying } from '@/components/library/NowPlaying'
import { GenrePanel } from '@/components/library/GenrePanel'
import { usePlayerStore } from '@/stores/playerStore'
import { useVisualiserStore } from '@/stores/visualiserStore'
import { useAlbumColour } from '@/hooks/useAlbumColour'
import type { DeezerTrack } from '@/lib/deezerApi'
import { Spectrogram } from './components/visualiser/Spectogram'

// ─── Colour context ────────────────────────────────────────────────────────
// Lifted to app root so all panels share the same derived accent colour

function useAppAccent() {
  const currentTrack = usePlayerStore(state => state.currentTrack)
  const imageUrl = currentTrack?.album.cover_medium ?? null
  return useAlbumColour(imageUrl)
}

// ─── Visualiser centre panel ───────────────────────────────────────────────

interface VisualiserPanelProps {
  tracks: DeezerTrack[]
  onFilteredTracksChange: (ids: string[] | null) => void
  accentHue: number
  accentColour: string
}

function VisualiserPanel({
  tracks,
  onFilteredTracksChange,
  accentHue,
  accentColour,
}: VisualiserPanelProps) {
  const isPlaying = usePlayerStore(state => state.isPlaying)
  const bassPower = useVisualiserStore(state => state.bassPower)
  const beat = useVisualiserStore(state => state.beat)

  return (
    <div style={styles.visualiserPanel}>
      <div style={styles.visualiserInner}>

        {/* Radial — the hero. Centre stage. */}
        <div style={styles.radialWrap}>
          <RadialVisualiser
            size={280}
            accentColour={accentColour}
            accentHue={accentHue}
          />
          {!isPlaying && (
            <div style={styles.radialIdle}>
              <p style={styles.idleText}>Select a track to visualise</p>
            </div>
          )}
        </div>

        {/* Frequency bars */}
        <div style={styles.canvasBlock}>
          <p style={styles.canvasLabel}>Frequency Spectrum</p>
          <FrequencyBars
            width={560}
            height={100}
            mirrorMode
            accentHue={accentHue}
          />
        </div>

        {/* Spectrogram */}
        <div style={styles.canvasBlock}>
          <p style={styles.canvasLabel}>Spectrogram</p>
          <Spectrogram
            width={560}
            height={90}
            accentHue={accentHue}
          />
        </div>

        {/* Waveform */}
        <div style={styles.canvasBlock}>
          <p style={styles.canvasLabel}>Waveform</p>
          <WaveformLine width={560} height={44} />
        </div>

        {/* Bass energy */}
        <div style={styles.canvasBlock}>
          <p style={styles.canvasLabel}>Bass Energy</p>
          <div style={styles.bassTrack}>
            <div style={{
              ...styles.bassFill,
              width: `${bassPower * 100}%`,
              background: beat
                ? `hsl(${accentHue}, 100%, 70%)`
                : accentColour,
              boxShadow: beat ? `0 0 12px ${accentColour}` : 'none',
              transition: beat
                ? 'width 0.05s, background 0.05s, box-shadow 0.05s'
                : 'width 0.1s linear, background 0.5s',
            }} />
          </div>
        </div>

        {/* Genre map */}
        {tracks.length > 0 && (
          <>
            <div style={styles.divider} />
            <GenrePanel
              tracks={tracks}
              width={560}
              onFilteredTracksChange={onFilteredTracksChange}
            />
          </>
        )}
      </div>
    </div>
  )
}

// ─── Keyboard shortcuts ────────────────────────────────────────────────────

function KeyboardShortcuts() {
  const { isPlaying, setIsPlaying, currentTrack, nextTrack, prevTrack } = usePlayerStore()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      switch (e.key) {
        case ' ':
          e.preventDefault()
          if (currentTrack) setIsPlaying(!isPlaying)
          break
        case 'ArrowRight':
          e.preventDefault()
          nextTrack()
          break
        case 'ArrowLeft':
          e.preventDefault()
          prevTrack()
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPlaying, currentTrack, setIsPlaying, nextTrack, prevTrack])

  return null
}

// ─── Root ──────────────────────────────────────────────────────────────────

function Waveform() {
  const [searchTracks, setSearchTracks] = useState<DeezerTrack[]>([])
  const [filteredTrackIds, setFilteredTrackIds] = useState<string[] | null>(null)
  const accent = useAppAccent()

  const handleFilteredTracksChange = useCallback((ids: string[] | null) => {
    setFilteredTrackIds(ids)
  }, [])

  return (
    <div style={styles.root}>
      <BackgroundPulse accentHue={accent.h} accentSaturation={accent.s} />
      <PreviewPlayer />
      <KeyboardShortcuts />

      <header style={{
        ...styles.header,
        borderBottomColor: `${accent.hex}22`,
      }}>
        <h1 style={styles.logo}>Waveform</h1>
        <p style={styles.headerSub}>
          <kbd style={{ ...styles.kbd, borderColor: `${accent.hex}33` }}>/</kbd> search ·{' '}
          <kbd style={{ ...styles.kbd, borderColor: `${accent.hex}33` }}>Space</kbd> play ·{' '}
          <kbd style={{ ...styles.kbd, borderColor: `${accent.hex}33` }}>←</kbd>{' '}
          <kbd style={{ ...styles.kbd, borderColor: `${accent.hex}33` }}>→</kbd> navigate
        </p>
      </header>

      <div style={styles.layout}>
        <div style={styles.leftPanel}>
          <SearchOverlay
            onResultsChange={setSearchTracks}
            filteredTrackIds={filteredTrackIds}
            accentColour={accent.hex}
          />
        </div>

        <VisualiserPanel
          tracks={searchTracks}
          onFilteredTracksChange={handleFilteredTracksChange}
          accentHue={accent.h}
          accentColour={accent.hex}
        />

        <div style={{
          ...styles.rightPanel,
          borderLeftColor: `${accent.hex}22`,
        }}>
          <NowPlaying accentColour={accent} />
        </div>
      </div>

      <PlayerBar accentColour={accent.hex} />
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
    minHeight: '100vh',
    color: '#f0f0f0',
    fontFamily: 'monospace',
    display: 'flex',
    flexDirection: 'column',
    paddingBottom: 72,
  },
  header: {
    padding: '0.85rem 2rem',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    backdropFilter: 'blur(16px)',
    position: 'sticky',
    top: 0,
    zIndex: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    transition: 'border-color 1s ease',
  },
  logo: {
    fontSize: '0.9rem',
    letterSpacing: '0.35em',
    textTransform: 'uppercase',
    opacity: 0.8,
    fontWeight: 500,
    flexShrink: 0,
  },
  headerSub: {
    fontSize: '0.62rem',
    opacity: 0.4,
    letterSpacing: '0.06em',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  kbd: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '3px',
    padding: '0.1rem 0.35rem',
    fontSize: '0.6rem',
    fontFamily: 'monospace',
    transition: 'border-color 1s ease',
  },
  layout: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '320px 1fr 260px',
    overflow: 'hidden',
    height: 'calc(100vh - 48px - 72px)',
  },
  leftPanel: {
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid rgba(255,255,255,0.06)',
  },
  rightPanel: {
    overflow: 'hidden',
    borderLeft: '1px solid rgba(255,255,255,0.06)',
    transition: 'border-color 1s ease',
  },

  // Visualiser
  visualiserPanel: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '1.25rem 1.75rem',
    overflowY: 'auto',
  },
  visualiserInner: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
    width: '100%',
  },

  // Radial hero
  radialWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    padding: '0.5rem 0',
  },
  radialIdle: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(2px)',
    pointerEvents: 'none',
  },
  idleText: {
    opacity: 0.25,
    fontSize: '0.78rem',
    letterSpacing: '0.12em',
  },

  canvasBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  canvasLabel: {
    fontSize: '0.56rem',
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    opacity: 0.35,
    fontFamily: 'monospace',
  },
  divider: {
    height: 1,
    background: 'rgba(255,255,255,0.06)',
    margin: '0.15rem 0',
  },
  bassTrack: {
    height: 4,
    background: 'rgba(255,255,255,0.07)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  bassFill: {
    height: '100%',
    borderRadius: 2,
  },
}