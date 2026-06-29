/**
 * LissajousVisualiser.tsx
 *
 * X/Y oscilloscope — plots left channel vs right channel (or
 * two offset waveform slices) to produce Lissajous figures.
 *
 * WHY THIS IS UNIQUE PER TRACK:
 * Unlike frequency bars which look similar across songs, Lissajous
 * figures are shaped by the actual phase relationship between signals.
 * A pure sine wave produces a perfect circle. Harmonics produce
 * complex knot-like patterns. Noise produces a dense cloud.
 * Each track produces genuinely different shapes.
 *
 * We simulate stereo from the mono preview by using two offset
 * slices of the waveform data with a phase delay — produces
 * visually interesting figures that vary meaningfully per track.
 *
 * OPTIMIZATIONS:
 * 1. Pre-calculated HSL lookup tables for all 256 magnitude/progress steps.
 * 2. Use squared distance for glow calculation to avoid Math.sqrt in the hot path.
 * 3. Zero-allocation hot path for drawing current points.
 */

import { useRef, useEffect, useCallback, useState } from 'react'
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser'
import { useVisualiserStore } from '@/stores/visualiserStore'

// Circular buffer for trail points — avoids per-frame array allocation
interface TrailBuffer {
  data: Float32Array // interleaved [x0, y0, x1, y1, ...]
  head: number // index of the next write slot (in point units)
  count: number // number of valid points currently stored
  capacity: number // max points the buffer can hold
}

function createTrailBuffer(capacity: number): TrailBuffer {
  return { data: new Float32Array(capacity * 2), head: 0, count: 0, capacity }
}

function writePointDirect(buf: TrailBuffer, x: number, y: number): void {
  buf.data[buf.head * 2] = x
  buf.data[buf.head * 2 + 1] = y
  buf.head = (buf.head + 1) % buf.capacity
  if (buf.count < buf.capacity) buf.count++
}

function iteratePoints(
  buf: TrailBuffer,
  cb: (x: number, y: number, i: number, total: number) => void
): void {
  const start = buf.count < buf.capacity ? 0 : buf.head
  for (let i = 0; i < buf.count; i++) {
    const idx = (start + i) % buf.capacity
    cb(buf.data[idx * 2], buf.data[idx * 2 + 1], i, buf.count)
  }
}

interface LissajousVisualiserProps {
  size?: number
  accentHue?: number
  accentColour?: string
}

