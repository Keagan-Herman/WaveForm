/**
 * TrackRow.tsx — Redesigned for Functionalism & Japanese Minimalism
 */

import React, { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { formatDuration } from '@/lib/deezerApi'
import { useUIStore } from '@/stores/uiStore'
import { useVisualiserStore } from '@/stores/visualiserStore'
import { Track, getTrackCover, getTrackArtist, getTrackAlbum, isDeezerTrack } from '@/types/track'

// ─── Sub-components for performance ──────────────────────────────────────────

const BassReactiveGlow = ({ accentColour }: { accentColour: string }) => {
  const bassPower = useVisualiserStore(state => state.bassPower)

  return (
    <motion.div
      animate={{
        opacity: 0.05 + bassPower * 0.15,
        backgroundColor: accentColour,
      }}
      transition={{ duration: 0.1 }}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}

interface TrackRowProps {
  track: Track
  isActive: boolean
  isPlaying?: boolean
  isFocused?: boolean
  index: number
  onSelect: (track: Track, index: number) => void
  accentColour?: string
}

const PlayingIndicator = ({ color }: { color: string }) => (
  <motion.div
    animate={{ opacity: [0.3, 1, 0.3] }}
    transition={{ duration: 1, repeat: Infinity }}
    style={{
      width: '6px',
      height: '6px',
      borderRadius: '50%',
      backgroundColor: color,
    }}
  />
)

export const TrackRow = React.memo(
  ({
    track,
    isActive,
    isPlaying,
    isFocused,
    index,
    onSelect,
    accentColour = '#ffffff',
  }: TrackRowProps) => {
    const [isHovered, setIsHovered] = useState(false)

    const handleSelect = useCallback(() => {
      onSelect(track, index)
    }, [track, index, onSelect])

    const handleArtistClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation()
        if (isDeezerTrack(track)) {
          useUIStore.getState().setSelectedArtistId(track.artist.id)
        }
      },
      [track]
    )

    return (
      <button
        style={{
          ...styles.row,
          backgroundColor: isActive
            ? 'rgba(255,255,255,0.03)'
            : isHovered || isFocused
              ? 'rgba(255,255,255,0.015)'
              : 'transparent',
          borderColor: isActive || isFocused
            ? accentColour
            : 'var(--border-color)',
          borderWidth: (isActive || isFocused) ? '1px' : '1px',
        }}
        onClick={handleSelect}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label={`Play ${track.title} by ${getTrackArtist(track)}`}
        aria-pressed={isActive}
      >
        {isActive && isPlaying && <BassReactiveGlow accentColour={accentColour} />}

        <div style={styles.indexWrap}>
          {isActive ? (
            <PlayingIndicator color={accentColour} />
          ) : (
            <span style={styles.index}>{(index + 1).toString().padStart(2, '0')}</span>
          )}
        </div>

        <div style={styles.artWrap}>
          <img
            src={getTrackCover(track)}
            alt=""
            style={{
              ...styles.albumArt,
              filter: isActive ? 'none' : 'grayscale(0.5) contrast(1.1)',
            }}
            loading="lazy"
          />
        </div>

        <div style={styles.info}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                ...styles.name,
                color: isActive ? accentColour : 'inherit',
              }}
            >
              {track.title}
            </div>
            {isDeezerTrack(track) && track.explicit_lyrics && (
              <div
                style={{
                  ...styles.explicitBadge,
                  color: accentColour,
                  borderColor: `${accentColour}66`,
                }}
                aria-label="Explicit content"
              >
                E
              </div>
            )}
          </div>
          <div
            style={styles.artist}
            onClick={handleArtistClick}
          >
            {getTrackArtist(track)}
          </div>
        </div>

        <div style={styles.album}>{getTrackAlbum(track)}</div>

        <div style={styles.duration}>{formatDuration(track.duration)}</div>
      </button>
    )
  }
)

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: 'grid',
    gridTemplateColumns: '32px 32px 1.5fr 1fr 50px',
    alignItems: 'center',
    gap: '1rem',
    padding: '0.5rem 1rem',
    border: '1px solid var(--border-color)',
    borderRadius: '2px',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    transition: 'all 0.1s ease',
    position: 'relative',
    overflow: 'hidden',
  },
  indexWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  index: {
    fontSize: '0.6rem',
    opacity: 0.3,
    fontWeight: 700,
    fontFamily: 'var(--font-mono)'
  },
  artWrap: {
    width: 32,
    height: 32,
    flexShrink: 0,
    border: '1px solid var(--border-color)',
  },
  albumArt: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
    transition: 'filter 0.3s ease',
  },
  info: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' },
  name: {
    fontSize: '0.75rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    letterSpacing: '-0.01em',
  },
  artist: {
    fontSize: '0.65rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    opacity: 0.4,
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
  },
  duration: {
    fontSize: '0.65rem',
    opacity: 0.3,
    textAlign: 'right',
    fontFamily: 'var(--font-mono)',
  },
  explicitBadge: {
    fontSize: '0.6rem',
    fontWeight: 700,
    width: '12px',
    height: '12px',
    border: '1px solid',
    borderRadius: '2px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    opacity: 0.6,
  },
}
