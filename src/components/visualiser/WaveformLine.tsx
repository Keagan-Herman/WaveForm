import React, { useEffect, useRef, useMemo } from 'react';
import { audioEngine } from '../../audio/AudioEngine';
import { usePlayerStore } from '../../stores/playerStore';
import { isLocalTrack } from '../../types/track';
import { useAlbumColour } from '../../hooks/useAlbumColour';

// ─── Colours ──────────────────────────────────────────────────────────────────

const PLAYHEAD = 'rgba(255, 255, 255, 0.9)';
const PLAYHEAD_GLOW = 'rgba(255, 255, 255, 0.2)';

// ─── Drawing routines ─────────────────────────────────────────────────────────

function drawLiveOscilloscope(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  colour: string
) {
  const data = audioEngine.getWaveformData();
  ctx.clearRect(0, 0, width, height);

  ctx.beginPath();
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';

  const sliceWidth = width / data.length;
  let x = 0;

  for (let i = 0; i < data.length; i++) {
    const v = data[i] / 128.0; // 0–2
    const y = (v / 2) * height;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    x += sliceWidth;
  }

  ctx.lineTo(width, height / 2);
  ctx.stroke();
}

function drawStaticWaveform(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  waveform: Float32Array,
  progress: number, // 0–1
  colours: { played: string; unplayed: string }
) {
  ctx.clearRect(0, 0, width, height);

  const len = waveform.length;
  const centerY = height / 2;
  const unitWidth = width / len;
  const drawWidth = Math.max(1, unitWidth - 0.8);
  const playheadX = progress * width;

  // Split point for played/unplayed colours
  const playedCount = Math.floor(progress * len);

  // ── Played Bars ──
  ctx.fillStyle = colours.played;
  for (let i = 0; i < playedCount; i++) {
    const barHeight = Math.max(1, waveform[i] * centerY * 0.92);
    // Single fillRect covers both top and bottom (mirrored)
    ctx.fillRect(i * unitWidth, centerY - barHeight, drawWidth, barHeight * 2);
  }

  // ── Unplayed Bars ──
  ctx.fillStyle = colours.unplayed;
  for (let i = playedCount; i < len; i++) {
    const barHeight = Math.max(1, waveform[i] * centerY * 0.92);
    ctx.fillRect(i * unitWidth, centerY - barHeight, drawWidth, barHeight * 2);
  }

  // ── Playhead ──
  if (progress > 0) {
    // Glow
    ctx.beginPath();
    ctx.strokeStyle = PLAYHEAD_GLOW;
    ctx.lineWidth = 5;
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = PLAYHEAD;
    ctx.lineWidth = 1.5;
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();

    // Pip at top and bottom
    ctx.fillStyle = PLAYHEAD;
    ctx.beginPath();
    ctx.arc(playheadX, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(playheadX, height, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface WaveformLineProps {
  height?: number;
}

export const WaveformLine = React.memo(({ height = 48 }: WaveformLineProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>();
  const sizeRef = useRef({ width: 300, height });
  const lastRenderRef = useRef({
    progress: -1,
    width: -1,
    height: -1,
    trackId: '',
    isPlaying: false,
    accent: ''
  });

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isLocal = currentTrack !== null && isLocalTrack(currentTrack);
  const trackCover = currentTrack ? (isLocalTrack(currentTrack) ? currentTrack.album.cover : currentTrack.album.cover_medium) : null;
  const { palette } = useAlbumColour(trackCover);

  const themeColours = useMemo(() => ({
    played: palette.accent,
    unplayed: `${palette.accent}40`, // 25% opacity
    live: palette.accent
  }), [palette.accent]);

  // ── Interaction: Seek on click ──

  const handleSeek = (e: React.MouseEvent) => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !currentTrack?.duration) return;

    const rect = wrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, x / rect.width));

    const audio = document.getElementById('preview-audio') as HTMLAudioElement;
    if (audio) {
      audio.currentTime = fraction * currentTrack.duration;
    }
  };

  // ── Resize observer — keeps canvas in sync with flex container width ──

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;

    const dpr = window.devicePixelRatio ?? 1;
    const ctx = canvas.getContext('2d')!;

    const applySize = (w: number) => {
      sizeRef.current = { width: w, height };
      canvas.width = w * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 300;
      if (Math.abs(w - sizeRef.current.width) > 1) applySize(w);
    });

    ro.observe(wrapper);
    applySize(wrapper.getBoundingClientRect().width || 300);

    return () => ro.disconnect();
  }, [height]);

  // ── rAF draw loop ──

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    function draw() {
      const { width, height: h } = sizeRef.current;
      const { currentTrack, currentTime, isPlaying } = usePlayerStore.getState();
      const localTrack =
        currentTrack !== null && isLocalTrack(currentTrack) ? currentTrack : null;
      const wf = localTrack?.waveform;
      const dur = currentTrack?.duration ?? 0;
      const progress = dur > 0 ? Math.min(1, currentTime / dur) : 0;

      const trackId = currentTrack?.id ? String(currentTrack.id) : '';
      const last = lastRenderRef.current;

      // Skip draw if nothing has changed
      if (
        last.progress === progress &&
        last.width === width &&
        last.height === h &&
        last.trackId === trackId &&
        last.isPlaying === isPlaying &&
        last.accent === themeColours.played &&
        wf // Only skip for static waveforms; live oscilloscope always needs update
      ) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      ctx.clearRect(0, 0, width, h);

      if (wf && wf.length > 0) {
        drawStaticWaveform(ctx, width, h, wf, progress, themeColours);
      } else {
        drawLiveOscilloscope(ctx, width, h, themeColours.live);
      }

      last.progress = progress;
      last.width = width;
      last.height = h;
      last.trackId = trackId;
      last.isPlaying = isPlaying;
      last.accent = themeColours.played;

      rafRef.current = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
  }, [themeColours]);

  return (
    <div
      ref={wrapperRef}
      onClick={handleSeek}
      style={{ width: '100%', height, cursor: 'pointer' }}
      title="Click to seek"
    >
      <canvas
        ref={canvasRef}
        aria-label={
          isLocal ? 'Static waveform — pre-computed from local file' : 'Live audio waveform'
        }
        style={{ display: 'block' }}
      />
    </div>
  );
});