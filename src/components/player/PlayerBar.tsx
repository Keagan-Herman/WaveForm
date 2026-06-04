import React from 'react';
import { motion } from 'framer-motion';
import { usePlayerStore } from '../../stores/playerStore';
import { useUIStore } from '../../stores/uiStore';
import { WaveformLine } from '../visualiser/WaveformLine';
import { LocalFileLoader } from './LocalFileLoader';
import { getTrackCover, getTrackArtist, isDeezerTrack } from '../../types/track';
import type { AlbumColour } from '../../hooks/useAlbumColour';

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconPrev() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M4 3V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
      <path d="M12 3L6 8L12 13V3Z" fill="currentColor" />
    </svg>
  );
}

function IconNext() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M12 3V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
      <path d="M4 3L10 8L4 13V3Z" fill="currentColor" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
      <path d="M6 4L14 9L6 14V4Z" fill="currentColor" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
      <rect x="6" y="4" width="2" height="10" fill="currentColor" />
      <rect x="10" y="4" width="2" height="10" fill="currentColor" />
    </svg>
  );
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ─── Physical Control Button ──────────────────────────────────────────────────

function PhysicalBtn({
  onClick,
  children,
  label,
  active = false,
  accentColor,
}: {
  onClick: () => void;
  children: React.ReactNode;
  label: string;
  active?: boolean;
  accentColor: string;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.08)' }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 18 }}
      onClick={onClick}
      aria-label={label}
      style={{
        ...styles.physicalBtn,
        backgroundColor: active ? accentColor : 'rgba(255,255,255,0.03)',
        borderColor: active ? accentColor : 'var(--border-color)',
        color: active ? '#000' : 'inherit',
      }}
    >
      {children}
    </motion.button>
  );
}

// ─── PlaybackProgress ─────────────────────────────────────────────────────────

function PlaybackProgress() {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.currentTrack?.duration ?? 0);

  return (
    <div style={styles.progressContainer}>
      <span style={styles.timeLabel}>{formatTime(currentTime)}</span>
      <div style={styles.waveformWrap}>
        <WaveformLine height={32} />
      </div>
      <span style={styles.timeLabel}>{duration > 0 ? formatTime(duration) : '00:00'}</span>
    </div>
  );
}

// ─── PlayerBar ────────────────────────────────────────────────────────────────

export function PlayerBar({ accent }: { accent: AlbumColour }) {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const nextTrack = usePlayerStore((s) => s.nextTrack);
  const prevTrack = usePlayerStore((s) => s.prevTrack);

  const trackCover = currentTrack ? getTrackCover(currentTrack) : '';
  const trackArtist = currentTrack ? getTrackArtist(currentTrack) : '';

  return (
    <motion.footer
      initial={{ y: 80 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 30 }}
      style={{
        ...styles.footer,
        backgroundColor: 'var(--bg-color)',
        borderTop: '1px solid var(--border-color)',
      }}
    >
      {/* 1. Hardware Details / Track Info */}
      <div style={styles.infoSection}>
        <div style={styles.artFrame}>
          {trackCover && (
            <img src={trackCover} alt="" style={styles.art} />
          )}
        </div>
        <div style={styles.meta}>
          <div style={styles.title}>{currentTrack?.title || 'System Standby'}</div>
          <div style={styles.artist} onClick={() => {
             if (currentTrack && isDeezerTrack(currentTrack)) {
               useUIStore.getState().setSelectedArtistId(currentTrack.artist.id);
             }
          }}>
            {trackArtist || 'Ready'}
          </div>
        </div>
      </div>

      {/* 2. Transport Controls */}
      <div style={styles.transport}>
        <PhysicalBtn onClick={prevTrack} label="Prev" accentColor={accent.hex}>
          <IconPrev />
        </PhysicalBtn>
        <motion.button
          whileHover={{ scale: 1.08, boxShadow: `0 0 20px ${accent.hex}44` }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18 }}
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          style={{
            ...styles.playBtn,
            backgroundColor: isPlaying ? accent.hex : 'rgba(255,255,255,0.05)',
            color: isPlaying ? '#000' : '#fff',
            borderColor: isPlaying ? accent.hex : 'var(--border-color)',
          }}
        >
          {isPlaying ? <IconPause /> : <IconPlay />}
        </motion.button>
        <PhysicalBtn onClick={nextTrack} label="Next" accentColor={accent.hex}>
          <IconNext />
        </PhysicalBtn>
      </div>

      {/* 3. Data Readout (Progress) */}
      <div style={styles.readoutSection}>
        <PlaybackProgress />
      </div>

      {/* 4. Functional Utilities */}
      <div style={styles.utilitySection}>
        <LocalFileLoader accent={accent} />
      </div>
    </motion.footer>
  );
}

const styles: Record<string, React.CSSProperties> = {
  footer: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    display: 'flex',
    alignItems: 'center',
    padding: '0 2rem',
    zIndex: 200,
    gap: '3rem',
  },
  infoSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    minWidth: '240px',
  },
  artFrame: {
    width: 48,
    height: 48,
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  art: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  meta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    overflow: 'hidden',
  },
  title: {
    fontSize: '0.8rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    letterSpacing: '-0.01em',
  },
  artist: {
    fontSize: '0.65rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    opacity: 0.5,
    cursor: 'pointer',
  },
  transport: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  physicalBtn: {
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid',
    borderRadius: '2px',
    transition: 'all 0.1s ease',
  },
  playBtn: {
    width: 44,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--border-color)',
    borderRadius: '2px',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)',
    transition: 'all 0.1s ease',
    cursor: 'pointer',
  },
  readoutSection: {
    flex: 1,
    minWidth: 0,
  },
  progressContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
  },
  timeLabel: {
    fontSize: '0.65rem',
    fontFamily: 'monospace',
    opacity: 0.4,
    width: '40px',
  },
  waveformWrap: {
    flex: 1,
    height: 32,
    opacity: 0.3,
  },
  utilitySection: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  }
}
