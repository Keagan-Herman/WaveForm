/**
 * App.tsx — Redesigned for Japanese Minimalism, Rams Functionalism, and Klimt Organic Contrast.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion'
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
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor'
import { useShareableURL } from '@/hooks/useShareableURL'

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

function ShortcutsLegend() {
  const showShortcutsLegend = useVisualiserStore(state => state.showShortcutsLegend)
  const toggleShortcutsLegend = useVisualiserStore(state => state.toggleShortcutsLegend)
  const prefersReducedMotion = useReducedMotion()

  return (
    <AnimatePresence>
      {showShortcutsLegend && (
        <motion.div
          key="shortcuts-legend"
          initial={{ opacity: 0, ...(prefersReducedMotion ? {} : { scale: 0.97 }) }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, ...(prefersReducedMotion ? {} : { scale: 0.97 }) }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          style={legendStyles.backdrop}
          onClick={toggleShortcutsLegend}
        >
          <div style={legendStyles.panel} onClick={e => e.stopPropagation()}>
            <div style={legendStyles.heading}>Keyboard Shortcuts</div>
            {(
              [
                ['Space', 'Play / Pause'],
                ['← →', 'Prev / Next track'],
                ['F', 'Enter / Exit fullscreen'],
                ['V', 'Cycle visual layer'],
                ['N', 'Toggle Now Playing (fullscreen)'],
                ['S', 'FX Settings (fullscreen)'],
                ['R', 'Start / Stop capture (fullscreen)'],
                ['?', 'Show / Hide this legend'],
              ] as [string, string][]
            ).map(([key, action]) => (
              <div key={key} style={legendStyles.row}>
                <span style={legendStyles.key}>{key}</span>
                <span style={legendStyles.action}>{action}</span>
              </div>
            ))}
            <button onClick={toggleShortcutsLegend} style={legendStyles.closeBtn}>
              Close [Esc]
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const legendStyles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 900,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(4px)',
  },
  panel: {
    background: 'rgba(13,13,13,0.96)',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
    padding: '2rem',
    minWidth: '280px',
    fontFamily: 'var(--font-mono)',
  },
  heading: {
    fontSize: '0.65rem',
    letterSpacing: '0.25em',
    textTransform: 'uppercase',
    fontWeight: 700,
    opacity: 0.55,
    marginBottom: '1.5rem',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '3rem',
    marginBottom: '0.75rem',
    alignItems: 'center',
  },
  key: {
    fontFamily: 'monospace',
    fontSize: '0.65rem',
    background: 'rgba(255,255,255,0.06)',
    padding: '0.1rem 0.5rem',
    borderRadius: '2px',
    border: '1px solid rgba(255,255,255,0.12)',
    whiteSpace: 'nowrap' as const,
  },
  action: {
    fontSize: '0.65rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    opacity: 0.55,
  },
  closeBtn: {
    marginTop: '1rem',
    width: '100%',
    padding: '0.4rem',
    fontSize: '0.65rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '2px',
    background: 'rgba(255,255,255,0.03)',
    cursor: 'pointer',
    opacity: 0.55,
    fontFamily: 'var(--font-mono)',
    color: '#fff',
  },
}

function KeyboardShortcuts() {
  const isPlaying = usePlayerStore(state => state.isPlaying)
  const play = usePlayerStore(state => state.play)
  const pause = usePlayerStore(state => state.pause)
  const currentTrack = usePlayerStore(state => state.currentTrack)
  const nextTrack = usePlayerStore(state => state.nextTrack)
  const prevTrack = usePlayerStore(state => state.prevTrack)

  const toggleFullscreen = useVisualiserStore(state => state.toggleFullscreen)
  const cycleVisualLayer = useVisualiserStore(state => state.cycleVisualLayer)
  const isFullscreen = useVisualiserStore(state => state.isFullscreen)
  const toggleNowPlaying = useVisualiserStore(state => state.toggleNowPlaying)
  const toggleShortcutsLegend = useVisualiserStore(state => state.toggleShortcutsLegend)

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
        case 'n':
          if (isFullscreen) {
            e.preventDefault()
            toggleNowPlaying()
          }
          break
        case '?':
          e.preventDefault()
          toggleShortcutsLegend()
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
    isFullscreen,
    toggleNowPlaying,
    toggleShortcutsLegend,
  ])
  return null
}

function Waveform() {
  const containerRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const { width } = useResize(containerRef)
  const { width: heroW, height: heroH } = useResize(heroRef)
  const isMobile = (width || window.innerWidth) < 900

  const [searchTracks, setSearchTracks] = useState<DeezerTrack[]>([])
  const [filteredTrackIds, setFilteredTrackIds] = useState<string[] | null>(null)
  const [hasIntroPlayed, setHasIntroPlayed] = useState(() => {
    if (typeof sessionStorage === 'undefined') return false
    return !!sessionStorage.getItem('waveform_intro_played')
  })
  const accent = useAppAccent()

  const autoDowngrade = useVisualiserStore(state => state.autoDowngrade)
  usePerformanceMonitor(55, 3000, autoDowngrade)

  const { restoreFromURL } = useShareableURL()
  useEffect(() => {
    restoreFromURL()
    if (window.location.search) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [restoreFromURL])

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
    if (accent.hex && accent.hex !== '#7a8fa6') {
      usePlayerStore.getState().pushColorHistory({
        trackId: currentTrack.id,
        hex: accent.hex,
        title: currentTrack.title,
      })
    }
  }, [currentTrack, isPlaying, accent.hex])

  useEffect(() => {
    if (hasIntroPlayed) return
    const timer = setTimeout(() => {
      setHasIntroPlayed(true)
      sessionStorage.setItem('waveform_intro_played', 'true')
    }, 800)
    return () => clearTimeout(timer)
  }, [hasIntroPlayed])

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
        const alpha = 0.05 + bassPower * 0.15
        root.style.setProperty('--reactive-border', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`)
      }
    )
    return unsubscribe
  }, [accent.hex, isPlaying])

  const handleFilteredTracksChange = useCallback((ids: string[] | null) => {
    setFilteredTrackIds(ids)
  }, [])

  const prefersReducedMotion = useReducedMotion()
  const skipIntro = hasIntroPlayed || !!prefersReducedMotion

  const sidebarVariants: Variants = {
    hidden: { opacity: 0, x: -16 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
  }
  const heroVariants: Variants = {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 },
    },
  }
  const statusVariants: Variants = {
    hidden: { opacity: 0, x: 16 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.25 },
    },
  }
  const bottomVariants: Variants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1], delay: 0.35 },
    },
  }

  return (
    <div ref={containerRef} style={styles.root}>
      <BackgroundPulse accent={accent} />
      <PreviewPlayer />
      <KeyboardShortcuts />
      <ShortcutsLegend />

      <Header
        accent={accent}
        hasIntroPlayed={hasIntroPlayed}
        visualLayer={visualLayer}
        filteredTrackIds={filteredTrackIds}
        onClearFilter={() => setFilteredTrackIds(null)}
      />

      <main
        style={{
          ...styles.layout,
          flexDirection: isMobile ? 'column' : 'row',
          overflowY: isMobile ? 'auto' : 'hidden',
        }}
      >
        {/* Sidebar: Discover & Search */}
        <motion.section
          initial={skipIntro ? 'visible' : 'hidden'}
          animate="visible"
          variants={sidebarVariants}
          style={{
            ...styles.sidebar,
            width: isMobile ? '100%' : '380px',
            borderRight: isMobile ? 'none' : '1px solid var(--border-color)',
            borderBottom: isMobile ? '1px solid var(--border-color)' : 'none',
          }}
        >
          <div style={styles.sectionHeader}>
            <span style={styles.sectionTitle}>Discover</span>
            <div style={{ ...styles.klimtDot, background: accent.hex }} />
          </div>
          <div style={styles.contentScroll}>
            <QuadrantErrorBoundary label="Discover" accent={accent.hex}>
              <SearchOverlay
                onResultsChange={setSearchTracks}
                filteredTrackIds={filteredTrackIds}
                accentColour={accent.hex}
              />
            </QuadrantErrorBoundary>
          </div>
        </motion.section>

        {/* Main Content Area: Visualiser & Genre Map */}
        <div style={styles.mainArea}>
          <div style={{ ...styles.topSection, flexDirection: isMobile ? 'column' : 'row' }}>
            {/* The "Sacred Space" - Visualiser */}
            <motion.section
              initial={skipIntro ? 'visible' : 'hidden'}
              animate="visible"
              variants={heroVariants}
              style={styles.heroSection}
            >
              <QuadrantErrorBoundary
                label={isPlaying ? 'Hero Scene' : 'Visualisers'}
                accent={accent.hex}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isPlaying ? (
                    <motion.div
                      key="active"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      style={styles.heroSceneWrap}
                      ref={heroRef}
                    >
                      <AlbumGravityField
                        tracks={searchTracks}
                        width={heroW || 1200}
                        height={heroH || 600}
                        accent={accent}
                      />
                      <div style={styles.heroOverlay}>
                        <RadialVisualiser width={400} height={400} accent={accent} />
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="standby"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      style={styles.heroStandby}
                    >
                      <VisualisersPanel accent={accent} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </QuadrantErrorBoundary>
            </motion.section>

            {/* Now Playing - Floating or Docked */}
            <motion.section
              initial={skipIntro ? 'visible' : 'hidden'}
              animate="visible"
              variants={statusVariants}
              style={{
                ...styles.nowPlayingSection,
                width: isMobile ? '100%' : '420px',
                borderLeft: isMobile ? 'none' : '1px solid var(--border-color)',
              }}
            >
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <QuadrantErrorBoundary label="Now Playing" accent={accent.hex}>
                  <NowPlaying accent={accent} />
                </QuadrantErrorBoundary>
              </div>
            </motion.section>
          </div>

          {/* Bottom Section: Genre Map (Wide & Breathable) */}
          <motion.section
            initial={skipIntro ? 'visible' : 'hidden'}
            animate="visible"
            variants={bottomVariants}
            style={styles.bottomSection}
          >
            <header style={styles.sectionHeader}>
              <span style={styles.sectionTitle}>Genre Map</span>
            </header>
            <QuadrantErrorBoundary label="Genre Map" accent={accent.hex}>
              <GenrePanelQuadrant
                tracks={searchTracks}
                onFilteredTracksChange={handleFilteredTracksChange}
                accent={accent}
              />
            </QuadrantErrorBoundary>
          </motion.section>
        </div>
      </main>

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
const PLAYER_H = 80

const styles: Record<string, React.CSSProperties> = {
  root: {
    height: '100vh',
    backgroundColor: 'var(--bg-color)',
    color: 'var(--text-color)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  layout: {
    display: 'flex',
    flex: 1,
    height: `calc(100vh - ${HEADER_H}px - ${PLAYER_H}px)`,
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  mainArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  topSection: {
    display: 'flex',
    flex: 1.2,
    minHeight: 0,
    borderBottom: '1px solid var(--border-color)',
  },
  heroSection: {
    flex: 1,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  nowPlayingSection: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.01)',
  },
  bottomSection: {
    flex: 0.8,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  sectionHeader: {
    height: '32px',
    padding: '0 1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid var(--border-color)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    flexShrink: 0,
  },
  sectionTitle: {
    fontSize: '0.65rem',
    textTransform: 'uppercase',
    letterSpacing: '0.25em',
    opacity: 0.55,
    fontWeight: 700,
  },
  klimtDot: {
    width: '4px',
    height: '4px',
    borderRadius: '50%',
    opacity: 0.6,
  },
  contentScroll: {
    flex: 1,
    overflowY: 'auto',
    position: 'relative',
  },
  heroSceneWrap: {
    position: 'relative',
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroStandby: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  heroOverlay: {
    position: 'absolute',
    pointerEvents: 'none',
    zIndex: 5,
    opacity: 0.6,
  },
}
