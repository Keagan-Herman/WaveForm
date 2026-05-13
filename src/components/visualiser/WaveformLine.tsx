import { useEffect, useRef } from 'react';
import { audioEngine } from '../../audio/AudioEngine';
import { usePlayerStore } from '../../stores/playerStore';
import { isLocalTrack } from '../../types/track';

// ─── Colours ──────────────────────────────────────────────────────────────────

const GREEN = '#1db954';
const GREEN_PLAYED = 'rgba(29, 185, 84, 0.9)';
const GREEN_UNPLAYED = 'rgba(29, 185, 84, 0.28)';
const PLAYHEAD = 'rgba(255, 255, 255, 0.9)';
const PLAYHEAD_GLOW = 'rgba(255, 255, 255, 0.2)';

// ─── Drawing routines ─────────────────────────────────────────────────────────

function drawLiveOscilloscope(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const data = audioEngine.getWaveformData();
  ctx.clearRect(0, 0, width, height);

  ctx.beginPath();
  ctx.strokeStyle = GREEN;
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
  progress: number // 0–1
) {
  ctx.clearRect(0, 0, width, height);

  const centerY = height / 2;
  const barWidth = width / waveform.length;
  const playheadX = progress * width;

  // ── Bars ──
  for (let i = 0; i < waveform.length; i++) {
    const x = i * barWidth;
    const barHeight = Math.max(1, waveform[i] * centerY * 0.92);
    const isPlayed = x <= playheadX;

    ctx.fillStyle = isPlayed ? GREEN_PLAYED : GREEN_UNPLAYED;

    // Mirror above and below centre
    ctx.fillRect(x, centerY - barHeight, Math.max(1, barWidth - 0.8), barHeight);
    ctx.fillRect(x, centerY, Math.max(1, barWidth - 0.8), barHeight);
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

export function WaveformLine({ height = 48 }: WaveformLineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>();
  const sizeRef = useRef({ width: 300, height });

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isLocal = currentTrack !== null && isLocalTrack(currentTrack);

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
      const { currentTrack, currentTime } = usePlayerStore.getState();
      const localTrack =
        currentTrack !== null && isLocalTrack(currentTrack) ? currentTrack : null;
      const wf = localTrack?.waveform;
      const dur = currentTrack?.duration ?? 0;

      ctx.clearRect(0, 0, width, h);

      if (wf && wf.length > 0) {
        const progress = dur > 0 ? Math.min(1, currentTime / dur) : 0;
        drawStaticWaveform(ctx, width, h, wf, progress);
      } else {
        drawLiveOscilloscope(ctx, width, h);
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div ref={wrapperRef} style={{ width: '100%', height }}>
      <canvas
        ref={canvasRef}
        aria-label={
          isLocal ? 'Static waveform — pre-computed from local file' : 'Live audio waveform'
        }
        style={{ display: 'block' }}
      />
    </div>
  );
}