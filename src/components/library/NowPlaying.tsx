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
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.currentTrack?.duration ?? 0);
  const progress = duration > 0 ? currentTime / duration : 0;

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
  );
}

export function NowPlaying({ accent: accentColour }: NowPlayingProps) {
  const currentTrack = usePlayerStore(state => state.currentTrack)
  const isPlaying = usePlayerStore(state => state.isPlaying)
  const beat = useVisualiserStore(state => state.beat)

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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={styles.wrap}
    >
      {/* 1. Primary Identity Area */}
      <div style={styles.identity}>
        <div style={styles.artFrame}>
          <img
            src={getTrackCover(currentTrack)}
            alt=""
            style={styles.art}
          />
        </div>
        <div style={styles.titleArea}>
           <div style={styles.trackTitle}>{currentTrack.title}</div>
           <ArtistRipple active={isPlaying} color={accent}>
             <div
               style={{ ...styles.artistName, color: accent }}
               onClick={() => {
                 if (isDeezerTrack(currentTrack)) {
                   useUIStore.getState().setSelectedArtistId(currentTrack.artist.id)
                 }
               }}
             >
               {getTrackArtist(currentTrack)}
             </div>
           </ArtistRipple>
           <div style={styles.albumTitle}>{getTrackAlbum(currentTrack)}</div>
        </div>
      </div>

      {/* 2. Technical Readout (Meta) */}
      <div style={styles.techReadout}>
        <div style={styles.readoutItem}>
          <span style={styles.readoutLabel}>Registry ID</span>
          <span style={styles.readoutValue}>{currentTrack.id}</span>
        </div>
        <div style={styles.readoutItem}>
          <span style={styles.readoutLabel}>Signal Status</span>
          <span style={{ ...styles.readoutValue, color: beat ? '#fff' : accent }}>
             {isPlaying ? 'ACTIVE_DATA_STREAM' : 'BUFFERED'}
          </span>
        </div>
        {releaseYear && (
          <div style={styles.readoutItem}>
             <span style={styles.readoutLabel}>Origin Year</span>
             <span style={styles.readoutValue}>{releaseYear}</span>
          </div>
        )}
        {isDeezerTrack(currentTrack) && (
          <div style={styles.readoutItem}>
             <span style={styles.readoutLabel}>Rank Factor</span>
             <span style={styles.readoutValue}>{formatRank(currentTrack.rank)}</span>
          </div>
        )}
      </div>

      {/* 3. Temporal Scrutiny (Scrubber) */}
      <NowPlayingProgress accent={accent} />
    </motion.div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    padding: '2rem',
    height: '100%',
    gap: '2rem',
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
    backgroundColor: 'rgba(255,255,255,0.01)',
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
  },
  artistName: {
    fontSize: '0.85rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    fontWeight: 600,
    cursor: 'pointer',
  },
  albumTitle: {
    fontSize: '0.85rem',
    opacity: 0.3,
  },
  techReadout: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    borderTop: '1px solid var(--border-color)',
    paddingTop: '1rem',
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
  scrubberWrap: {
    marginTop: 'auto',
  },
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
    fontSize: '0.6rem',
    fontFamily: 'var(--font-mono)',
    opacity: 0.3,
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
