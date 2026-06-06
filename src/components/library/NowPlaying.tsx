/**
 * NowPlaying.tsx — Redesigned for Functionalism & Japanese Minimalism
 */

import React from 'react'
import { motion } from 'framer-motion'
import { usePlayerStore } from '@/stores/playerStore'
import { useVisualiserStore } from '@/stores/visualiserStore'
import { useUIStore } from '@/stores/uiStore'
import { ArtistRipple } from '@/components/search/ArtistRipple'
import type { AlbumColour } from '@/hooks/useAlbumColour'
import { getTrackCover, getTrackArtist, getTrackAlbum, isDeezerTrack } from '@/types/track'

interface NowPlayingProps {
  accent?: AlbumColour
}

function formatRank(rank: number): string {
  if (rank >= 800_000) return 'Viral'
  if (rank >= 500_000) return 'Popular'
  if (rank >= 200_000) return 'Rising'
  if (rank >= 50_000) return 'Known'
  return 'Niche'
}

function NowPlayingProgress({ accent }: { accent: string }) {
  const currentTime = usePlayerStore(s => s.currentTime)
  const duration = usePlayerStore(s => s.currentTrack?.duration ?? 0)
  const progress = duration > 0 ? currentTime / duration : 0

  const durationStr = `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}`
  const elapsedStr = `${Math.floor(currentTime / 60)}:${String(Math.floor(currentTime % 60)).padStart(2, '0')}`

  return (
    <div style={styles.scrubberWrap}>
      <div style={styles.scrubberTrack}>
        <div
          style={{
            ...styles.scrubberFill,
            width: `${progress * 100}%`,
            background: accent,
          }}
        />
      </div>
      <div style={styles.scrubberLabels}>
        <span style={styles.timeLabel}>{elapsedStr}</span>
        <span style={styles.timeLabel}>{durationStr}</span>
      </div>
    </div>
  )
}

