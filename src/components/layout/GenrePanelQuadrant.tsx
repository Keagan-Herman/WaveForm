import React from 'react'
import { GenrePanel } from '../library/GenrePanel'
import type { AlbumColour } from '@/hooks/useAlbumColour'
import type { DeezerTrack } from '@/types/track'

interface GenrePanelQuadrantProps {
  tracks: DeezerTrack[]
  accent: AlbumColour
  onFilteredTracksChange: (ids: string[] | null) => void
}

export function GenrePanelQuadrant({
  tracks,
  accent,
  onFilteredTracksChange,
}: GenrePanelQuadrantProps) {
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
            <p style={styles.stateIcon} aria-hidden="true">
              ◈
            </p>
            <p style={styles.stateDesc}>Search for tracks to see genre relationships</p>
          </div>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  quadrant: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  },
  quadLabel: {
    fontSize: '0.65rem',
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    opacity: 0.55,
    padding: '0.5rem 1rem 0.25rem',
    flexShrink: 0,
    fontFamily: 'monospace',
  },
  genreInner: {
    flex: 1,
    padding: '0 1.25rem 1.25rem',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  stateWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: '0.5rem',
    textAlign: 'center',
  },
  stateIcon: { fontSize: '1.5rem', opacity: 0.3 },
  stateDesc: {
    fontSize: '0.72rem',
    lineHeight: 1.6,
    maxWidth: 220,
    fontFamily: 'monospace',
    opacity: 0.55,
  },
}
