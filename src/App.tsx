/**
 * App.tsx — quadrant layout
 *
 * LAYOUT:
 * ┌─────────────────┬─────────────────┐
 * │  Track List     │  Radial +       │
 * │  (scrollable)   │  Lissajous      │
 * ├─────────────────┼─────────────────┤
 * │  Now Playing    │  Spectrogram +  │
 * │  + Track Info   │  Freq Bars +    │
 * │                 │  Genre Map      │
 * └─────────────────┴─────────────────┘
 *                   ↑ scrollable
 * Fixed player bar at bottom.
 *
 * Each quadrant fills exactly 50% of the available area.
 * Top-left track list scrolls independently.
 * Bottom-right visualiser section scrolls independently.
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
import { LissajousVisualiser } from './components/visualiser/LissaJousVisualiser'
import { Spectrogram } from './components/visualiser/Spectogram'

function useAppAccent() {
  const currentTrack = usePlayerStore(state => state.currentTrack)
  const imageUrl = currentTrack?.album.cover_medium ?? null
  return useAlbumColour(imageUrl)
}

// ─── Top-right quadrant: Radial + Lissajous side by side ─────────────────

// function VisualisersTop({ accentHue, accentColour }: { accentHue: number; accentColour: string }) {
//   const isPlaying = usePlayerStore(state => state.isPlaying)

//   return (
//     <div style={styles.quadrant}>
//       <div style={styles.quadLabel}>Visualisers</div>
//       <div style={styles.visualiserTopRow}>
//         <div style={styles.visualiserItem}>
//           <p style={styles.canvasLabel}>Frequency Field</p>
//           <div style={{ position: 'relative' }}>
//             <RadialVisualiser size={220} accentColour={accentColour} accentHue={accentHue} />
//           </div>
//         </div>
//         <div style={styles.visualiserItem}>
//           <p style={styles.canvasLabel}>Oscilloscope · click to freeze</p>
//           <LissajousVisualiser size={220} accentHue={accentHue} accentColour={accentColour} />
//         </div>
//       </div>
//       {!isPlaying && (
//         <div style={styles.idleOverlay}>
//           <p style={styles.idleText}>Select a track to visualise</p>
//         </div>
//       )}
//     </div>
//   )
// }

// ─── Bottom-right quadrant: Bars + Spectrogram + Genre ───────────────────

function VisualisersBottom({
  tracks,
  accentHue,
  accentColour,
  onFilteredTracksChange,
}: {
  tracks: DeezerTrack[]
  accentHue: number
  accentColour: string
  onFilteredTracksChange: (ids: string[] | null) => void
}) {
  const bassPower = useVisualiserStore(state => state.bassPower)
  const beat = useVisualiserStore(state => state.beat)

  return (
    <div style={{ ...styles.quadrant, overflowY: 'auto' }}>
      <div style={styles.quadLabel}>Analysis</div>
      <div style={styles.analysisInner}>

        <div style={styles.canvasBlock}>
          <p style={styles.canvasLabel}>Spectrogram · hover for frequency</p>
          <Spectrogram width={520} height={100} accentHue={accentHue} accentColour={accentColour} />
        </div>

        <div style={styles.canvasBlock}>
          <p style={styles.canvasLabel}>Frequency Spectrum</p>
          <FrequencyBars width={520} height={90} mirrorMode accentHue={accentHue} />
        </div>

        {/* <div style={styles.canvasBlock}>
          <p style={styles.canvasLabel}>Waveform</p>
          <WaveformLine width={520} height={40} />
        </div> */}

        {/* <div style={styles.canvasBlock}>
          <p style={styles.canvasLabel}>Bass Energy</p>
          <div style={styles.bassTrack}>
            <div style={{
              ...styles.bassFill,
              width: `${bassPower * 100}%`,
              background: beat ? `hsl(${accentHue}, 100%, 70%)` : accentColour,
              boxShadow: beat ? `0 0 10px ${accentColour}` : 'none',
              transition: beat
                ? 'width 0.05s, background 0.05s, box-shadow 0.05s'
                : 'width 0.1s linear, background 0.5s',
            }} />
          </div>
        </div> */}

        {tracks.length > 0 && (
          <>
            <div style={styles.divider} />
            <GenrePanel
              tracks={tracks}
              width={520}
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
        case ' ': e.preventDefault(); if (currentTrack) setIsPlaying(!isPlaying); break
        case 'ArrowRight': e.preventDefault(); nextTrack(); break
        case 'ArrowLeft': e.preventDefault(); prevTrack(); break
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

      <header style={{ ...styles.header, borderBottomColor: `${accent.hex}25` }}>
        <h1 style={styles.logo}>Waveform</h1>
        <p style={styles.headerSub}>
          <kbd style={{ ...styles.kbd, borderColor: `${accent.hex}40`, color: accent.hex }}>/</kbd>{' '}
          search ·{' '}
          <kbd style={{ ...styles.kbd, borderColor: `${accent.hex}40` }}>Space</kbd>{' '}
          play ·{' '}
          <kbd style={{ ...styles.kbd, borderColor: `${accent.hex}40` }}>←</kbd>{' '}
          <kbd style={{ ...styles.kbd, borderColor: `${accent.hex}40` }}>→</kbd>{' '}
          navigate
        </p>
        <div style={{ ...styles.accentDot, background: accent.hex }} title="Current album colour" />
      </header>

      {/* 2×2 grid */}
      <div style={styles.grid}>

        {/* Top-left: Track list */}
        <div style={{ ...styles.quadrant, ...styles.quadrantBorderRight, ...styles.quadrantBorderBottom }}>
          <div style={styles.quadLabel}>Library</div>
          <SearchOverlay
            onResultsChange={setSearchTracks}
            filteredTrackIds={filteredTrackIds}
            accentColour={accent.hex}
          />
        </div>

        {/* Top-right: Radial + Lissajous */}
        {/* <div style={{ ...styles.quadrantBorderBottom }}>
          <VisualisersTop accentHue={accent.h} accentColour={accent.hex} />
        </div> */}

        {/* Bottom-left: Now Playing */}
        <div style={{ ...styles.quadrant, ...styles.quadrantBorderRight, overflow: 'hidden' }}>
          <div style={styles.quadLabel}>Now Playing</div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <NowPlaying accentColour={accent} />
          </div>
        </div>

        {/* Bottom-right: Analysis + Genre */}
        <VisualisersBottom
          tracks={searchTracks}
          accentHue={accent.h}
          accentColour={accent.hex}
          onFilteredTracksChange={handleFilteredTracksChange}
        />

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

const HEADER_H = 46
const PLAYER_H = 70
const GRID_H = `calc(100vh - ${HEADER_H}px - ${PLAYER_H}px)`

const styles: Record<string, React.CSSProperties> = {
  root: {
    height: '100vh',
    color: '#f0f0f0',
    fontFamily: 'monospace',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
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
  headerSub: {
    fontSize: '0.6rem',
    opacity: 0.4,
    letterSpacing: '0.05em',
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    flexWrap: 'wrap',
  },
  kbd: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '3px',
    padding: '0.08rem 0.3rem',
    fontSize: '0.58rem',
    fontFamily: 'monospace',
    transition: 'border-color 1s ease, color 1s ease',
  },
  accentDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
    transition: 'background 1s ease',
    boxShadow: '0 0 6px currentColor',
  },

  // 2x2 grid
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: '1fr 1fr',
    height: GRID_H,
    overflow: 'hidden',
  },

  // Quadrant base
  quadrant: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  },
  quadrantBorderRight: {
    borderRight: '1px solid rgba(255,255,255,0.07)',
  },
  quadrantBorderBottom: {
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  },
  quadLabel: {
    fontSize: '0.5rem',
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    opacity: 0.22,
    padding: '0.55rem 1rem 0.3rem',
    flexShrink: 0,
    fontFamily: 'monospace',
  },

  // Top-right visualisers
  visualiserTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    flex: 1,
    padding: '0.5rem 1rem 1rem',
    gap: '1rem',
  },
  visualiserItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.35rem',
  },

  // Bottom-right analysis
  analysisInner: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    padding: '0 1rem 1rem',
    flex: 1,
  },

  // Idle overlay (top-right)
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
  },
  canvasLabel: {
    fontSize: '0.54rem',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    opacity: 0.32,
    fontFamily: 'monospace',
  },
  divider: {
    height: 1,
    background: 'rgba(255,255,255,0.06)',
    margin: '0.1rem 0',
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