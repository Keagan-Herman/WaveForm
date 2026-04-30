/**
 * TrackRow.tsx
 *
 * Individual track row for the search results list.
 * Handles its own hover state and communicates selection upward via onSelect.
 *
 * Deliberately kept as a pure presentational component — no store access.
 * The parent (SearchPanel) owns selection logic and passes isActive down.
 */

import { useState, useCallback } from 'react'
import { getAlbumArt, formatDuration, type SpotifyTrack } from '@/lib/spotifyApi'

interface TrackRowProps {
  track: SpotifyTrack
  isActive: boolean
  index: number
  onSelect: (track: SpotifyTrack, index: number) => void
}

export function TrackRow({ track, isActive, index, onSelect }: TrackRowProps) {
  const [isHovered, setIsHovered] = useState(false)

  const handleSelect = useCallback(() => {
    onSelect(track, index)
  }, [track, index, onSelect])

  const albumArt = getAlbumArt(track, 'small')
  const artists = track.artists.map(a => a.name).join(', ')

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
      aria-label={`Play ${track.name} by ${artists}`}
      aria-pressed={isActive}
    >
      {/* Index / play indicator */}
      <div style={styles.indexWrap}>
        {isActive ? (
          <span style={styles.playingIndicator}>▶</span>
        ) : (
          <span style={styles.index}>{index + 1}</span>
        )}
      </div>

      {/* Album art */}
      <img
        src={albumArt}
        alt={track.album.name}
        style={styles.albumArt}
        loading="lazy"
      />

      {/* Track info */}
      <div style={styles.info}>
        <p
          style={{
            ...styles.name,
            color: isActive ? '#1db954' : '#e8f5e8',
          }}
        >
          {track.name}
        </p>
        <p style={styles.artist}>{artists}</p>
      </div>

      {/* Album name — hidden on small widths via opacity trick */}
      <p style={styles.album}>{track.album.name}</p>

      {/* Duration */}
      <span style={styles.duration}>{formatDuration(track.duration_ms)}</span>
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
  index: {
    fontSize: '0.7rem',
    opacity: 0.25,
  },
  playingIndicator: {
    fontSize: '0.65rem',
    color: '#1db954',
  },
  albumArt: {
    width: 36,
    height: 36,
    borderRadius: '2px',
    objectFit: 'cover',
    flexShrink: 0,
  },
  info: {
    minWidth: 0,
  },
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