export function LissajousVisualiser({
  size = 280,
  accentHue = 120,
  accentColour = '#1db954',
}: LissajousVisualiserProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frozenRef = useRef(false)
  const [frozen, setFrozen] = useState(false)
  const accentRef = useRef({ hue: accentHue, colour: accentColour })
  const TRAIL_CAPACITY = 180 * 512 // maxTrail * max newPoints per frame
  const trailBufRef = useRef<TrailBuffer>(createTrailBuffer(TRAIL_CAPACITY))

  // Pre-calculated lookups to eliminate hot-path allocations
  const hueMapRef = useRef<string[]>([])
  const glowMapRef = useRef<string[]>([])
  const gridStrokeRef = useRef('')
  const ringStrokeRef = useRef('')

  useEffect(() => {
    accentRef.current = { hue: accentHue, colour: accentColour }

    // Pre-calculate HSL strings
    const hueMap = new Array(256)
    const glowMap = new Array(256)

    for (let i = 0; i < 256; i++) {
      const progress = i / 255
      const alpha = 0.6 + progress * 0.4
      const freqHue = (accentHue + progress * 40) % 360
      const lightness = 45 + progress * 25

      hueMap[i] = `hsla(${freqHue}, 85%, ${lightness}%, ${alpha.toFixed(2)})`
      glowMap[i] = `hsla(${accentHue}, 100%, 80%, ${(progress * 0.6).toFixed(2)})`
    }

    hueMapRef.current = hueMap
    glowMapRef.current = glowMap
    gridStrokeRef.current = `hsla(${accentHue}, 40%, 40%, 0.08)`
    ringStrokeRef.current = `hsla(${accentHue}, 40%, 40%, 0.06)`
  }, [accentHue, accentColour])

  const draw = useCallback((data: Uint8Array) => {
    if (frozenRef.current) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width: w, height: h } = canvas
    const cx = w / 2
    const cy = h / 2

    // Get bass power from store imperatively
    const { bassPower } = useVisualiserStore.getState()

    // Use two slices of waveform with phase offset to simulate X/Y
    const len = data.length
    const phaseOffset = Math.floor(len * 0.25) // 90 degree offset

    // Write points directly — zero allocation
    const step = 2
    const rotation = bassPower * 0.3
    const cosR = Math.cos(rotation)
    const sinR = Math.sin(rotation)
    const scale = w * 0.42

    for (let i = 0; i < len - phaseOffset; i += step) {
      const xVal = data[i] / 128 - 1
      const yVal = data[i + phaseOffset] / 128 - 1
      const rx = xVal * cosR - yVal * sinR
      const ry = xVal * sinR + yVal * cosR
      writePointDirect(trailBufRef.current, cx + rx * scale, cy + ry * scale)
    }

    ctx.clearRect(0, 0, w, h)

    // Draw subtle grid
    ctx.strokeStyle = gridStrokeRef.current
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cx, 0)
    ctx.lineTo(cx, h)
    ctx.moveTo(0, cy)
    ctx.lineTo(w, cy)
    ctx.stroke()

    // Draw outer ring
    ctx.beginPath()
    ctx.arc(cx, cy, w * 0.44, 0, Math.PI * 2)
    ctx.strokeStyle = ringStrokeRef.current
    ctx.lineWidth = 1
    ctx.stroke()

    // Draw via callback — zero allocation
    const hueMap = hueMapRef.current
    const glowMap = glowMapRef.current
    const glowThresholdSq = (w * 0.42 * 0.7) ** 2

    if (trailBufRef.current.count < 2) return

    let prevX = 0
    let prevY = 0
    iteratePoints(trailBufRef.current, (x, y, i, total) => {
      if (i === 0) {
        prevX = x
        prevY = y
        return
      }

      const progressIdx = Math.floor((i / total) * 255)

      ctx.beginPath()
      ctx.moveTo(prevX, prevY)
      ctx.lineTo(x, y)
      ctx.strokeStyle = hueMap[progressIdx]
      ctx.lineWidth = 1 + bassPower * 1.5
      ctx.lineCap = 'round'
      ctx.stroke()

      const dx = x - cx
      const dy = y - cy
      const distSq = dx * dx + dy * dy

      if (distSq > glowThresholdSq) {
        const energy = Math.min(1, Math.sqrt(distSq) / scale)
        const energyIdx = Math.floor(energy * 255)
        ctx.beginPath()
        ctx.arc(x, y, 1.5 + energy * 2, 0, Math.PI * 2)
        ctx.fillStyle = glowMap[energyIdx]
        ctx.fill()
      }

      prevX = x
      prevY = y
    })

    // Frozen indicator
    if (frozenRef.current) {
      ctx.fillStyle = `hsla(${accentRef.current.hue}, 60%, 60%, 0.4)`
      ctx.font = '10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('FROZEN', cx, 14)
    }
  }, [])

  const { start, stop } = useAudioAnalyser({ onWaveformData: draw })

  useEffect(() => {
    start()
    return () => stop()
  }, [start, stop])

  const handleClick = useCallback(() => {
    frozenRef.current = !frozenRef.current
    setFrozen(f => !f)
  }, [])

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        onClick={handleClick}
        style={{
          display: 'block',
          cursor: 'pointer',
          borderRadius: '50%',
          border: `1px solid ${accentColour}22`,
          transition: 'border-color 1s ease',
        }}
        title="Click to freeze"
      />
      {frozen && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            fontSize: '0.65rem',
            letterSpacing: '0.12em',
            color: accentColour,
            opacity: 0.7,
            fontFamily: 'monospace',
            textTransform: 'uppercase',
            pointerEvents: 'none',
          }}
        >
          frozen
        </div>
      )}
    </div>
  )
}
