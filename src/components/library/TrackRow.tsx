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
        boxShadow: [
          `inset 0 0 20px ${accentColour}15, 0 4px 12px rgba(0,0,0,0.2)`,
          `inset 0 0 30px ${accentColour}30, 0 8px 24px ${accentColour}44`,
          `inset 0 0 20px ${accentColour}15, 0 4px 12px rgba(0,0,0,0.2)`
        ],
        scale: 1 + bassPower * 0.015,
      }}
      transition={{ duration: 0.1 }}
      style={{
        position: 'absolute',
        inset: -1,
        borderRadius: 'inherit',
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

const PlayingBars = ({ color }: { color: string }) => (
  <div
    aria-hidden="true"
    style={{
      display: 'flex',
      alignItems: 'flex-end',
      gap: '2px',
      height: '12px',
      width: '12px',
    }}
  >
    {[0.6, 0.8, 0.5].map((delay, i) => (
      <motion.span
        key={i}
        animate={{
          height: ['15%', '100%', '15%'],
          opacity: [0.4, 1, 0.4],
        }}
        transition={{
          duration: delay,
          repeat: Infinity,
          ease: 'circInOut',
        }}
        style={{
          flex: 1,
          background: color,
          borderRadius: '1px',
        }}
      />
    ))}
  </div>
)

export const TrackRow = React.memo(
  ({
    track,
    isActive,
    isPlaying,
    isFocused,
    index,
    onSelect,
    accentColour = '#1db954',
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

    const accentBg = `${accentColour}12`
    const accentBorder = `${accentColour}60`

    return (
      <motion.button
        whileHover={{ scale: 1.01, x: 6 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 18 }}
        style={{
          ...styles.row,
          background: isActive
            ? accentBg
            : isHovered || isFocused
              ? `linear-gradient(90deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)`
              : 'transparent',
          borderColor: isActive
            ? accentBorder
            : isFocused
              ? `${accentColour}80`
              : isHovered
                ? 'rgba(255,255,255,0.2)'
                : 'rgba(255,255,255,0.08)',
          boxShadow: isActive
            ? `inset 0 0 20px ${accentColour}15, 0 8px 16px rgba(0,0,0,0.2)`
            : isHovered
              ? `inset 0 0 15px rgba(255,255,255,0.05), 0 6px 20px rgba(0,0,0,0.15)`
              : isFocused
                ? `inset 0 0 0 2px ${accentColour}`
                : 'none',
          outline: 'none',
        }}
        onClick={handleSelect}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label={`Play ${track.title} by ${getTrackArtist(track)}${isDeezerTrack(track) && track.explicit_lyrics ? ' (Explicit)' : ''}`}
        aria-pressed={isActive}
      >
        {isActive && isPlaying && <BassReactiveGlow accentColour={accentColour} />}

        <div style={styles.indexWrap}>
          {isActive ? (
            isPlaying ? (
              <PlayingBars color={accentColour} />
            ) : (
              <span style={{ ...styles.playingIndicator, color: accentColour }} aria-hidden="true">
                ▶
              </span>
            )
          ) : isHovered || isFocused ? (
            <span style={{ ...styles.playingIndicator, opacity: 0.5, color: '#fff' }} aria-hidden="true">
              ▶
            </span>
          ) : (
            <span style={styles.index}>{index + 1}</span>
          )}
        </div>

        <div style={styles.artWrap}>
          <motion.img
            layoutId={`album-${track.id}`}
            src={getTrackCover(track)}
            alt={getTrackAlbum(track)}
            style={styles.albumArt}
            loading="lazy"
          />
          {isDeezerTrack(track) && track.explicit_lyrics && (
            <div
              style={{
                ...styles.explicitBadge,
                color: accentColour,
                borderColor: `${accentColour}66`,
              }}
              aria-label="Explicit content"
              title="Explicit content"
            >
              E
            </div>
          )}
        </div>

        <div style={styles.info}>
          <p
            style={{
              ...styles.name,
              color: isActive ? accentColour : '#f0f0f0',
              transition: 'color 0.5s ease',
            }}
            title={track.title}
          >
            {track.title}
          </p>
          <p
            style={styles.artist}
            onClick={handleArtistClick}
            title={getTrackArtist(track)}
          >
            {getTrackArtist(track)}
          </p>
        </div>

        <p style={styles.album} title={getTrackAlbum(track)}>
          {getTrackAlbum(track)}
        </p>

        <span style={styles.duration}>{formatDuration(track.duration)}</span>
      </motion.button>
    )
  }
)

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
    position: 'relative',
  },
  indexWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
  },
  index: { fontSize: '0.7rem', opacity: 0.5 },
  playingIndicator: { fontSize: '0.7rem' },
  artWrap: {
    position: 'relative',
    width: 36,
    height: 36,
    flexShrink: 0,
  },
  explicitBadge: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 10,
    height: 10,
    borderRadius: 2,
    border: '1px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.65rem',
    fontWeight: 700,
    background: 'rgba(0,0,0,0.7)',
  },
  albumArt: {
    width: '100%',
    height: '100%',
    borderRadius: '3px',
    objectFit: 'cover',
    display: 'block',
  },
  info: { minWidth: 0 },
  name: {
    fontSize: '0.82rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginBottom: '0.12rem',
    letterSpacing: '0.01em',
  },
  artist: {
    fontSize: '0.7rem',
    opacity: 0.5,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    cursor: 'pointer',
  },
  album: {
    fontSize: '0.7rem',
    opacity: 0.5,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontFamily: 'monospace',
  },
  duration: {
    fontSize: '0.7rem',
    opacity: 0.5,
    flexShrink: 0,
    fontVariantNumeric: 'tabular-nums',
  },
}
