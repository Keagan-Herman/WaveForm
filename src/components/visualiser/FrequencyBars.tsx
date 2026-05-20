/**
 * FrequencyBars.tsx — v4
 *
 * Optimized version:
 * 1. Removed ctx.save()/ctx.restore() from the hot path loop.
 * 2. Replaced expensive ctx.shadowBlur (Gaussian blur) with layered rects.
 * 3. Batched reflection drawing into a single pass at the end of the frame.
 * 4. Minimized string allocations and unnecessary context state changes via pre-rendered palette.
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

  // Pre-rendered assets to avoid allocations in the hot path
  const paletteRef = useRef<HTMLCanvasElement | null>(null)
  const capColorLookup = useRef<string[]>([])
  const glow70Lookup = useRef<string[]>([])
  const glow92Lookup = useRef<string[]>([])

  useEffect(() => {
    // 1. Pre-render palette (256 vertical gradient strips)
    if (!paletteRef.current) {
      paletteRef.current = document.createElement('canvas')
      paletteRef.current.width = 256
      paletteRef.current.height = 256
    }
    const pCanvas = paletteRef.current
    const pCtx = pCanvas.getContext('2d')!
    pCtx.clearRect(0, 0, 256, 256)

    const { h: hue, s: sat, l: lit } = accent
    const isLight = lit > 62

    // 2. Pre-calculate HSL strings for glow effects
    const caps = new Array(256)
    const g70 = new Array(256)
    const g92 = new Array(256)

    for (let v = 0; v < 256; v++) {
      const ratio = v / 255
      const barHue = (hue + ratio * 50) % 360

      // Draw gradient strip into palette
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

      // Cache glow strings
      caps[v] = `hsla(${barHue}, 100%, 85%, 0.8)`
      g70[v] = `hsla(${barHue}, 100%, 70%, 0.3)`
      g92[v] = `hsla(${barHue}, 100%, 92%, 0.8)`
    }

    capColorLookup.current = caps
    glow70Lookup.current = g70
    glow92Lookup.current = g92
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

      // Fill background manually as we disabled alpha for performance
      ctx.fillStyle = accent.palette.background
      ctx.fillRect(0, 0, w, h)

      // We still need gradients per bar because the hue/lightness shifts with the ratio
      // however we've eliminated the most expensive parts (shadows and save/restore).

      for (let i = 0; i < drawCount; i++) {
        const dataIdx = mirrorMode ? (i < bins ? bins - 1 - i : i - bins) : i
        const value = data[dataIdx]
        if (value < 2) continue // Skip silence

        const ratio = value / 255
        const barHeight = ratio * baseline
        const x = i * (barWidth + barSpacing)

        // Optimized render: Sample from pre-rendered palette instead of createLinearGradient
        if (paletteRef.current) {
          ctx.drawImage(
            paletteRef.current,
            value, // source x (the gradient for this magnitude)
            0,     // source y
            1,     // source width
            256,   // source height
            x,     // dest x
            baseline - barHeight, // dest y
            barWidth,  // dest width
            barHeight  // dest height
          )
        }

        // Glow cap (High-performance replacement for shadowBlur)
        if (barHeight > 6) {
          ctx.fillStyle = capColorLookup.current[value]
          ctx.fillRect(x, baseline - barHeight, barWidth, 2)

          if (ratio > 0.7) {
            // Layered rectangles to simulate glow without Gaussian blur cost
            ctx.fillStyle = glow70Lookup.current[value]
            ctx.fillRect(x - 2, baseline - barHeight - 2, barWidth + 4, 4)
            ctx.fillStyle = glow92Lookup.current[value]
            ctx.fillRect(x, baseline - barHeight - 1, barWidth, 2)
          }
        }
      }

      // Reflection pass — ONE pass instead of per-bar save/restore
      // We flip the entire top section onto the bottom
      ctx.save()
      ctx.globalAlpha = 0.15
      ctx.setTransform(1, 0, 0, -0.4, 0, baseline + baseline * 0.4)
      // Draw the bars again from the top section
      ctx.drawImage(canvas, 0, 0, w, baseline, 0, 0, w, baseline)
      ctx.restore()
    },
    [mirrorMode, accent]
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
