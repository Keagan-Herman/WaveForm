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

/**
 * GenrePanel.tsx — Deezer version
 *
 * Changes from Spotify version:
 * - DeezerTrack instead of SpotifyTrack
 * - trackIds are strings of numeric Deezer IDs
 */

import { useState, useEffect, useCallback } from 'react'
import { GenreForceGraph } from './GenreForceGraph'
import { useGenreGraph } from '@/hooks/useGenreGraph'
import type { DeezerTrack } from '@/lib/deezerApi'
import type { AlbumColour } from '@/hooks/useAlbumColour'

interface GenrePanelProps {
  tracks: DeezerTrack[]
  width: number
  onFilteredTracksChange?: (trackIds: string[] | null) => void
  accent?: AlbumColour
}

export function GenrePanel({ tracks, width, onFilteredTracksChange, accent }: GenrePanelProps) {
  const { graphData, isLoading } = useGenreGraph(tracks)
  const [activeGenre, setActiveGenre] = useState<string | null>(null)
  const [isHovered, setIsHovered] = useState(false)

  const HEIGHT = 280

  const handleSelectGenre = useCallback(
    (genre: string | null) => {
      setActiveGenre(genre)
      if (!genre) {
        onFilteredTracksChange?.(null)
        return
      }
      const node = graphData.nodes.find(n => n.id === genre)
      onFilteredTracksChange?.(node?.trackIds ?? null)
    },
    [graphData.nodes, onFilteredTracksChange]
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveGenre(prev => (prev === null ? prev : null))
    onFilteredTracksChange?.(null)
  }, [tracks, onFilteredTracksChange])

  if (!isLoading && graphData.nodes.length < 3) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          flexDirection: 'column',
          gap: '0.5rem',
          opacity: 0.4,
        }}
      >
        <div
          style={{
            fontSize: '0.6rem',
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            fontWeight: 700,
          }}
        >
          Topology unavailable
        </div>
        <div
          style={{
            fontSize: '0.6rem',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Search for more tracks to build the genre map
        </div>
      </div>
    )
  }

  const accentHex = accent?.hex ?? '#1db954'
  const accentDim = accent ? `${accentHex}18` : 'rgba(29,185,84,0.12)'
  const accentBorder = accent ? `${accentHex}40` : 'rgba(29,185,84,0.3)'

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        {activeGenre && (
          <button
            style={{
              ...styles.clearFilter,
              color: accentHex,
              borderColor: accentBorder,
              background: isHovered ? `${accentHex}25` : accentDim,
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
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
          <p style={{ ...styles.hint, color: accent?.palette.textDim ?? 'rgba(232,245,232,0.15)' }}>
            Click a genre to filter tracks · Drag nodes to rearrange
          </p>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '1rem',
    minHeight: '22px',
  },
  clearFilter: {
    borderRadius: '100px',
    border: '1px solid',
    fontFamily: 'monospace',
    fontSize: '0.65rem',
    letterSpacing: '0.05em',
    padding: '0.2rem 0.6rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 200,
    transition: 'background 0.2s ease, border-color 0.2s ease',
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
    fontSize: '0.65rem',
    letterSpacing: '0.08em',
    color: 'rgba(232,245,232,0.15)',
    pointerEvents: 'none',
  },
}

// React import needed for React.CSSProperties
import React from 'react'
