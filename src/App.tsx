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

import { useEffect, useState, useCallback } from 'react'
import { AudioProvider } from '@/audio/AudioContext'
import { PreviewPlayer } from '@/components/player/PreviewPlayer'
import { PlayerBar } from '@/components/player/PlayerBar'
import { FrequencyBars } from '@/components/visualiser/FrequencyBars'
import { WaveformLine } from '@/components/visualiser/WaveformLine'
import { BackgroundPulse } from '@/components/visualiser/BackgroundPulse'
import { SearchOverlay } from '@/components/search/SearchOverlay'
import { NowPlaying } from '@/components/library/NowPlaying'
import { AlbumGravityField } from '@/components/library/AlbumGravityField'
import { GenrePanel } from '@/components/library/GenrePanel'
import { usePlayerStore } from '@/stores/playerStore'
import { useVisualiserStore } from '@/stores/visualiserStore'
import type { SpotifyTrack } from '@/lib/spotifyApi'

// ─── Visualiser centre panel ───────────────────────────────────────────────

interface VisualiserPanelProps {
  tracks: SpotifyTrack[]
  onFilteredTracksChange: (ids: string[] | null) => void
}

function VisualiserPanel({ tracks, onFilteredTracksChange }: VisualiserPanelProps) {
  const isPlaying = usePlayerStore(state => state.isPlaying)
  const bassPower = useVisualiserStore(state => state.bassPower)

  return (
    <div style={styles.visualiserPanel}>
      <div style={styles.visualiserInner}>

        {/* R3F album field */}
        {tracks.length > 0 && (
          <div style={styles.canvasBlock}>
            <p style={styles.canvasLabel}>Album Field</p>
            <AlbumGravityField tracks={tracks} width={560} height={200} />
          </div>
        )}

        {/* Frequency bars */}
        <div style={styles.canvasBlock}>
          <p style={styles.canvasLabel}>Frequency Spectrum</p>
          <FrequencyBars width={560} height={140} mirrorMode />
        </div>

        {/* Waveform */}
        <div style={styles.canvasBlock}>
          <p style={styles.canvasLabel}>Waveform</p>
          <WaveformLine width={560} height={52} />
        </div>

        {/* Bass energy */}
        <div style={styles.canvasBlock}>
          <p style={styles.canvasLabel}>Bass Energy</p>
          <div style={styles.bassTrack}>
            <div style={{ ...styles.bassFill, width: `${bassPower * 100}%` }} />
          </div>
        </div>

        {/* D3 genre graph */}
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

        {!isPlaying && (
          <div style={styles.idleOverlay}>
            <p style={styles.idleText}>Select a track to visualise</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Keyboard shortcuts ────────────────────────────────────────────────────

function KeyboardShortcuts() {
  const { isPlaying, setIsPlaying, currentTrack, nextTrack, prevTrack } =
    usePlayerStore()

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
  const [searchTracks, setSearchTracks] = useState<SpotifyTrack[]>([])
  const [filteredTrackIds, setFilteredTrackIds] = useState<string[] | null>(null)

  const handleFilteredTracksChange = useCallback((ids: string[] | null) => {
    setFilteredTrackIds(ids)
  }, [])

  return (
    <div style={styles.root}>
      <BackgroundPulse />
      <PreviewPlayer />
      <KeyboardShortcuts />

      <header style={styles.header}>
        <h1 style={styles.logo}>Waveform</h1>
        <p style={styles.headerSub}>
          Press <kbd style={styles.kbd}>/</kbd> to search ·{' '}
          <kbd style={styles.kbd}>Space</kbd> to play ·{' '}
          <kbd style={styles.kbd}>←</kbd> <kbd style={styles.kbd}>→</kbd> to navigate
        </p>
      </header>

      <div style={styles.layout}>
        <div style={styles.leftPanel}>
          <SearchOverlay
            onResultsChange={setSearchTracks}
            filteredTrackIds={filteredTrackIds}
          />
        </div>

        <VisualiserPanel
          tracks={searchTracks}
          onFilteredTracksChange={handleFilteredTracksChange}
        />

        <div style={styles.rightPanel}>
          <NowPlaying />
        </div>
      </div>

      <PlayerBar />
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
    color: '#e8f5e8',
    fontFamily: 'monospace',
    display: 'flex',
    flexDirection: 'column',
    paddingBottom: 80,
  },
  header: {
    padding: '1rem 2rem',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    backdropFilter: 'blur(12px)',
    position: 'sticky',
    top: 0,
    zIndex: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
  },
  logo: {
    fontSize: '0.95rem',
    letterSpacing: '0.3em',
    textTransform: 'uppercase',
    opacity: 0.6,
    fontWeight: 400,
    flexShrink: 0,
  },
  headerSub: {
    fontSize: '0.65rem',
    opacity: 0.2,
    letterSpacing: '0.05em',
  },
  kbd: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '3px',
    padding: '0.1rem 0.35rem',
    fontSize: '0.6rem',
    fontFamily: 'monospace',
  },
  layout: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '340px 1fr 260px',
    overflow: 'hidden',
    height: 'calc(100vh - 52px - 80px)',
  },
  leftPanel: {
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  rightPanel: {
    borderLeft: '1px solid rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  visualiserPanel: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '1.5rem 2rem',
    position: 'relative',
    overflowY: 'auto',
  },
  visualiserInner: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    width: '100%',
    position: 'relative',
  },
  canvasBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  canvasLabel: {
    fontSize: '0.58rem',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    opacity: 0.2,
    fontFamily: 'monospace',
  },
  divider: {
    height: 1,
    background: 'rgba(255,255,255,0.05)',
    margin: '0.25rem 0',
  },
  bassTrack: {
    height: 3,
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  bassFill: {
    height: '100%',
    background: '#1db954',
    borderRadius: 2,
    transition: 'width 0.05s linear',
  },
  idleOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(2px)',
    pointerEvents: 'none',
    zIndex: 5,
  },
  idleText: {
    opacity: 0.15,
    fontSize: '0.8rem',
    letterSpacing: '0.1em',
  },
}