/**
 * FrequencyBars.tsx — v5 (Optimized)
 *
 * High-performance optimizations:
 * 1. Pre-renders gradients into an offscreen 'palette' canvas to avoid per-frame allocations.
 * 2. Samples gradients via ctx.drawImage (scaling) instead of createLinearGradient.
 * 3. Caches HSL strings for glow effects in refs to eliminate GC churn.
 * 4. Maintains zero-allocation hot path for 60fps locked performance.
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
  const paletteCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Cache for decorative strings to avoid GC pressure
  const capStringsRef = useRef<string[]>([])
  const glowStringsRef = useRef<string[]>([])
  const tipStringsRef = useRef<string[]>([])

  useEffect(() => {
    accentRef.current = accent

    // Initialize or update the offscreen palette
    if (!paletteCanvasRef.current) {
      paletteCanvasRef.current = document.createElement('canvas')
    }

    const pCanvas = paletteCanvasRef.current
    pCanvas.width = 256
    pCanvas.height = 100
    const pCtx = pCanvas.getContext('2d')
    if (!pCtx) return

    const { h: hue, s: sat, l: lit } = accent
    const isLight = lit > 62

    // Pre-calculate all 256 possible gradient columns and decorative strings
    const capStrings: string[] = []
    const glowStrings: string[] = []
    const tipStrings: string[] = []

    for (let v = 0; v < 256; v++) {
      const ratio = v / 255
      const barHue = (hue + ratio * 50) % 360

      // 1. Draw gradient column to palette
      const grad = pCtx.createLinearGradient(v, 100, v, 0)
      if (isLight) {
        const baseLit = 35 + ratio * 15
        const tipLit = 70 + ratio * 20
        grad.addColorStop(0, `hsla(${barHue}, ${sat}%, ${baseLit}%, 0.7)`)
        grad.addColorStop(0.6, `hsla(${barHue}, ${Math.min(100, sat * 1.2)}%, ${tipLit}%, 1)`)
        grad.addColorStop(1, `hsla(${barHue}, 100%, 90%, 1)`)
      } else {
        const baseLit = 28 + ratio * 12
        const tipLit = 48 + ratio * 20
        grad.addColorStop(0, `hsla(${barHue}, ${sat}%, ${baseLit * 0.6}%, 0.8)`)
        grad.addColorStop(0.7, `hsla(${barHue}, ${sat}%, ${tipLit}%, 1)`)
        grad.addColorStop(1, `hsla(${barHue}, 100%, 80%, 1)`)
      }
      pCtx.fillStyle = grad
      pCtx.fillRect(v, 0, 1, 100)

      // 2. Cache strings
      capStrings[v] = `hsla(${barHue}, 100%, 85%, 0.8)`
      glowStrings[v] = `hsla(${barHue}, 100%, 70%, 0.3)`
      tipStrings[v] = `hsla(${barHue}, 100%, 92%, 0.8)`
    }

    capStringsRef.current = capStrings
    glowStringsRef.current = glowStrings
    tipStringsRef.current = tipStrings
  }, [accent])

  const drawBars = useCallback(
    (data: Uint8Array) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d', { alpha: false })
      if (!ctx) return

      const { width: w, height: h } = canvas
      const bins = mirrorMode ? Math.floor(data.length / 2) : data.length
      const drawCount = mirrorMode ? bins * 2 : bins
      const barSpacing = 1.5
      const barWidth = Math.max(1, w / drawCount - barSpacing)
      const baseline = h * 0.7

      // Fill background manually
      ctx.fillStyle = accentRef.current.palette.background
      ctx.fillRect(0, 0, w, h)

      const palette = paletteCanvasRef.current
      if (!palette) return

      const caps = capStringsRef.current
      const glows = glowStringsRef.current
      const tips = tipStringsRef.current

      for (let i = 0; i < drawCount; i++) {
        const dataIdx = mirrorMode ? (i < bins ? bins - 1 - i : i - bins) : i
        const value = data[dataIdx]
        if (value < 2) continue

        const ratio = value / 255
        const barHeight = ratio * baseline
        const x = i * (barWidth + barSpacing)

        // Draw the pre-rendered gradient by sampling a 1px column from the palette
        // and scaling it to the target bar height.
        ctx.drawImage(
          palette,
          value, 0, 1, 100, // source: x=value, y=0, w=1, h=100
          x, baseline - barHeight, barWidth, barHeight // dest
        )

        // Glow cap (High-performance replacement for shadowBlur)
        if (barHeight > 6) {
          ctx.fillStyle = caps[value]
          ctx.fillRect(x, baseline - barHeight, barWidth, 2)

          if (ratio > 0.7) {
            ctx.fillStyle = glows[value]
            ctx.fillRect(x - 2, baseline - barHeight - 2, barWidth + 4, 4)
            ctx.fillStyle = tips[value]
            ctx.fillRect(x, baseline - barHeight - 1, barWidth, 2)
          }
        }
      }

      // Reflection pass
      ctx.save()
      ctx.globalAlpha = 0.15
      ctx.setTransform(1, 0, 0, -0.4, 0, baseline + baseline * 0.4)
      ctx.drawImage(canvas, 0, 0, w, baseline, 0, 0, w, baseline)
      ctx.restore()
    },
    [mirrorMode]
  )

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