export function NowPlaying({ accent: accentColour }: NowPlayingProps) {
  const currentTrack = usePlayerStore(state => state.currentTrack)
  const isPlaying = usePlayerStore(state => state.isPlaying)
  const beat = useVisualiserStore(state => state.beat)
  const bpm = useVisualiserStore(state => state.bpm)

  const accent = accentColour?.hex ?? '#7a8fa6'

  if (!currentTrack) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyIcon}>■</div>
        <div style={styles.emptyText}>Standing by for signal.</div>
      </div>
    )
  }

  const releaseYear =
    isDeezerTrack(currentTrack) && currentTrack.album.release_date
      ? new Date(currentTrack.album.release_date).getFullYear()
      : null

  return (
    <motion.div
      key={currentTrack.id}
      initial={{ opacity: 0, x: 20, filter: 'blur(10px)' }}
      animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      style={styles.wrap}
    >
      <div style={styles.dossierLabel}>TRACK_DOSSIER_v2.1</div>

      {/* 1. Primary Identity Area */}
      <div style={styles.identity}>
        <motion.div
          whileHover={{ scale: 1.02 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          style={styles.artFrame}
        >
          <img src={getTrackCover(currentTrack)} alt="" style={styles.art} />
          {isPlaying && (
            <motion.div
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ ...styles.artGlow, boxShadow: `0 0 40px ${accent}44` }}
            />
          )}
        </motion.div>
        <div style={styles.titleArea}>
          <div style={styles.trackTitle}>{currentTrack.title}</div>
          <ArtistRipple active={isPlaying} color={accent}>
            <motion.div
              whileHover={{ x: 4 }}
              style={{ ...styles.artistName, color: accent }}
              onClick={() => {
                if (isDeezerTrack(currentTrack)) {
                  useUIStore.getState().setSelectedArtistId(currentTrack.artist.id)
                }
              }}
            >
              {getTrackArtist(currentTrack)}
            </motion.div>
          </ArtistRipple>
          <div style={styles.albumTitle}>{getTrackAlbum(currentTrack)}</div>
        </div>
      </div>

      {/* 2. Technical Readout (Meta) */}
      <div style={styles.techReadout}>
        <div style={styles.readoutItem}>
          <span style={styles.readoutLabel}>SIGNAL_STATUS</span>
          <span style={{ ...styles.readoutValue, color: beat ? '#fff' : accent }}>
            {isPlaying ? 'ACTIVE_BROADCAST' : 'CARRIER_DETECTED'}
          </span>
        </div>
        <div style={styles.readoutItem}>
          <span style={styles.readoutLabel}>TEMPO_ESTIMATE</span>
          <span style={{ ...styles.readoutValue, color: beat ? '#fff' : 'inherit' }}>
            {isPlaying ? `${Math.round(bpm)} BPM` : '---'}
          </span>
        </div>
        {releaseYear && (
          <div style={styles.readoutItem}>
            <span style={styles.readoutLabel}>ARCHIVE_YEAR</span>
            <span style={styles.readoutValue}>{releaseYear}</span>
          </div>
        )}
        {isDeezerTrack(currentTrack) && (
          <>
            <div style={styles.readoutItem}>
              <span style={styles.readoutLabel}>CURRENCY_RANK</span>
              <span style={styles.readoutValue}>{formatRank(currentTrack.rank)}</span>
            </div>
            <div style={styles.readoutItem}>
              <span style={styles.readoutLabel}>ENCODING_SPEC</span>
              <span style={styles.readoutValue}>MPEG_L3_128K</span>
            </div>
            <div style={styles.readoutItem}>
              <span style={styles.readoutLabel}>SOURCE_NODE</span>
              <span style={styles.readoutValue}>DEEZER_PUBLIC_CDN</span>
            </div>
          </>
        )}
      </div>

      {/* 3. Temporal Scrutiny (Scrubber) */}
      <div style={styles.scrubberContainer}>
        <div style={styles.readoutLabel}>TEMPORAL_PROGRESSION</div>
        <NowPlayingProgress accent={accent} />
      </div>

      <div style={styles.footerInfo}>
        <div style={styles.idBadge}>
          <span style={{ opacity: 0.4 }}>ID:</span> {String(currentTrack.id).slice(0, 8)}...
        </div>
        <div style={styles.idBadge}>
          <span style={{ opacity: 0.4 }}>TYPE:</span> {currentTrack.source.toUpperCase()}
        </div>
      </div>
    </motion.div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    padding: '2rem',
    height: '100%',
    gap: '1.5rem',
    position: 'relative',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 100%)',
  },
  dossierLabel: {
    fontSize: '0.55rem',
    letterSpacing: '0.3em',
    opacity: 0.25,
    fontWeight: 700,
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: '0.5rem',
  },
  identity: {
    display: 'flex',
    gap: '2rem',
    alignItems: 'flex-start',
  },
  artFrame: {
    width: 140,
    height: 140,
    border: '1px solid var(--border-color)',
    padding: '8px',
    backgroundColor: 'rgba(5, 5, 5, 0.4)',
    position: 'relative',
    flexShrink: 0,
  },
  artGlow: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    zIndex: -1,
  },
  art: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  titleArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  trackTitle: {
    fontSize: '1.5rem',
    fontWeight: 600,
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
    marginBottom: '0.5rem',
    color: '#fff',
  },
  artistName: {
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'color 0.2s ease',
  },
  albumTitle: {
    fontSize: '0.8rem',
    opacity: 0.35,
    letterSpacing: '0.02em',
    marginTop: '0.25rem',
  },
  techReadout: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    borderTop: '1px solid var(--border-color)',
    paddingTop: '1.25rem',
    background: 'rgba(255,255,255,0.01)',
    padding: '1.25rem',
    borderRadius: '4px',
    border: '1px solid rgba(255,255,255,0.03)',
  },
  readoutItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  readoutLabel: {
    fontSize: '0.6rem',
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    opacity: 0.3,
    fontWeight: 700,
  },
  readoutValue: {
    fontSize: '0.65rem',
    fontFamily: 'var(--font-mono)',
    fontWeight: 500,
  },
  scrubberContainer: {
    marginTop: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  scrubberWrap: {},
  scrubberTrack: {
    height: 2,
    background: 'rgba(255,255,255,0.05)',
    position: 'relative',
  },
  scrubberFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
  },
  scrubberLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '0.5rem',
  },
  timeLabel: {
    fontSize: '0.55rem',
    fontFamily: 'var(--font-mono)',
    opacity: 0.4,
    letterSpacing: '0.1em',
  },
  footerInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    paddingTop: '1rem',
    borderTop: '1px solid var(--border-color)',
  },
  idBadge: {
    fontSize: '0.5rem',
    fontFamily: 'var(--font-mono)',
    opacity: 0.4,
    letterSpacing: '0.1em',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '0.5rem',
    opacity: 0.2,
  },
  emptyIcon: {
    fontSize: '1.5rem',
  },
  emptyText: {
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
}
