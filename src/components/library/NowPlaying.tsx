/**
 * NowPlaying.tsx
 *
 * The right-hand panel showing the current track's detail view.
 * Sits above the visualisers and collapses gracefully when nothing is playing.
 *
 * Contains:
 * - Album art (large)
 * - Track name + artist with ArtistRipple
 * - Popularity indicator
 * - A minimal waveform scrubber (visual only — Spotify previews
 *   don't expose seek on the preview URL)
 */

/**
 * NowPlaying.tsx — Deezer version
 *
 * Changes from Spotify version:
 * - DeezerTrack field names throughout
 * - track.artist.name instead of map over artists array
 * - track.album.cover_big for large art
 * - track.album.title instead of track.album.name
 * - popularity replaced with rank (Deezer's equivalent, 0–1,000,000)
 *   normalised to 0–100 for display
 */

/**
 * NowPlaying.tsx — enhanced
 *
 * Now accepts accentColour prop for dynamic theming from album art.
 * Improved contrast throughout — opacity values bumped up significantly.
 * Album art is larger and more prominent.
 */

import React from 'react'
import { usePlayerStore } from '@/stores/playerStore'
import { useVisualiserStore } from '@/stores/visualiserStore'
import { ArtistRipple } from '@/components/search/ArtistRipple'
import type { AlbumColour } from '@/hooks/useAlbumColour'

interface NowPlayingProps {
  accentColour?: AlbumColour
}

export function NowPlaying({ accentColour }: NowPlayingProps) {
  const { currentTrack, isPlaying, progress } = usePlayerStore()
  const beat = useVisualiserStore(state => state.beat)

  const accent = accentColour?.hex ?? '#1db954'
  const accentDim = accentColour
    ? `hsla(${accentColour.h}, ${accentColour.s}%, ${accentColour.l}%, 0.15)`
    : 'rgba(29,185,84,0.15)'

  if (!currentTrack) {
    return (
      <div style={styles.empty}>
        <p style={styles.emptyIcon}>◎</p>
        <p style={styles.emptyText}>Nothing playing</p>
      </div>
    )
  }

  const popularity = Math.min(100, Math.round(currentTrack.rank / 10000))

  return (
    <div style={styles.wrap}>
      {/* Album art */}
      <div style={styles.artWrap}>
        <img
          src={currentTrack.album.cover_big}
          alt={currentTrack.album.title}
          style={{
            ...styles.art,
            transform: beat && isPlaying
              ? 'scale(1.03) rotate(0.4deg)'
              : 'scale(1) rotate(0deg)',
            transition: beat
              ? 'transform 0.08s ease-out'
              : 'transform 0.5s ease-out',
            boxShadow: `0 16px 48px rgba(0,0,0,0.7), 0 0 40px ${accentDim}`,
          }}
        />
        {isPlaying && (
          <div style={{
            ...styles.artGlow,
            background: `radial-gradient(ellipse at center, ${accentDim} 0%, transparent 70%)`,
          }} />
        )}
      </div>

      {/* Track info */}
      <div style={styles.info}>
        <p style={styles.albumName}>{currentTrack.album.title}</p>

        <p style={styles.trackName}>{currentTrack.title}</p>

        <ArtistRipple active={isPlaying} color={accent}>
          <p style={{ ...styles.artistName, color: accent }}>
            {currentTrack.artist.name}
          </p>
        </ArtistRipple>

        {/* Popularity */}
        <div style={styles.popularityWrap}>
          <span style={styles.metaLabel}>Popularity</span>
          <div style={styles.popularityTrack}>
            <div style={{
              ...styles.popularityFill,
              width: `${popularity}%`,
              background: `linear-gradient(90deg, ${accent}88, ${accent})`,
            }} />
          </div>
          <span style={styles.metaValue}>{popularity}</span>
        </div>

        {/* Duration */}
        <div style={styles.popularityWrap}>
          <span style={styles.metaLabel}>Duration</span>
          <span style={{ ...styles.metaValue, opacity: 0.6 }}>
            {Math.floor(currentTrack.duration / 60)}:{String(currentTrack.duration % 60).padStart(2, '0')}
          </span>
        </div>

        {/* Progress scrubber */}
        <div style={styles.scrubberWrap}>
          <div style={styles.scrubberTrack}>
            <div style={{
              ...styles.scrubberFill,
              width: `${progress * 100}%`,
              background: beat ? '#fff' : accent,
              boxShadow: beat ? `0 0 8px ${accent}` : 'none',
              transition: beat
                ? 'background 0.05s, box-shadow 0.05s'
                : 'background 0.3s, width 0.1s linear',
            }} />
            <div style={{
              ...styles.playhead,
              left: `${progress * 100}%`,
              background: accent,
              boxShadow: `0 0 8px ${accent}`,
              opacity: isPlaying ? 1 : 0,
            }} />
          </div>
          <div style={styles.scrubberLabels}>
            <span style={styles.timeLabel}>
              {formatTime(Math.floor(progress * 30))}
            </span>
            <span style={styles.timeLabel}>0:30</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatTime(s: number): string {
  return `0:${String(s).padStart(2, '0')}`
}

const styles: Record<string, React.CSSProperties> = {
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '0.75rem',
    opacity: 0.3,
    fontFamily: 'monospace',
  },
  emptyIcon: { fontSize: '2.5rem' },
  emptyText: {
    fontSize: '0.75rem',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
  },
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    padding: '1.5rem',
    height: '100%',
    overflow: 'hidden',
  },
  artWrap: {
    position: 'relative',
    flexShrink: 0,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 220,
    aspectRatio: '1',
  },
  art: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '8px',
    display: 'block',
  },
  artGlow: {
    position: 'absolute',
    inset: -12,
    borderRadius: 20,
    pointerEvents: 'none',
    animation: 'pulse 2s ease-in-out infinite',
  },
  info: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    flex: 1,
    minWidth: 0,
    fontFamily: 'monospace',
  },
  albumName: {
    fontSize: '0.6rem',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    opacity: 0.5,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  trackName: {
    fontSize: '1rem',
    color: '#fff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    letterSpacing: '-0.01em',
    fontWeight: 500,
    lineHeight: 1.2,
  },
  artistName: {
    fontSize: '0.82rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    padding: '0.15rem 0',
    fontWeight: 400,
  },
  popularityWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginTop: '0.25rem',
  },
  metaLabel: {
    fontSize: '0.58rem',
    opacity: 0.45,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    flexShrink: 0,
    width: 64,
  },
  popularityTrack: {
    flex: 1,
    height: 3,
    background: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  popularityFill: {
    height: '100%',
    borderRadius: 2,
    transition: 'width 0.5s ease',
  },
  metaValue: {
    fontSize: '0.6rem',
    opacity: 0.5,
    flexShrink: 0,
    fontVariantNumeric: 'tabular-nums',
  },
  scrubberWrap: {
    marginTop: 'auto',
    paddingTop: '0.75rem',
  },
  scrubberTrack: {
    height: 3,
    background: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    position: 'relative',
    overflow: 'visible',
  },
  scrubberFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    borderRadius: 2,
  },
  playhead: {
    position: 'absolute',
    top: '50%',
    width: 10,
    height: 10,
    borderRadius: '50%',
    transform: 'translate(-50%, -50%)',
    transition: 'left 0.1s linear, opacity 0.2s',
  },
  scrubberLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '0.4rem',
  },
  timeLabel: {
    fontSize: '0.58rem',
    opacity: 0.4,
    fontVariantNumeric: 'tabular-nums',
  },
}