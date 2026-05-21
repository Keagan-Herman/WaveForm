import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '../../stores/playerStore';
import { useUIStore } from '../../stores/uiStore';
import { WaveformLine } from '../visualiser/WaveformLine';
import { LocalFileLoader } from './LocalFileLoader';
import { getTrackCover, getTrackArtist, isLocalTrack, isDeezerTrack } from '../../types/track';
import { useResize } from '../../hooks/useResize';
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
  return (
    <motion.button
      onClick={onClick}
      aria-label={label}
      title={title}
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
        background: large ? accentColor : 'transparent',
        color: large ? 'var(--bg-color, #050e05)' : 'rgba(255,255,255,0.75)',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background 0.15s, color 0.15s',
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
          fontVariantNumeric: 'tabular-nums',
          color: 'rgba(232, 245, 232, 0.4)',
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
  const containerRef = React.useRef<HTMLDivElement>(null);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const nextTrack = usePlayerStore((s) => s.nextTrack);
  const prevTrack = usePlayerStore((s) => s.prevTrack);

  const trackCover = currentTrack ? getTrackCover(currentTrack) : '';
  const trackArtist = currentTrack ? getTrackArtist(currentTrack) : '';
  const isLocal = currentTrack !== null && isLocalTrack(currentTrack);

  const { width } = useResize(containerRef);
  const isMobile = (width || window.innerWidth) < 700;

  return (
    <motion.div
      ref={containerRef}
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
        borderTop: `1px solid ${accent.hex}1f`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: isMobile ? 8 : 16,
        padding: isMobile ? '0 12px' : '0 20px',
        zIndex: 200,
      }}
    >
      {/* ── Track info ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: isMobile ? 'auto' : 220,
          flexShrink: isMobile ? 1 : 0,
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        {/* Album art */}
        {!isMobile && (
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
        )}

        {/* Title + artist */}
        <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
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
                    fontSize: isMobile ? 12 : 13,
                    fontWeight: 600,
                    color: '#e8f5e8',
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
                    fontSize: isMobile ? 10 : 11,
                    color: 'rgba(232, 245, 232, 0.5)',
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
                        fontSize: '0.6rem',
                        fontFamily: 'monospace',
                        background: `${accent.hex}26`,
                        color: accent.hex,
                        padding: '1px 3px',
                        borderRadius: 2,
                        letterSpacing: '0.05em',
                        flexShrink: 0,
                      }}
                    >
                      L
                    </span>
                  )}
                  <span
                    style={{
                      transition: 'color 0.2s ease',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    onMouseEnter={(e) => {
                      if (isDeezerTrack(currentTrack)) {
                        e.currentTarget.style.color = accent.hex;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (isDeezerTrack(currentTrack)) {
                        e.currentTarget.style.color = 'rgba(232, 245, 232, 0.5)';
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
          gap: isMobile ? 2 : 4,
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
      {!isMobile && <PlaybackProgress />}

      {/* ── Right controls: upload button ── */}
      {!isMobile && (
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
      )}
    </motion.div>
  );
}
