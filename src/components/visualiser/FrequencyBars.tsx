/**
 * FrequencyBars.tsx — v4
 *
 * Optimized version:
 * 1. Removed ctx.save()/ctx.restore() from the hot path loop.
 * 2. Replaced expensive ctx.shadowBlur (Gaussian blur) with layered rects.
 * 3. Batched reflection drawing into a single pass at the end of the frame.
 * 4. Minimized string allocations and unnecessary context state changes.
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

  const drawBars = useCallback(
    (data: Uint8Array) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d', { alpha: false })
      if (!ctx) return

      const { width: w, height: h } = canvas
      const { h: hue, s: sat, l: lit } = accentRef.current
      const isLight = lit > 62

      const bins = mirrorMode ? Math.floor(data.length / 2) : data.length
      const drawCount = mirrorMode ? bins * 2 : bins
      const barSpacing = 1.5
      const barWidth = Math.max(1, w / drawCount - barSpacing)
      const baseline = h * 0.7

      // Fill background manually as we disabled alpha for performance
      ctx.fillStyle = accentRef.current.palette.background
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
        const barHue = (hue + ratio * 50) % 360

        const grad = ctx.createLinearGradient(x, baseline, x, baseline - barHeight)

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

        ctx.fillStyle = grad
        ctx.fillRect(x, baseline - barHeight, barWidth, barHeight)

        // Glow cap (High-performance replacement for shadowBlur)
        if (barHeight > 6) {
          const capLit = 85
          ctx.fillStyle = `hsla(${barHue}, 100%, ${capLit}%, 0.8)`
          ctx.fillRect(x, baseline - barHeight, barWidth, 2)

          if (ratio > 0.7) {
            // Layered rectangles to simulate glow without Gaussian blur cost
            ctx.fillStyle = `hsla(${barHue}, 100%, 70%, 0.3)`
            ctx.fillRect(x - 2, baseline - barHeight - 2, barWidth + 4, 4)
            ctx.fillStyle = `hsla(${barHue}, 100%, 92%, 0.8)`
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
