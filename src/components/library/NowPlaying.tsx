/**
 * NowPlaying.tsx — full track info + timer fix
 *
 * Added:
 * - Release year from album.release_date
 * - Artist fan count formatted nicely
 * - Explicit track indicator
 * - Track rank formatted as chart position
 * - Correct timer: Math.round(progress * 30) not floor — no more 29.98s
 * - Scrollable info section so nothing gets cut off
 */

import React from 'react'
import { usePlayerStore } from '@/stores/playerStore'
import { useVisualiserStore } from '@/stores/visualiserStore'
import { ArtistRipple } from '@/components/search/ArtistRipple'
import type { AlbumColour } from '@/hooks/useAlbumColour'

interface NowPlayingProps {
  accentColour?: AlbumColour
}

function formatFans(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`
  return String(n)
}

function formatRank(rank: number): string {
  // Deezer rank is 0–1,000,000 — express as a tier
  if (rank >= 800_000) return 'Viral'
  if (rank >= 500_000) return 'Popular'
  if (rank >= 200_000) return 'Rising'
  if (rank >= 50_000) return 'Known'
  return 'Niche'
}

export function NowPlaying({ accentColour }: NowPlayingProps) {
  const { currentTrack, isPlaying, progress } = usePlayerStore()
  const beat = useVisualiserStore(state => state.beat)

  const accent = accentColour?.hex ?? '#1db954'
  const accentDim = accentColour
    ? `hsla(${accentColour.h}, ${accentColour.s}%, ${accentColour.l}%, 0.18)`
    : 'rgba(29,185,84,0.18)'

  if (!currentTrack) {
    return (
      <div style={styles.empty}>
        <p style={styles.emptyIcon}>◎</p>
        <p style={styles.emptyText}>Nothing playing</p>
      </div>
    )
  }

  const releaseYear = currentTrack.album.release_date
    ? new Date(currentTrack.album.release_date).getFullYear()
    : null

  const duration = currentTrack.duration
  const durationStr = `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`

  // FIXED: Math.round so it hits 0:30 cleanly
  const elapsedSecs = Math.min(30, Math.round(progress * 30))
  const elapsedStr = `0:${String(elapsedSecs).padStart(2, '0')}`

  return (
    <div style={styles.wrap}>
      {/* Album art */}
      <div style={styles.artWrap}>
        <img
          src={currentTrack.album.cover_medium}
          alt={currentTrack.album.title}
          style={{
            ...styles.art,
            transform: beat && isPlaying
              ? 'scale(1.03) rotate(0.4deg)'
              : 'scale(1) rotate(0deg)',
            transition: beat ? 'transform 0.08s ease-out' : 'transform 0.5s ease-out',
            boxShadow: `0 12px 40px rgba(0,0,0,0.7), 0 0 32px ${accentDim}`,
          }}
        />
        {isPlaying && (
          <div style={{
            ...styles.artGlow,
            background: `radial-gradient(ellipse at center, ${accentDim} 0%, transparent 70%)`,
          }} />
        )}
        {currentTrack.explicit_lyrics && (
          <div style={{ ...styles.explicitBadge, background: `${accent}22`, color: accent, borderColor: `${accent}44` }}>
            E
          </div>
        )}
      </div>

      {/* Track info — scrollable */}
      <div style={styles.infoScroll}>
        <div style={styles.info}>

          <p style={styles.albumName}>{currentTrack.album.title}</p>
          <p style={styles.trackName}>{currentTrack.title}</p>

          <ArtistRipple active={isPlaying} color={accent}>
            <p style={{ ...styles.artistName, color: accent }}>
              {currentTrack.artist.name}
            </p>
          </ArtistRipple>

          <div style={styles.metaDivider} />

          {/* Meta grid */}
          <MetaRow label="Duration" value={durationStr} accent={accent} />
          <MetaRow label="Rank" value={formatRank(currentTrack.rank)} accent={accent} />
          {releaseYear && <MetaRow label="Released" value={String(releaseYear)} accent={accent} />}
          {currentTrack.artist.nb_fan !== undefined && (
            <MetaRow label="Fans" value={formatFans(currentTrack.artist.nb_fan)} accent={accent} />
          )}
          <MetaRow
            label="Explicit"
            value={currentTrack.explicit_lyrics ? 'Yes' : 'No'}
            accent={accent}
          />

          <div style={styles.metaDivider} />

          {/* Progress scrubber */}
          <div style={styles.scrubberWrap}>
            <div style={styles.scrubberTrack}>
              <div style={{
                ...styles.scrubberFill,
                width: `${progress * 100}%`,
                background: beat ? '#fff' : accent,
                boxShadow: beat ? `0 0 10px ${accent}` : 'none',
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
              <span style={styles.timeLabel}>{elapsedStr}</span>
              <span style={{ ...styles.timeLabel, opacity: 0.35 }}>0:30 preview</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetaRow({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={metaStyles.row}>
      <span style={metaStyles.label}>{label}</span>
      <span style={{ ...metaStyles.value, color: `${accent}dd` }}>{value}</span>
    </div>
  )
}

const metaStyles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.2rem 0',
  },
  label: {
    fontSize: '0.6rem',
    opacity: 0.45,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    fontFamily: 'monospace',
  },
  value: {
    fontSize: '0.68rem',
    fontFamily: 'monospace',
    fontVariantNumeric: 'tabular-nums',
    transition: 'color 1s ease',
  },
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
    height: '100%',
    overflow: 'hidden',
  },
  artWrap: {
    position: 'relative',
    flexShrink: 0,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 200,
    aspectRatio: '1',
    margin: '1.25rem auto 0.75rem',
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
    inset: -14,
    borderRadius: 22,
    pointerEvents: 'none',
    animation: 'pulse 2s ease-in-out infinite',
  },
  explicitBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 3,
    border: '1px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.55rem',
    fontFamily: 'monospace',
    fontWeight: 700,
  },
  infoScroll: {
    flex: 1,
    overflowY: 'auto',
    minHeight: 0,
  },
  info: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.3rem',
    padding: '0 1.25rem 1.25rem',
    fontFamily: 'monospace',
  },
  albumName: {
    fontSize: '0.58rem',
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
    lineHeight: 1.25,
  },
  artistName: {
    fontSize: '0.8rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    padding: '0.1rem 0',
  },
  metaDivider: {
    height: 1,
    background: 'rgba(255,255,255,0.07)',
    margin: '0.4rem 0',
  },
  scrubberWrap: {
    paddingTop: '0.4rem',
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
    marginTop: '0.35rem',
  },
  timeLabel: {
    fontSize: '0.58rem',
    opacity: 0.5,
    fontVariantNumeric: 'tabular-nums',
  },
}