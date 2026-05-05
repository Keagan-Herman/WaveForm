/**
 * PlayerBar.tsx
 *
 * Fixed bottom bar with playback controls.
 * Reads from playerStore — does not own any audio logic.
 * All interactions go through the store; PreviewPlayer reacts to store changes.
 */

/**
 * PlayerBar.tsx — Deezer version
 *
 * Changes from Spotify version:
 * - formatDuration now receives seconds (Deezer) not milliseconds (Spotify)
 * - artist name: track.artist.name instead of track.artists.map(...)
 * - album art: track.album.cover_medium instead of getAlbumArt helper
 */

/**
 * PlayerBar.tsx — enhanced
 *
 * Added accentColour prop for dynamic theming.
 * Play button, progress bar, and album art pulse all use the accent colour.
 * Contrast improved throughout.
 */

import React from 'react'
import { useCallback } from 'react'
import { usePlayerStore } from '@/stores/playerStore'
import { useVisualiserStore } from '@/stores/visualiserStore'
import { formatDuration } from '@/lib/deezerApi'

interface PlayerBarProps {
  accentColour?: string
}

export function PlayerBar({ accentColour = '#1db954' }: PlayerBarProps) {
  const {
    currentTrack,
    isPlaying,
    isLoading,
    progress,
    duration,
    setIsPlaying,
    nextTrack,
    prevTrack,
    queue,
    queueIndex,
  } = usePlayerStore()

  const beat = useVisualiserStore(state => state.beat)

  const handlePlayPause = useCallback(() => {
    if (!currentTrack) return
    setIsPlaying(!isPlaying)
  }, [currentTrack, isPlaying, setIsPlaying])

  const handleNext = useCallback(() => { nextTrack() }, [nextTrack])
  const handlePrev = useCallback(() => { prevTrack() }, [prevTrack])

  const canPrev = queueIndex > 0
  const canNext = queueIndex < queue.length - 1
  const currentTime = duration * progress

  if (!currentTrack) return null

  return (
    <div style={styles.bar}>
      {/* Progress bar */}
      <div style={styles.progressTrack}>
        <div style={{
          ...styles.progressFill,
          width: `${progress * 100}%`,
          background: beat ? '#fff' : accentColour,
          boxShadow: beat ? `0 0 8px ${accentColour}` : 'none',
          transition: beat
            ? 'background 0.05s, box-shadow 0.05s'
            : 'background 0.5s, width 0.1s linear',
        }} />
      </div>

      <div style={styles.inner}>
        {/* Track info */}
        <div style={styles.trackInfo}>
          <img
            src={currentTrack.album.cover_medium}
            alt={currentTrack.album.title}
            style={{
              ...styles.albumArt,
              transform: beat && isPlaying ? 'scale(1.06)' : 'scale(1)',
              boxShadow: `0 4px 16px rgba(0,0,0,0.5)`,
              transition: 'transform 0.1s',
            }}
          />
          <div style={styles.trackText}>
            <p style={styles.trackName}>{currentTrack.title}</p>
            <p style={{ ...styles.trackArtist, color: `${accentColour}cc` }}>
              {currentTrack.artist.name}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div style={styles.controls}>
          <button
            style={{ ...styles.controlBtn, opacity: canPrev ? 0.7 : 0.2 }}
            onClick={handlePrev}
            disabled={!canPrev}
            aria-label="Previous track"
          >
            ⏮
          </button>
          <button
            style={{
              ...styles.playBtn,
              background: accentColour,
              boxShadow: `0 0 20px ${accentColour}66`,
            }}
            onClick={handlePlayPause}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isLoading ? '…' : isPlaying ? '⏸' : '▶'}
          </button>
          <button
            style={{ ...styles.controlBtn, opacity: canNext ? 0.7 : 0.2 }}
            onClick={handleNext}
            disabled={!canNext}
            aria-label="Next track"
          >
            ⏭
          </button>
        </div>

        {/* Time */}
        <div style={styles.time}>
          <span style={styles.timeText}>
            {formatDuration(Math.floor(currentTime))} / 30
          </span>
          <span style={styles.previewLabel}>30s preview</span>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    background: 'rgba(5,8,5,0.95)',
    backdropFilter: 'blur(24px)',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    zIndex: 50,
  },
  progressTrack: {
    height: 2,
    background: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  progressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    borderRadius: 1,
  },
  inner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.65rem 2rem',
    gap: '1rem',
  },
  trackInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flex: 1,
    minWidth: 0,
  },
  albumArt: {
    width: 42,
    height: 42,
    borderRadius: '4px',
    flexShrink: 0,
    objectFit: 'cover',
  },
  trackText: { minWidth: 0 },
  trackName: {
    fontSize: '0.85rem',
    fontFamily: 'monospace',
    color: '#f0f0f0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginBottom: '0.18rem',
  },
  trackArtist: {
    fontSize: '0.72rem',
    fontFamily: 'monospace',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    transition: 'color 1s ease',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    flexShrink: 0,
  },
  controlBtn: {
    background: 'none',
    border: 'none',
    color: '#f0f0f0',
    fontSize: '1rem',
    cursor: 'pointer',
    padding: '0.25rem',
    lineHeight: 1,
  },
  playBtn: {
    width: 42,
    height: 42,
    borderRadius: '50%',
    border: 'none',
    color: '#050e05',
    fontSize: '0.95rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    flexShrink: 0,
    transition: 'background 1s ease, box-shadow 1s ease',
  },
  time: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '0.15rem',
    flex: 1,
    minWidth: 0,
  },
  timeText: {
    fontFamily: 'monospace',
    fontSize: '0.72rem',
    opacity: 0.55,
    fontVariantNumeric: 'tabular-nums',
  },
  previewLabel: {
    fontFamily: 'monospace',
    fontSize: '0.55rem',
    letterSpacing: '0.1em',
    opacity: 0.25,
    textTransform: 'uppercase',
  },
}