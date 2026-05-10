/**
 * TrackRow.tsx
 *
 * Individual track row for the search results list.
 * Handles its own hover state and communicates selection upward via onSelect.
 *
 * Deliberately kept as a pure presentational component — no store access.
 * The parent (SearchPanel) owns selection logic and passes isActive down.
 */

/**
 * TrackRow.tsx — Deezer version
 *
 * Changes from Spotify version:
 * - DeezerTrack instead of SpotifyTrack
 * - track.artist.name instead of track.artists.map(...)
 * - track.album.cover_medium instead of getAlbumArt()
 * - track.album.title instead of track.album.name
 * - formatDuration receives seconds not milliseconds
 */

/**
 * TrackRow.tsx — enhanced
 *
 * Added accentColour prop for dynamic theming.
 * Active state uses dynamic accent instead of hardcoded green.
 * Contrast improved throughout.
 */

import React, { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { formatDuration, type DeezerTrack } from '@/lib/deezerApi'
import { useUIStore } from '@/stores/uiStore'

interface TrackRowProps {
  track: DeezerTrack
  isActive: boolean
  isFocused?: boolean
  index: number
  onSelect: (track: DeezerTrack, index: number) => void
  accentColour?: string
}

export const TrackRow = React.memo(({
  track,
  isActive,
  isFocused,
  index,
  onSelect,
  accentColour = '#1db954',
}: TrackRowProps) => {
  const [isHovered, setIsHovered] = useState(false)

  const handleSelect = useCallback(() => {
    onSelect(track, index)
  }, [track, index, onSelect])

  const handleArtistClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    useUIStore.getState().setSelectedArtistId(track.artist.id)
  }, [track.artist.id])

  const accentBg = `${accentColour}18`
  const accentBorder = `${accentColour}40`

  return (
    <button
      style={{
        ...styles.row,
        background: isActive
          ? accentBg
          : isHovered || isFocused
            ? 'rgba(255,255,255,0.05)'
            : 'transparent',
        borderColor: isActive
          ? accentBorder
          : isFocused
            ? `${accentColour}60`
            : 'rgba(255,255,255,0.06)',
        boxShadow: isFocused ? `inset 0 0 0 1px ${accentColour}30` : 'none',
      }}
      onClick={handleSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label={`Play ${track.title} by ${track.artist.name}`}
      aria-pressed={isActive}
    >
      <div style={styles.indexWrap}>
        {isActive
          ? <span style={{ ...styles.playingIndicator, color: accentColour }}>▶</span>
          : <span style={styles.index}>{index + 1}</span>
        }
      </div>

      <motion.img
        layoutId={`album-${track.id}`}
        src={track.album.cover_medium}
        alt={track.album.title}
        style={styles.albumArt}
        loading="lazy"
      />

      <div style={styles.info}>
        <p style={{
          ...styles.name,
          color: isActive ? accentColour : '#f0f0f0',
          transition: 'color 0.5s ease',
        }}>
          {track.title}
        </p>
        <p style={styles.artist} onClick={handleArtistClick}>
          {track.artist.name}
        </p>
      </div>

      <p style={styles.album}>{track.album.title}</p>

      <span style={styles.duration}>{formatDuration(track.duration)}</span>
    </button>
  )
})

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: 'grid',
    gridTemplateColumns: '28px 36px 1fr 1fr auto',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.45rem 0.7rem',
    borderRadius: '4px',
    border: '1px solid',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    color: '#f0f0f0',
    transition: 'background 0.12s, border-color 0.12s',
    fontFamily: 'monospace',
  },
  indexWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
  },
  index: { fontSize: '0.65rem', opacity: 0.35 },
  playingIndicator: { fontSize: '0.6rem' },
  albumArt: {
    width: 36,
    height: 36,
    borderRadius: '3px',
    objectFit: 'cover',
    flexShrink: 0,
  },
  info: { minWidth: 0 },
  name: {
    fontSize: '0.8rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginBottom: '0.12rem',
  },
  artist: {
    fontSize: '0.68rem',
    opacity: 0.5,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  album: {
    fontSize: '0.65rem',
    opacity: 0.3,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontFamily: 'monospace',
  },
  duration: {
    fontSize: '0.65rem',
    opacity: 0.4,
    flexShrink: 0,
    fontVariantNumeric: 'tabular-nums',
  },
}