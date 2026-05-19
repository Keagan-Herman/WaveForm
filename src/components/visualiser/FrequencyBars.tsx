/**
 * FrequencyBars.tsx — v5
 *
 * Optimized version:
 * 1. Pre-renders gradients into an offscreen palette canvas whenever the accent color changes.
 * 2. Caches HSL strings for decorative elements to eliminate 60fps string allocations.
 * 3. Caches the 2D context in a ref to avoid repeated getContext calls.
 * 4. Uses ctx.drawImage from the palette for bars instead of createLinearGradient/fillRect.
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
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const { width, height } = useResize(containerRef)

  const effectiveWidth = width || initialWidth
  const effectiveHeight = height || initialHeight

  const accentRef = useRef(accent)

  // ─── Performance Caches ───────────────────────────────────────────────────
  const paletteRef = useRef<HTMLCanvasElement | null>(null)
  const capColorsRef = useRef<string[]>([])
  const glow1ColorsRef = useRef<string[]>([])
  const glow2ColorsRef = useRef<string[]>([])

  useEffect(() => {
    accentRef.current = accent

    // Pre-render gradient palette (256x256)
    if (!paletteRef.current) {
      paletteRef.current = document.createElement('canvas')
      paletteRef.current.width = 256
      paletteRef.current.height = 256
    }
    const pCanvas = paletteRef.current
    const pCtx = pCanvas.getContext('2d')
    if (!pCtx) return

    const { h: hue, s: sat, l: lit } = accent
    const isLight = lit > 62

    const capColors: string[] = []
    const glow1Colors: string[] = []
    const glow2Colors: string[] = []

    for (let v = 0; v < 256; v++) {
      const ratio = v / 255
      const barHue = (hue + ratio * 50) % 360

      // Draw vertical gradient for this value into the palette
      const grad = pCtx.createLinearGradient(v, 256, v, 0)
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
      pCtx.fillRect(v, 0, 1, 256)

      // Cache strings
      capColors[v] = `hsla(${barHue}, 100%, 85%, 0.8)`
      glow1Colors[v] = `hsla(${barHue}, 100%, 70%, 0.3)`
      glow2Colors[v] = `hsla(${barHue}, 100%, 92%, 0.8)`
    }

    capColorsRef.current = capColors
    glow1ColorsRef.current = glow1Colors
    glow2ColorsRef.current = glow2Colors
  }, [accent])

  const drawBars = useCallback(
    (data: Uint8Array) => {
      const canvas = canvasRef.current
      if (!canvas) return

      if (!ctxRef.current) {
        ctxRef.current = canvas.getContext('2d', { alpha: false })
      }
      const ctx = ctxRef.current
      if (!ctx) return

      const { width: w, height: h } = canvas
      const bins = mirrorMode ? Math.floor(data.length / 2) : data.length
      const drawCount = mirrorMode ? bins * 2 : bins
      const barSpacing = 1.5
      const barWidth = Math.max(1, w / drawCount - barSpacing)
      const baseline = h * 0.7

      const palette = paletteRef.current
      const capColors = capColorsRef.current
      const glow1Colors = glow1ColorsRef.current
      const glow2Colors = glow2ColorsRef.current

      // Fill background manually as we disabled alpha for performance
      ctx.fillStyle = accentRef.current.palette.background
      ctx.fillRect(0, 0, w, h)

      for (let i = 0; i < drawCount; i++) {
        const dataIdx = mirrorMode ? (i < bins ? bins - 1 - i : i - bins) : i
        const value = data[dataIdx]
        if (value < 2) continue // Skip silence

        const ratio = value / 255
        const barHeight = ratio * baseline
        const x = i * (barWidth + barSpacing)

        // Draw bar using pre-rendered gradient from palette
        if (palette) {
          ctx.drawImage(palette, value, 0, 1, 256, x, baseline - barHeight, barWidth, barHeight)
        }

        // Glow cap
        if (barHeight > 6) {
          ctx.fillStyle = capColors[value]
          ctx.fillRect(x, baseline - barHeight, barWidth, 2)

          if (ratio > 0.7) {
            ctx.fillStyle = glow1Colors[value]
            ctx.fillRect(x - 2, baseline - barHeight - 2, barWidth + 4, 4)
            ctx.fillStyle = glow2Colors[value]
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
