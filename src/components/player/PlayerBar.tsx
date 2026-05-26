import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '../../stores/playerStore';
import { useUIStore } from '../../stores/uiStore';
import { useVisualiserStore } from '../../stores/visualiserStore';
import { WaveformLine } from '../visualiser/WaveformLine';
import { LocalFileLoader } from './LocalFileLoader';
import { getTrackCover, getTrackArtist, isLocalTrack, isDeezerTrack } from '../../types/track';
import type { AlbumColour } from '../../hooks/useAlbumColour';

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
      <path d="M5 3L15 9L5 15V3Z" fill="currentColor" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="5" y="3" width="3" height="12" rx="1" fill="currentColor" />
      <rect x="10" y="3" width="3" height="12" rx="1" fill="currentColor" />
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
  accentColor?: string;
  title?: string;
}

function ControlBtn({
  onClick,
  children,
  label,
  large = false,
  accentColor = '#1db954',
  title,
}: ControlBtnProps) {
  const isPlaying = usePlayerStore(state => state.isPlaying)
  const beat = useVisualiserStore(state => state.beat)

  return (
    <motion.button
      initial={false}
      onClick={onClick}
      aria-label={label}
      title={title}
      whileHover={{ scale: 1.1, backgroundColor: large ? accentColor : 'rgba(255,255,255,0.1)' }}
      whileTap={{ scale: 0.9 }}
      animate={large && isPlaying ? {
        boxShadow: beat
          ? [`0 0 10px ${accentColor}44`, `0 0 25px ${accentColor}aa`, `0 0 10px ${accentColor}44`]
          : `0 0 10px ${accentColor}44`,
        scale: beat ? [1, 1.1, 1] : 1
      } : {}}
      transition={{ duration: 0.2 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: large ? 42 : 32,
        height: large ? 42 : 32,
        borderRadius: '50%',
        border: 'none',
        background: large ? accentColor : 'transparent',
        color: large ? 'var(--bg-color, #000)' : 'var(--text-dim, rgba(255,255,255,0.7))',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background 0.3s cubic-bezier(0.4, 0, 0.2, 1), color 0.3s ease',
        boxShadow: large ? `0 4px 12px ${accentColor}33` : 'none',
      }}
    >
      {children}
    </motion.button>
  );
}

// ─── Progress sub-component ───────────────────────────────────────────────────

/**
 * PlaybackProgress — isolated component for the high-frequency time display.
 * Subscribes specifically to currentTime and duration to prevent the entire
 * PlayerBar from re-rendering on every progress update.
 */
function PlaybackProgress() {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.currentTrack?.duration ?? 0);
  const beat = useVisualiserStore((s) => s.beat);

  return (
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
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--text-dim, rgba(232, 245, 232, 0.4))',
          flexShrink: 0,
          width: 32,
          textAlign: 'right',
        }}
      >
        {formatTime(currentTime)}
      </span>

      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <WaveformLine height={36} />
        <motion.div
          animate={{
            opacity: beat ? 0.3 : 0.05,
            scale: beat ? 1.02 : 1,
          }}
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(180deg, transparent, var(--accent-color, #1db954), transparent)`,
            pointerEvents: 'none',
            zIndex: -1,
          }}
        />
      </div>

      <span
        style={{
          fontSize: 11,
          fontFamily: 'monospace',
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--text-dim, rgba(232, 245, 232, 0.4))',
          flexShrink: 0,
          width: 32,
        }}
      >
        {duration > 0 ? formatTime(duration) : '--:--'}
      </span>
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
        background: 'var(--bg-color, rgba(5, 10, 5, 0.92))',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--border-color)',
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
        <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
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

          {currentTrack && isDeezerTrack(currentTrack) && currentTrack.explicit_lyrics && (
            <div
              style={{
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
                color: accent.hex,
                borderColor: `${accent.hex}66`,
                zIndex: 1,
              }}
              aria-label="Explicit content"
              title="Explicit content"
            >
              E
            </div>
          )}
        </div>

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
                    color: 'var(--text-color, #e8f5e8)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    margin: 0,
                    lineHeight: 1.3,
                    fontFamily: 'inherit',
                  }}
                  title={currentTrack.title}
                >
                  {currentTrack.title}
                </p>
                <button
                  onClick={() => {
                    if (isDeezerTrack(currentTrack)) {
                      useUIStore.getState().setSelectedArtistId(currentTrack.artist.id);
                    }
                  }}
                  style={{
                    fontSize: 11,
                    color: 'var(--text-dim, rgba(232, 245, 232, 0.5))',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    margin: 0,
                    lineHeight: 1.3,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontFamily: 'inherit',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: isDeezerTrack(currentTrack) ? 'pointer' : 'default',
                    textAlign: 'left',
                    width: '100%',
                  }}
                  title={trackArtist}
                  aria-label={
                    isDeezerTrack(currentTrack) ? `View artist: ${trackArtist}` : trackArtist
                  }
                >
                  {isLocal && (
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontFamily: 'monospace',
                        background: `${accent.hex}26`,
                        color: accent.hex,
                        padding: '1px 4px',
                        borderRadius: 3,
                        letterSpacing: '0.05em',
                        flexShrink: 0,
                      }}
                    >
                      LOCAL
                    </span>
                  )}
                  <span
                    style={{
                      transition: 'color 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (isDeezerTrack(currentTrack)) {
                        e.currentTarget.style.color = accent.hex;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (isDeezerTrack(currentTrack)) {
                        e.currentTarget.style.color = 'var(--text-dim, rgba(232, 245, 232, 0.5))';
                      }
                    }}
                  >
                    {trackArtist}
                  </span>
                </button>
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
        <ControlBtn
          onClick={prevTrack}
          label="Previous track"
          title="Previous track (←)"
          accentColor={accent.hex}
        >
          <IconPrev />
        </ControlBtn>
        <ControlBtn
          onClick={togglePlay}
          label={isPlaying ? 'Pause' : 'Play'}
          title="Play/Pause (Space)"
          large
          accentColor={accent.hex}
        >
          {isPlaying ? <IconPause /> : <IconPlay />}
        </ControlBtn>
        <ControlBtn
          onClick={nextTrack}
          label="Next track"
          title="Next track (→)"
          accentColor={accent.hex}
        >
          <IconNext />
        </ControlBtn>
      </div>

      {/* ── Waveform + time ── */}
      <PlaybackProgress />

      {/* ── Right controls: upload button ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <LocalFileLoader accent={accent} />
      </div>
    </motion.div>
  );
}