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

import React from 'react'
import { useState, useCallback } from 'react'
import { formatDuration, type DeezerTrack } from '@/lib/deezerApi'

interface TrackRowProps {
  track: DeezerTrack
  isActive: boolean
  index: number
  onSelect: (track: DeezerTrack, index: number) => void
}

export function TrackRow({ track, isActive, index, onSelect }: TrackRowProps) {
  const [isHovered, setIsHovered] = useState(false)

  const handleSelect = useCallback(() => {
    onSelect(track, index)
  }, [track, index, onSelect])

  return (
    <button
      style={{
        ...styles.row,
        background: isActive
          ? 'rgba(29,185,84,0.12)'
          : isHovered
          ? 'rgba(255,255,255,0.04)'
          : 'transparent',
        borderColor: isActive
          ? 'rgba(29,185,84,0.35)'
          : 'rgba(255,255,255,0.05)',
      }}
      onClick={handleSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label={`Play ${track.title} by ${track.artist.name}`}
      aria-pressed={isActive}
    >
      <div style={styles.indexWrap}>
        {isActive
          ? <span style={styles.playingIndicator}>▶</span>
          : <span style={styles.index}>{index + 1}</span>
        }
      </div>

      <img
        src={track.album.cover_medium}
        alt={track.album.title}
        style={styles.albumArt}
        loading="lazy"
      />

      <div style={styles.info}>
        <p style={{ ...styles.name, color: isActive ? '#1db954' : '#e8f5e8' }}>
          {track.title}
        </p>
        <p style={styles.artist}>{track.artist.name}</p>
      </div>

      <p style={styles.album}>{track.album.title}</p>

      <span style={styles.duration}>{formatDuration(track.duration)}</span>
    </button>
  )
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: 'grid',
    gridTemplateColumns: '32px 36px 1fr 1fr auto',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.5rem 0.75rem',
    borderRadius: '4px',
    border: '1px solid',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    color: '#e8f5e8',
    transition: 'background 0.12s, border-color 0.12s',
    fontFamily: 'monospace',
  },
  indexWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
  },
  index: { fontSize: '0.7rem', opacity: 0.25 },
  playingIndicator: { fontSize: '0.65rem', color: '#1db954' },
  albumArt: {
    width: 36,
    height: 36,
    borderRadius: '2px',
    objectFit: 'cover',
    flexShrink: 0,
  },
  info: { minWidth: 0 },
  name: {
    fontSize: '0.82rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginBottom: '0.15rem',
    transition: 'color 0.15s',
  },
  artist: {
    fontSize: '0.7rem',
    opacity: 0.4,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  album: {
    fontSize: '0.7rem',
    opacity: 0.25,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontFamily: 'monospace',
  },
  duration: {
    fontSize: '0.7rem',
    opacity: 0.3,
    flexShrink: 0,
    fontVariantNumeric: 'tabular-nums',
  },
}