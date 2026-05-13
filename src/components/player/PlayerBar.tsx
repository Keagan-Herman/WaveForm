import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '../../stores/playerStore';
import { WaveformLine } from '../visualiser/WaveformLine';
import { LocalFileLoader } from './LocalFileLoader';
import { getTrackCover, getTrackArtist, isLocalTrack } from '../../types/track';

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconPrev() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 3.5L3 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M13 3.5L6 8L13 12.5V3.5Z" fill="currentColor" />
    </svg>
  );
}

function IconNext() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M13 3.5L13 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M3 3.5L10 8L3 12.5V3.5Z" fill="currentColor" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M4 2.5L14 9L4 15.5V2.5Z" fill="currentColor" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="4" y="2.5" width="3.5" height="13" rx="1" fill="currentColor" />
      <rect x="10.5" y="2.5" width="3.5" height="13" rx="1" fill="currentColor" />
    </svg>
  );
}

// ─── Time formatter ───────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Control button ───────────────────────────────────────────────────────────

interface ControlBtnProps {
  onClick: () => void;
  children: React.ReactNode;
  label: string;
  large?: boolean;
}

function ControlBtn({ onClick, children, label, large = false }: ControlBtnProps) {
  return (
    <motion.button
      onClick={onClick}
      aria-label={label}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: large ? 40 : 32,
        height: large ? 40 : 32,
        borderRadius: '50%',
        border: 'none',
        background: large ? '#1db954' : 'transparent',
        color: large ? '#050e05' : 'rgba(255,255,255,0.75)',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      {children}
    </motion.button>
  );
}

// ─── PlayerBar ────────────────────────────────────────────────────────────────

export function PlayerBar() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    togglePlay,
    nextTrack,
    prevTrack,
  } = usePlayerStore();

  const duration = currentTrack?.duration ?? 0;
  const progress = duration > 0 ? currentTime / duration : 0;

  const trackCover = currentTrack ? getTrackCover(currentTrack) : '';
  const trackArtist = currentTrack ? getTrackArtist(currentTrack) : '';
  const isLocal = currentTrack !== null && isLocalTrack(currentTrack);

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 72,
        background: 'rgba(5, 10, 5, 0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(29, 185, 84, 0.12)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '0 20px',
        zIndex: 200,
      }}
    >
      {/* ── Track info ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: 220,
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {/* Album art */}
        <AnimatePresence mode="popLayout">
          {trackCover ? (
            <motion.img
              key={trackCover}
              src={trackCover}
              alt="Album art"
              width={44}
              height={44}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              style={{
                borderRadius: 4,
                objectFit: 'cover',
                flexShrink: 0,
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            />
          ) : (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                width: 44,
                height: 44,
                borderRadius: 4,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="5" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
                <circle cx="8" cy="8" r="2" fill="rgba(255,255,255,0.2)" />
              </svg>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Title + artist */}
        <div style={{ overflow: 'hidden', flex: 1 }}>
          <AnimatePresence mode="popLayout">
            {currentTrack ? (
              <motion.div
                key={currentTrack.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                style={{ overflow: 'hidden' }}
              >
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#e8f5e8',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    margin: 0,
                    lineHeight: 1.3,
                    fontFamily: 'inherit',
                  }}
                >
                  {currentTrack.title}
                </p>
                <p
                  style={{
                    fontSize: 11,
                    color: 'rgba(232, 245, 232, 0.45)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    margin: 0,
                    lineHeight: 1.3,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontFamily: 'inherit',
                  }}
                >
                  {isLocal && (
                    <span
                      style={{
                        fontSize: 9,
                        fontFamily: 'monospace',
                        background: 'rgba(29, 185, 84, 0.15)',
                        color: '#1db954',
                        padding: '1px 4px',
                        borderRadius: 3,
                        letterSpacing: '0.05em',
                        flexShrink: 0,
                      }}
                    >
                      LOCAL
                    </span>
                  )}
                  {trackArtist}
                </p>
              </motion.div>
            ) : (
              <motion.p
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  fontSize: 12,
                  color: 'rgba(232, 245, 232, 0.25)',
                  margin: 0,
                  fontStyle: 'italic',
                  fontFamily: 'inherit',
                }}
              >
                Nothing playing
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Controls ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          flexShrink: 0,
        }}
      >
        <ControlBtn onClick={prevTrack} label="Previous track">
          <IconPrev />
        </ControlBtn>
        <ControlBtn onClick={togglePlay} label={isPlaying ? 'Pause' : 'Play'} large>
          {isPlaying ? <IconPause /> : <IconPlay />}
        </ControlBtn>
        <ControlBtn onClick={nextTrack} label="Next track">
          <IconNext />
        </ControlBtn>
      </div>

      {/* ── Waveform + time ── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontFamily: 'monospace',
            color: 'rgba(232, 245, 232, 0.4)',
            flexShrink: 0,
            width: 32,
            textAlign: 'right',
          }}
        >
          {formatTime(currentTime)}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <WaveformLine height={36} />
        </div>

        <span
          style={{
            fontSize: 11,
            fontFamily: 'monospace',
            color: 'rgba(232, 245, 232, 0.4)',
            flexShrink: 0,
            width: 32,
          }}
        >
          {duration > 0 ? formatTime(duration) : '--:--'}
        </span>
      </div>

      {/* ── Right controls: upload button ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <LocalFileLoader />
      </div>
    </motion.div>
  );
}