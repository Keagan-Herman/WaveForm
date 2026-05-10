/**
 * NowPlaying.tsx — art size fixed
 *
 * Album art reduced to maxWidth 140px so track info is always visible
 * without scrolling in the bottom-left quadrant.
 * Info section is now the dominant element, not the art.
 */

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePlayerStore } from '@/stores/playerStore'
import { useVisualiserStore } from '@/stores/visualiserStore'
import { useUIStore } from '@/stores/uiStore'
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
  if (rank >= 800_000) return 'Viral'
  if (rank >= 500_000) return 'Popular'
  if (rank >= 200_000) return 'Rising'
  if (rank >= 50_000) return 'Known'
  return 'Niche'
}

export function NowPlaying({ accentColour }: NowPlayingProps) {
  const currentTrack = usePlayerStore(state => state.currentTrack)
  const isPlaying = usePlayerStore(state => state.isPlaying)
  const progress = usePlayerStore(state => state.progress)

  const beat = useVisualiserStore(state => state.beat)
  const bpm = useVisualiserStore(state => state.bpm)

  const accent = accentColour?.hex ?? '#7a8fa6'
  const accentDim = accentColour
    ? `hsla(${accentColour.h}, ${accentColour.s}%, ${accentColour.l}%, 0.18)`
    : 'rgba(122,143,166,0.18)'

  if (!currentTrack) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={styles.empty}
        >
          <div style={styles.skeletonArt} />
          <div style={styles.skeletonInfo}>
            <div style={styles.skeletonText} />
            <div style={{ ...styles.skeletonText, width: '60%', opacity: 0.5 }} />
          </div>
          <p style={styles.emptyIcon}>◎</p>
          <p style={styles.emptyText}>Nothing playing</p>
        </motion.div>
      </AnimatePresence>
    )
  }

  const releaseYear = currentTrack.album.release_date
    ? new Date(currentTrack.album.release_date).getFullYear()
    : null

  const durationStr = `${Math.floor(currentTrack.duration / 60)}:${String(currentTrack.duration % 60).padStart(2, '0')}`
  const elapsedSecs = Math.min(30, Math.round(progress * 30))
  const elapsedStr = `0:${String(elapsedSecs).padStart(2, '0')}`

  return (
    <motion.div
      key={currentTrack.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{ ...styles.wrap, background: `linear-gradient(135deg, ${accentDim}, transparent)` }}
    >

      {/* Top row: small art + primary text */}
      <div style={styles.topRow}>
        <div style={styles.artWrap}>
          <img
            src={currentTrack.album.cover_big}
            alt={currentTrack.album.title}
            style={{
              ...styles.art,
              transform: beat && isPlaying
                ? 'scale(1.04) rotate(0.3deg)'
                : 'scale(1) rotate(0deg)',
              transition: beat ? 'transform 0.08s ease-out' : 'transform 0.5s ease-out',
              boxShadow: `0 8px 24px rgba(0,0,0,0.6), 0 0 20px ${accentDim}`,
            }}
          />
          {currentTrack.explicit_lyrics && (
            <div
              style={{ ...styles.explicitBadge, color: accent, borderColor: `${accent}55` }}
              aria-label="Explicit content"
            >
              E
            </div>
          )}
        </div>

        <div style={styles.titleBlock}>
          <p style={styles.albumName}>{currentTrack.album.title}</p>
          <p style={styles.trackName}>{currentTrack.title}</p>
          <ArtistRipple active={isPlaying} color={accent}>
            <p
              style={{ ...styles.artistName, color: accent, cursor: 'pointer' }}
              onClick={() => useUIStore.getState().setSelectedArtistId(currentTrack.artist.id)}
            >
              {currentTrack.artist.name}
            </p>
          </ArtistRipple>
        </div>
      </div>

      {/* Scrubber */}
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
          <span style={{ ...styles.timeLabel, opacity: 0.3 }}>0:30</span>
        </div>
      </div>

      {/* Meta grid */}
      <div style={styles.metaGrid}>
        <MetaRow label="Duration" value={durationStr} accent={accent} />
        <MetaRow label="Rank" value={formatRank(currentTrack.rank)} accent={accent} />
        {releaseYear && <MetaRow label="Year" value={String(releaseYear)} accent={accent} />}
        {currentTrack.artist.nb_fan !== undefined && currentTrack.artist.nb_fan > 0 && (
          <MetaRow label="Fans" value={formatFans(currentTrack.artist.nb_fan)} accent={accent} />
        )}
        {bpm > 0 && (
          <MetaRow
            label="Live BPM"
            value={`${Math.round(bpm)}`}
            accent={accent}
            indicator={beat}
          />
        )}
        <MetaRow label="Explicit" value={currentTrack.explicit_lyrics ? 'Yes' : 'No'} accent={accent} />
      </div>
    </motion.div>
  )
}

function MetaRow({
  label,
  value,
  accent,
  indicator,
}: {
  label: string
  value: string
  accent: string
  indicator?: boolean
}) {
  return (
    <div style={metaRowStyles.row}>
      <span style={metaRowStyles.label}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        {indicator !== undefined && (
          <motion.div
            animate={{
              scale: indicator ? 1.4 : 1,
              opacity: indicator ? 1 : 0.4,
              backgroundColor: indicator ? '#fff' : accent,
            }}
            transition={{ duration: 0.1 }}
            style={{ width: 4, height: 4, borderRadius: '50%', background: accent }}
          />
        )}
        <span style={{ ...metaRowStyles.value, color: `${accent}dd` }}>{value}</span>
      </div>
    </div>
  )
}

const metaRowStyles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.22rem 0',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  label: {
    fontSize: '0.58rem',
    opacity: 0.42,
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
  emptyIcon: { fontSize: '2rem', zIndex: 2 },
  emptyText: {
    fontSize: '0.72rem',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    zIndex: 2,
  },
  skeletonArt: {
    width: 110,
    height: 110,
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '6px',
    marginBottom: '0.5rem',
  },
  skeletonInfo: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '2rem',
  },
  skeletonText: {
    width: '80%',
    height: 12,
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '2px',
  },
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
    padding: '0.75rem 1.25rem 1.25rem',
    height: '100%',
    overflow: 'hidden',
    fontFamily: 'monospace',
  },

  // Top row
  topRow: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'flex-start',
    flexShrink: 0,
  },
  artWrap: {
    position: 'relative',
    flexShrink: 0,
    width: 110,
    height: 110,
    cursor: 'pointer',
    transition: 'transform 0.3s ease',
  },
  art: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '6px',
    display: 'block',
  },
  explicitBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 3,
    border: '1px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.5rem',
    fontWeight: 700,
    background: 'rgba(0,0,0,0.6)',
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    paddingTop: '0.1rem',
  },
  albumName: {
    fontSize: '0.56rem',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    opacity: 0.45,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  trackName: {
    fontSize: '0.95rem',
    color: '#fff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    letterSpacing: '-0.01em',
    fontWeight: 500,
    lineHeight: 1.2,
  },
  artistName: {
    fontSize: '0.78rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    padding: '0.1rem 0',
  },

  // Scrubber
  scrubberWrap: { flexShrink: 0 },
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
    marginTop: '0.3rem',
  },
  timeLabel: {
    fontSize: '0.56rem',
    opacity: 0.5,
    fontVariantNumeric: 'tabular-nums',
  },

  // Meta
  metaGrid: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
  },
}