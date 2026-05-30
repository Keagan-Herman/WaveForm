import React, { useRef } from 'react'
import { motion, type Variants } from 'framer-motion'
import { usePlayerStore } from '@/stores/playerStore'
import { useResize } from '@/hooks/useResize'
import { QuadrantErrorBoundary } from '@/components/ui/QuadrantErrorBoundary'
import { SearchOverlay } from '@/components/search/SearchOverlay'
import { NowPlaying } from '@/components/library/NowPlaying'
import { AlbumGravityField } from '@/components/library/AlbumGravityField'
import { RadialVisualiser } from '@/components/visualiser/RadialVisualiser'
import { VisualisersPanel } from '@/components/layout/VisualisersPanel'
import { GenrePanelQuadrant } from '@/components/layout/GenrePanelQuadrant'
import type { AlbumColour } from '@/hooks/useAlbumColour'
import type { DeezerTrack } from '@/types/track'

interface MainGridProps {
  accent: AlbumColour
  hasIntroPlayed: boolean
  searchTracks: DeezerTrack[]
  filteredTrackIds: string[] | null
  handleFilteredTracksChange: (ids: string[] | null) => void
  onSearchTracksChange: (tracks: DeezerTrack[]) => void
}

export function MainGrid({
  accent,
  hasIntroPlayed,
  searchTracks,
  filteredTrackIds,
  handleFilteredTracksChange,
  onSearchTracksChange,
}: MainGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { width } = useResize(containerRef)
  const isMobile = (width || window.innerWidth) < 900

  const isPlaying = usePlayerStore(state => state.isPlaying)

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
    <div
      ref={containerRef}
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
            onResultsChange={onSearchTracksChange}
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
  )
}

const HEADER_H = 46
const PLAYER_H = 70

const styles: Record<string, React.CSSProperties> = {
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
