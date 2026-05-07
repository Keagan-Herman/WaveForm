/**
 * FrequencyBars.tsx — v3
 *
 * Now receives full AlbumColour object.
 * Light albums: bars rendered in vivid bright tones against
 * the light background rather than the dark-base gradient.
 * Dark/normal albums: existing gradient behaviour.
 */

import { useRef, useEffect, useCallback } from 'react'
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser'
import type { AlbumColour } from '@/hooks/useAlbumColour'

interface FrequencyBarsProps {
  width?: number
  height?: number
  mirrorMode?: boolean
  accent: AlbumColour
  className?: string
}

export function FrequencyBars({
  width = 800,
  height = 200,
  mirrorMode = true,
  accent,
  className,
}: FrequencyBarsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const accentRef = useRef(accent)

  useEffect(() => {
    accentRef.current = accent
  }, [accent])

  const drawBars = useCallback((data: Uint8Array) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width: w, height: h } = canvas
    const { h: hue, s: sat, l: lit } = accentRef.current
    const isLight = lit > 62

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

      const barHue = (hue + ratio * 50) % 360

      let grad: CanvasGradient

      if (isLight) {
        // Light album: bars go from a mid-tone base up to bright vivid tip
        // This looks great against a light background
        const baseLit = 35 + ratio * 15
        const tipLit = 70 + ratio * 20
        grad = ctx.createLinearGradient(x, h, x, h - barHeight)
        grad.addColorStop(0, `hsla(${barHue}, ${sat}%, ${baseLit}%, 0.7)`)
        grad.addColorStop(0.6, `hsla(${barHue}, ${Math.min(100, sat * 1.2)}%, ${tipLit}%, 1)`)
        grad.addColorStop(1, `hsla(${barHue}, 100%, 90%, 1)`)
      } else {
        // Dark/normal album: dark base to vivid tip
        const baseLit = 28 + ratio * 12
        const tipLit = 48 + ratio * 20
        grad = ctx.createLinearGradient(x, h, x, h - barHeight)
        grad.addColorStop(0, `hsla(${barHue}, ${sat}%, ${baseLit * 0.6}%, 0.8)`)
        grad.addColorStop(0.7, `hsla(${barHue}, ${sat}%, ${tipLit}%, 1)`)
        grad.addColorStop(1, `hsla(${barHue}, 100%, 80%, 1)`)
      }

      ctx.fillStyle = grad
      ctx.fillRect(x, h - barHeight, barWidth, barHeight)

      // Glow cap
      if (barHeight > 6) {
        const capLit = isLight ? 85 : 85
        ctx.fillStyle = `hsla(${barHue}, 100%, ${capLit}%, 0.8)`
        ctx.fillRect(x, h - barHeight, barWidth, 2)

        if (ratio > 0.7) {
          ctx.shadowColor = `hsl(${barHue}, 100%, 70%)`
          ctx.shadowBlur = isLight ? 12 : 8
          ctx.fillStyle = `hsl(${barHue}, 100%, 92%)`
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