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
import { useResize } from '@/hooks/useResize'
import type { AlbumColour } from '@/hooks/useAlbumColour'

interface FrequencyBarsProps {
  width?: number
  height?: number
  mirrorMode?: boolean
  accent: AlbumColour
  className?: string
}

export function FrequencyBars({
  width: initialWidth = 800,
  height: initialHeight = 200,
  mirrorMode = true,
  accent,
  className,
}: FrequencyBarsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { width, height } = useResize(containerRef)

  const effectiveWidth = width || initialWidth
  const effectiveHeight = height || initialHeight

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
    const barWidth = Math.max(1, w / (mirrorMode ? data.length : bins) - 1.5)

    const processedData = mirrorMode
      ? [...[...data.slice(0, bins)].reverse(), ...data.slice(0, bins)]
      : data.slice(0, bins)

    const drawCount = processedData.length

    for (let i = 0; i < drawCount; i++) {
      const value = processedData[i]
      const barHeight = (value / 255) * (h * 0.7)
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
      ctx.fillRect(x, h * 0.7 - barHeight, barWidth, barHeight)

      // Glow cap
      if (barHeight > 6) {
        const capLit = isLight ? 85 : 85
        ctx.fillStyle = `hsla(${barHue}, 100%, ${capLit}%, 0.8)`
        ctx.fillRect(x, h * 0.7 - barHeight, barWidth, 2)

        if (ratio > 0.7) {
          ctx.shadowColor = `hsl(${barHue}, 100%, 70%)`
          ctx.shadowBlur = isLight ? 12 : 8
          ctx.fillStyle = `hsl(${barHue}, 100%, 92%)`
          ctx.fillRect(x, h * 0.7 - barHeight - 1, barWidth, 2)
          ctx.shadowBlur = 0
        }
      }

      // Reflection
      ctx.save()
      ctx.globalAlpha = 0.2
      ctx.translate(0, h * 0.7)
      ctx.scale(1, -1)
      ctx.fillStyle = grad
      ctx.fillRect(x, -barHeight * 0.4, barWidth, barHeight * 0.4)
      ctx.restore()
    }
  }, [])

  const { start, stop } = useAudioAnalyser({ onFrequencyData: drawBars })

  useEffect(() => {
    start()
    return () => stop()
  }, [start, stop])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        width={effectiveWidth}
        height={effectiveHeight}
        className={className}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  )
}
