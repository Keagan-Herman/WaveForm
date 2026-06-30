import React, { useEffect, useRef, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { audioEngine } from '../../audio/AudioEngine'
import { usePlayerStore } from '../../stores/playerStore'
import { isLocalTrack } from '../../types/track'
import { useAlbumColour } from '../../hooks/useAlbumColour'
import { formatDuration } from '../../lib/deezerApi'

// ─── Colours ──────────────────────────────────────────────────────────────────

const PLAYHEAD = 'rgba(255, 255, 255, 0.9)'
const PLAYHEAD_GLOW = 'rgba(255, 255, 255, 0.2)'
const HOVER_LINE = 'rgba(255, 255, 255, 0.3)'

// ─── Drawing routines ─────────────────────────────────────────────────────────

function drawLiveOscilloscope(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  colour: string,
  hoverProgress: number | null
) {
  const data = audioEngine.getWaveformData()
  ctx.clearRect(0, 0, width, height)

  ctx.beginPath()
  ctx.strokeStyle = colour
  ctx.lineWidth = 1.5
  ctx.lineJoin = 'round'

  const sliceWidth = width / data.length
  let x = 0

  for (let i = 0; i < data.length; i++) {
    const v = data[i] / 128.0 // 0–2
    const y = (v / 2) * height
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
    x += sliceWidth
  }

  ctx.lineTo(width, height / 2)
  ctx.stroke()

  if (hoverProgress !== null) {
    const hx = hoverProgress * width
    ctx.beginPath()
    ctx.strokeStyle = HOVER_LINE
    ctx.setLineDash([4, 4])
    ctx.moveTo(hx, 0)
    ctx.lineTo(hx, height)
    ctx.stroke()
    ctx.setLineDash([])
  }
}

function drawStaticWaveform(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  waveform: Float32Array,
  progress: number, // 0–1
  colours: { played: string; unplayed: string },
  hoverProgress: number | null
) {
  ctx.clearRect(0, 0, width, height)

  const len = waveform.length
  const centerY = height / 2
  const unitWidth = width / len
  const drawWidth = Math.max(1, unitWidth - 0.8)
  const playheadX = progress * width

  // Split point for played/unplayed colours
  const playedCount = Math.floor(progress * len)

  // ── Played Bars ──
  ctx.fillStyle = colours.played
  for (let i = 0; i < playedCount; i++) {
    const barHeight = Math.max(1, waveform[i] * centerY * 0.92)
    ctx.fillRect(i * unitWidth, centerY - barHeight, drawWidth, barHeight * 2)
  }

  // ── Unplayed Bars ──
  ctx.fillStyle = colours.unplayed
  for (let i = playedCount; i < len; i++) {
    const barHeight = Math.max(1, waveform[i] * centerY * 0.92)
    ctx.fillRect(i * unitWidth, centerY - barHeight, drawWidth, barHeight * 2)
  }

  // ── Hover State ──
  if (hoverProgress !== null) {
    const hx = hoverProgress * width
    ctx.beginPath()
    ctx.strokeStyle = HOVER_LINE
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.moveTo(hx, 0)
    ctx.lineTo(hx, height)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // ── Playhead ──
  if (progress > 0) {
    // Glow
    ctx.beginPath()
    ctx.strokeStyle = PLAYHEAD_GLOW
    ctx.lineWidth = 5
    ctx.moveTo(playheadX, 0)
    ctx.lineTo(playheadX, height)
    ctx.stroke()

    // Line
    ctx.beginPath()
    ctx.strokeStyle = PLAYHEAD
    ctx.lineWidth = 1.5
    ctx.moveTo(playheadX, 0)
    ctx.lineTo(playheadX, height)
    ctx.stroke()

    // Pip at top and bottom
    ctx.fillStyle = PLAYHEAD
    ctx.beginPath()
    ctx.arc(playheadX, 0, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(playheadX, height, 3, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface WaveformLineProps {
  height?: number
}

export const WaveformLine = React.memo(({ height = 48 }: WaveformLineProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>()
  const sizeRef = useRef({ width: 300, height })
  const hoverRef = useRef<number | null>(null)
  const [hoverInfo, setHoverInfo] = useState<{ x: number; time: string } | null>(null)

  const lastRenderRef = useRef({
    progress: -1,
    width: -1,
    height: -1,
    trackId: '',
    isPlaying: false,
    accent: '',
    hover: null as number | null,
  })

  const currentTrack = usePlayerStore(s => s.currentTrack)
  const isLocal = currentTrack !== null && isLocalTrack(currentTrack)
  const trackCover = currentTrack
    ? isLocalTrack(currentTrack)
      ? currentTrack.album.cover
      : currentTrack.album.cover_medium
    : null
  const { palette } = useAlbumColour(trackCover)

  const themeColours = useMemo(
    () => ({
      played: palette.accent,
      unplayed: `${palette.accent}40`, // 25% opacity
      live: palette.accent,
    }),
    [palette.accent]
  )

  // ── Interaction: Seek on click ──

  const handleSeek = (e: React.MouseEvent) => {
    const wrapper = wrapperRef.current
    if (!wrapper || !currentTrack?.duration) return

    const rect = wrapper.getBoundingClientRect()
    const x = e.clientX - rect.left
    const fraction = Math.max(0, Math.min(1, x / rect.width))
    seekToFraction(fraction)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    const wrapper = wrapperRef.current
    if (!wrapper || !currentTrack?.duration) return

    const rect = wrapper.getBoundingClientRect()
    const x = e.clientX - rect.left
    const fraction = Math.max(0, Math.min(1, x / rect.width))
    hoverRef.current = fraction
    setHoverInfo({
      x,
      time: formatDuration(fraction * currentTrack.duration),
    })
  }

  const handleMouseLeave = () => {
    hoverRef.current = null
    setHoverInfo(null)
  }

  const seekToFraction = (fraction: number) => {
    if (!currentTrack?.duration) return
    const audio = document.getElementById('preview-audio') as HTMLAudioElement
    if (audio) {
      audio.currentTime = Math.max(0, Math.min(1, fraction)) * currentTrack.duration
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!currentTrack?.duration) return
    const step = 5 // 5 seconds step
    const { currentTime } = usePlayerStore.getState()
    if (e.key === 'ArrowRight') {
      seekToFraction((currentTime + step) / currentTrack.duration)
    } else if (e.key === 'ArrowLeft') {
      seekToFraction((currentTime - step) / currentTrack.duration)
    }
  }

  // ── Resize observer — keeps canvas in sync with flex container width ──

  useEffect(() => {
    const wrapper = wrapperRef.current
    const canvas = canvasRef.current
    if (!wrapper || !canvas) return

    const dpr = window.devicePixelRatio ?? 1
    const ctx = canvas.getContext('2d')!

    const applySize = (w: number) => {
      sizeRef.current = { width: w, height }
      canvas.width = w * dpr
      canvas.height = height * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? 300
      if (Math.abs(w - sizeRef.current.width) > 1) applySize(w)
    })

    ro.observe(wrapper)
    applySize(wrapper.getBoundingClientRect().width || 300)

    return () => ro.disconnect()
  }, [height])

  // ── rAF draw loop ──

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    function draw() {
      const { width, height: h } = sizeRef.current
      const { currentTrack, currentTime, isPlaying } = usePlayerStore.getState()
      const localTrack = currentTrack !== null && isLocalTrack(currentTrack) ? currentTrack : null
      const wf = localTrack?.waveform
      const dur = currentTrack?.duration ?? 0
      const progress = dur > 0 ? Math.min(1, currentTime / dur) : 0
      const hoverProgress = hoverRef.current

      const trackId = currentTrack?.id ? String(currentTrack.id) : ''
      const last = lastRenderRef.current

      // Skip draw if nothing has changed
      if (
        last.progress === progress &&
        last.width === width &&
        last.height === h &&
        last.trackId === trackId &&
        last.isPlaying === isPlaying &&
        last.accent === themeColours.played &&
        last.hover === hoverProgress &&
        wf // Only skip for static waveforms; live oscilloscope always needs update
      ) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }

      ctx.clearRect(0, 0, width, h)

      if (wf && wf.length > 0) {
        drawStaticWaveform(ctx, width, h, wf, progress, themeColours, hoverProgress)
      } else {
        drawLiveOscilloscope(ctx, width, h, themeColours.live, hoverProgress)
      }

      last.progress = progress
      last.width = width
      last.height = h
      last.trackId = trackId
      last.isPlaying = isPlaying
      last.accent = themeColours.played
      last.hover = hoverProgress

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current)
    }
  }, [themeColours])

  return (
    <div
      ref={wrapperRef}
      onClick={handleSeek}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      style={{ width: '100%', height, cursor: 'pointer', position: 'relative' }}
      title="Click to seek or use arrow keys"
    >
      <canvas
        ref={canvasRef}
        aria-label={
          isLocal
            ? 'Static waveform — pre-computed from local file — click to seek'
            : 'Live audio waveform'
        }
        style={{ display: 'block' }}
      />

      <AnimatePresence>
        {hoverInfo && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            style={{
              position: 'absolute',
              top: -32,
              left: hoverInfo.x,
              transform: 'translateX(-50%)',
              background: 'rgba(5, 5, 5, 0.8)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '0.25rem 0.5rem',
              borderRadius: '2px',
              fontSize: '0.65rem',
              fontFamily: 'var(--font-mono)',
              color: '#fff',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              zIndex: 10,
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            }}
          >
            <span style={{ opacity: 0.5, marginRight: '0.25rem' }}>SEEK:</span>
            {hoverInfo.time}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})
