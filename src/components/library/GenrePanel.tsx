/**
 * GenrePanel.tsx
 *
 * Connects the GenreForceGraph to the player and search state.
 * Owns the active genre selection and derives the filtered track list.
 *
 * Sits below the album gravity field in the visualiser panel.
 * When a genre is selected, it calls onFilteredTracksChange so the
 * parent can highlight matching tracks in the search results list.
 *
 * Loading state: shows a skeleton while artist data is being fetched.
 * Empty state: hidden entirely if fewer than 3 genre nodes are available
 * (a graph with 1-2 nodes is not worth rendering).
 */

import { useState, useEffect, useCallback } from 'react'
import { GenreForceGraph } from './GenreForceGraph'
import { useGenreGraph } from '@/hooks/useGenreGraph'
import type { SpotifyTrack } from '@/lib/spotifyApi'

interface GenrePanelProps {
  tracks: SpotifyTrack[]
  width: number
  onFilteredTracksChange?: (trackIds: string[] | null) => void
}

export function GenrePanel({
  tracks,
  width,
  onFilteredTracksChange,
}: GenrePanelProps) {
  const { graphData, isLoading } = useGenreGraph(tracks)
  const [activeGenre, setActiveGenre] = useState<string | null>(null)

  const HEIGHT = 280

  const handleSelectGenre = useCallback(
    (genre: string | null) => {
      setActiveGenre(genre)

      if (!genre) {
        onFilteredTracksChange?.(null)
        return
      }

      // Find tracks that belong to the selected genre
      const node = graphData.nodes.find(n => n.id === genre)
      onFilteredTracksChange?.(node?.trackIds ?? null)
    },
    [graphData.nodes, onFilteredTracksChange]
  )

  // Clear active genre when tracks change (new search)
  useEffect(() => {
    setActiveGenre(null)
    onFilteredTracksChange?.(null)
  }, [tracks, onFilteredTracksChange])

  // Don't render if not enough data
  if (!isLoading && graphData.nodes.length < 3) return null

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <p style={styles.label}>Genre Map</p>
        {activeGenre && (
          <button
            style={styles.clearFilter}
            onClick={() => handleSelectGenre(null)}
            aria-label="Clear genre filter"
          >
            {activeGenre} ✕
          </button>
        )}
      </div>

      {isLoading ? (
        <div style={{ ...styles.skeleton, height: HEIGHT }} />
      ) : (
        <div style={styles.graphWrap}>
          <GenreForceGraph
            data={graphData}
            width={width}
            height={HEIGHT}
            activeGenre={activeGenre}
            onSelectGenre={handleSelectGenre}
          />
          <p style={styles.hint}>
            Click a genre to filter tracks · Drag nodes to rearrange
          </p>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
  },
  label: {
    fontSize: '0.58rem',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    opacity: 0.2,
    fontFamily: 'monospace',
  },
  clearFilter: {
    background: 'rgba(29,185,84,0.12)',
    border: '1px solid rgba(29,185,84,0.3)',
    borderRadius: '100px',
    color: '#1db954',
    fontFamily: 'monospace',
    fontSize: '0.6rem',
    letterSpacing: '0.05em',
    padding: '0.2rem 0.6rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 200,
  },
  skeleton: {
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '6px',
    animation: 'shimmer 1.5s ease-in-out infinite',
  },
  graphWrap: {
    position: 'relative',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  hint: {
    position: 'absolute',
    bottom: '0.5rem',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: 'monospace',
    fontSize: '0.55rem',
    letterSpacing: '0.08em',
    color: 'rgba(232,245,232,0.15)',
    pointerEvents: 'none',
  },
}