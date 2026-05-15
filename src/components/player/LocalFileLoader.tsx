import React, { useRef, useState, useCallback, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '../../stores/playerStore';
import { computeWaveform } from '../../hooks/useWaveformPrecompute';
import { LocalTrack } from '../../types/track';
import { buildLocalTrack, isAudioFile } from '../../hooks/useLocalFileMetadata';
import type { AlbumColour } from '../../hooks/useAlbumColour';

// ─── Types ────────────────────────────────────────────────────────────────────

type LoadState = 'idle' | 'loading' | 'success' | 'error';

// ─── File processing pipeline ─────────────────────────────────────────────────

async function processFile(file: File): Promise<LocalTrack> {
  // Build metadata first — creates the objectUrl we'll reuse for everything
  const partialTrack = await buildLocalTrack(file);

  try {
    const { waveform, duration } = await computeWaveform(file);
    return { ...partialTrack, duration, waveform };
  } catch (err) {
    console.error('Failed to compute waveform/duration:', err);
    // Return partial track with default duration if decoding fails
    return { ...partialTrack, duration: 0 };
  }
}

async function processFiles(files: File[]): Promise<LocalTrack[]> {
  const audioFiles = files.filter(isAudioFile);
  if (!audioFiles.length) throw new Error('No supported audio files found.');

  // Process with limited concurrency to avoid memory spikes with many large files
  const concurrencyLimit = 2;
  const results: LocalTrack[] = [];
  const remaining = [...audioFiles];

  async function worker() {
    while (remaining.length > 0) {
      const file = remaining.shift();
      if (file) {
        results.push(await processFile(file));
      }
    }
  }

  await Promise.all(Array.from({ length: concurrencyLimit }, worker));
  return results;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LocalFileLoader({ accent }: { accent: AlbumColour }) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [isDragOver, setIsDragOver] = useState(false);
  const registerLocalTrack = usePlayerStore((s) => s.registerLocalTrack);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const setTrack = usePlayerStore((s) => s.setTrack);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const queue = usePlayerStore((s) => s.queue);

  const dispatchTracks = useCallback(
    (tracks: LocalTrack[]) => {
      tracks.forEach((track) => {
        registerLocalTrack(track);
        addToQueue(track);
      });

      // Auto-play the first loaded track if nothing is currently playing
      if (!currentTrack && tracks.length > 0) {
        setTrack(tracks[0]);
      }
    },
    [registerLocalTrack, addToQueue, setTrack, currentTrack]
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      if (!arr.length) return;

      setLoadState('loading');
      try {
        const tracks = await processFiles(arr);
        dispatchTracks(tracks);
        setLoadState('success');
        setTimeout(() => setLoadState('idle'), 1500);
      } catch {
        setLoadState('error');
        setTimeout(() => setLoadState('idle'), 2000);
      }
    },
    [dispatchTracks]
  );

  // ── File input ──

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
      // Reset input so the same file can be re-selected
      e.target.value = '';
    }
  };

  // ── Drag/drop ──

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };

  // ── Render ──

  const localTrackCount = queue.filter((t) => t.source === 'local').length;

  return (
    <>
      {/* Hidden file input */}
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="audio/*"
        multiple
        onChange={handleInputChange}
        style={{ display: 'none' }}
        aria-label="Upload local audio files"
      />

      {/* Upload button */}
      <motion.button
        onClick={() => inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        aria-label="Upload local audio files"
        title="Upload local audio (drag & drop or click)"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        animate={{
          borderColor: isDragOver ? `${accent.hex}cc` : 'rgba(255,255,255,0.0)',
        }}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          borderRadius: 8,
          border: '1px solid transparent',
          background: isDragOver ? `${accent.hex}1f` : 'rgba(255,255,255,0.06)',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'background 0.2s',
        }}
      >
        {/* Icon */}
        <AnimatePresence mode="wait">
          {loadState === 'loading' ? (
            <motion.div
              key="spinner"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              style={{
                width: 16,
                height: 16,
                border: `2px solid ${accent.hex}4d`,
                borderTopColor: accent.hex,
                borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
              }}
            />
          ) : loadState === 'success' ? (
            <motion.svg
              key="check"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <polyline
                points="3,8 6.5,11.5 13,4.5"
                fill="none"
                stroke={accent.hex}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </motion.svg>
          ) : loadState === 'error' ? (
            <motion.svg
              key="error"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <line
                x1="4" y1="4" x2="12" y2="12"
                stroke="#ff4444"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1="12" y1="4" x2="4" y2="12"
                stroke="#ff4444"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </motion.svg>
          ) : (
            <motion.svg
              key="upload"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <path
                d="M8 2L8 10M8 2L5 5M8 2L11 5"
                fill="none"
                stroke="rgba(255,255,255,0.65)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M3 12 L3 13.5 Q3 14 3.5 14 L12.5 14 Q13 14 13 13.5 L13 12"
                fill="none"
                stroke="rgba(255,255,255,0.65)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </motion.svg>
          )}
        </AnimatePresence>

        {/* Badge: number of local tracks loaded */}
        <AnimatePresence>
          {localTrackCount > 0 && loadState === 'idle' && (
            <motion.span
              key="badge"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                minWidth: 16,
                height: 16,
                borderRadius: 8,
                background: accent.hex,
                color: 'var(--bg-color, #050e05)',
                fontSize: 9,
                fontWeight: 700,
                fontFamily: 'monospace',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 3px',
                lineHeight: 1,
              }}
            >
              {localTrackCount}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Spinner keyframe — injected once */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}