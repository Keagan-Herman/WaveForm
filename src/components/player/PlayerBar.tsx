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

import React from 'react'
import { useCallback } from 'react'
import { usePlayerStore } from '@/stores/playerStore'
import { useVisualiserStore } from '@/stores/visualiserStore'
import { formatDuration } from '@/lib/deezerApi'

export function PlayerBar() {
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
      <div style={styles.progressTrack}>
        <div
          style={{
            ...styles.progressFill,
            width: `${progress * 100}%`,
            background: beat ? '#fff' : '#1db954',
            transition: beat ? 'background 0.05s' : 'background 0.3s, width 0.1s linear',
          }}
        />
      </div>

      <div style={styles.inner}>
        <div style={styles.trackInfo}>
          <img
            src={currentTrack.album.cover_medium}
            alt={currentTrack.album.title}
            style={{
              ...styles.albumArt,
              transform: beat && isPlaying ? 'scale(1.05)' : 'scale(1)',
              transition: 'transform 0.1s',
            }}
          />
          <div style={styles.trackText}>
            <p style={styles.trackName}>{currentTrack.title}</p>
            <p style={styles.trackArtist}>{currentTrack.artist.name}</p>
          </div>
        </div>

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
            style={styles.playBtn}
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

        <div style={styles.time}>
          <span style={styles.timeText}>
            {formatDuration(Math.floor(currentTime))} / {formatDuration(duration)}
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
    background: 'rgba(5, 14, 5, 0.92)',
    backdropFilter: 'blur(20px)',
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
    padding: '0.75rem 2rem',
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
    width: 44,
    height: 44,
    borderRadius: '3px',
    flexShrink: 0,
    objectFit: 'cover',
  },
  trackText: { minWidth: 0 },
  trackName: {
    fontSize: '0.9rem',
    fontFamily: 'monospace',
    color: '#e8f5e8',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginBottom: '0.2rem',
  },
  trackArtist: {
    fontSize: '0.75rem',
    fontFamily: 'monospace',
    color: 'rgba(232,245,232,0.45)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
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
    color: '#e8f5e8',
    fontSize: '1rem',
    cursor: 'pointer',
    padding: '0.25rem',
    lineHeight: 1,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: '#1db954',
    border: 'none',
    color: '#050e05',
    fontSize: '1rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    flexShrink: 0,
  },
  time: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '0.2rem',
    flex: 1,
    minWidth: 0,
  },
  timeText: {
    fontFamily: 'monospace',
    fontSize: '0.75rem',
    color: 'rgba(232,245,232,0.5)',
  },
  previewLabel: {
    fontFamily: 'monospace',
    fontSize: '0.6rem',
    letterSpacing: '0.1em',
    color: 'rgba(232,245,232,0.2)',
    textTransform: 'uppercase',
  },
}