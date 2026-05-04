/**
 * FrequencyBars.tsx
 *
 * Canvas-based frequency bar visualiser. Updated imperatively via the
 * rAF loop — never via React state. React only manages the canvas element
 * mount/unmount lifecycle.
 *
 * PROPS:
 * - width/height: canvas dimensions (default: full container via CSS)
 * - barColor: base colour for bars (default: Spotify green)
 * - mirrorMode: if true, renders bars mirrored on both halves (looks great)
 */

/**
 * FrequencyBars.tsx — enhanced
 *
 * Now accepts accentHue prop so bars theme with album art.
 * Bars grow from centre (mirror mode) for a more dramatic look.
 * Gradient fill from accent colour to bright white at peaks.
 */

import { useRef, useEffect, useCallback } from 'react'
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser'

interface FrequencyBarsProps {
  width?: number
  height?: number
  mirrorMode?: boolean
  accentHue?: number
  className?: string
}

export function FrequencyBars({
  width = 800,
  height = 200,
  mirrorMode = true,
  accentHue = 120,
  className,
}: FrequencyBarsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const accentHueRef = useRef(accentHue)

  useEffect(() => {
    accentHueRef.current = accentHue
  }, [accentHue])

  const drawBars = useCallback((data: Uint8Array) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width: w, height: h } = canvas
    const hue = accentHueRef.current
    ctx.clearRect(0, 0, w, h)

    const bins = mirrorMode ? Math.floor(data.length / 2) : data.length
    const barWidth = Math.max(1, (w / bins) - 1.5)

    for (let i = 0; i < bins; i++) {
      const value = mirrorMode
        ? (data[i] + data[data.length - 1 - i]) / 2
        : data[i]

      const barHeight = (value / 255) * h
      const ratio = value / 255
      const x = i * (barWidth + 1.5)

      // Dynamic hue shifts slightly with frequency position
      const barHue = (hue + ratio * 50) % 360
      const saturation = 70 + ratio * 30
      const lightness = 38 + ratio * 20

      // Gradient fill — base colour to bright tip
      const grad = ctx.createLinearGradient(x, h, x, h - barHeight)
      grad.addColorStop(0, `hsla(${barHue}, ${saturation}%, ${lightness * 0.6}%, 0.8)`)
      grad.addColorStop(0.7, `hsla(${barHue}, ${saturation}%, ${lightness}%, 1)`)
      grad.addColorStop(1, `hsla(${barHue}, 100%, 80%, 1)`)

      ctx.fillStyle = grad
      ctx.fillRect(x, h - barHeight, barWidth, barHeight)

      // Glow cap
      if (barHeight > 6) {
        ctx.fillStyle = `hsla(${barHue}, 100%, 85%, 0.7)`
        ctx.fillRect(x, h - barHeight, barWidth, 2)

        // Peak dot
        if (ratio > 0.7) {
          ctx.shadowColor = `hsl(${barHue}, 100%, 70%)`
          ctx.shadowBlur = 8
          ctx.fillStyle = `hsl(${barHue}, 100%, 90%)`
          ctx.fillRect(x, h - barHeight - 1, barWidth, 2)
          ctx.shadowBlur = 0
        }
      }
    }
  }, [])

  const { start, stop } = useAudioAnalyser({ onFrequencyData: drawBars })

  useEffect(() => {
    start()
    return () => stop()
  }, [start, stop])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      style={{ display: 'block' }}
    />
  )
}