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

    if (!paletteCanvasRef.current) {
      paletteCanvasRef.current = document.createElement('canvas')
    }

    const pCanvas = paletteCanvasRef.current
    // 128 columns (one per frequency bin), 100 rows (amplitude gradient)
    pCanvas.width = 128
    pCanvas.height = 100
    const pCtx = pCanvas.getContext('2d')
    if (!pCtx) return

    const { s: sat, l: lit } = accent
    const isLight = lit > 62

    const capStrings: string[] = []
    const glowStrings: string[] = []
    const tipStrings: string[] = []

    for (let b = 0; b < 128; b++) {
      // Zone-based hue: warm bass → green mid → cool treble, 5-bin soft crossfades
      let binHue: number
      if (b < 6) {
        binHue = 25
      } else if (b < 11) {
        binHue = 25 + ((b - 6) / 5) * 95 // 25° → 120°
      } else if (b < 65) {
        binHue = 120
      } else if (b < 70) {
        binHue = 120 + ((b - 65) / 5) * 100 // 120° → 220°
      } else {
        binHue = 220
      }

      const grad = pCtx.createLinearGradient(b, 100, b, 0)
      if (isLight) {
        grad.addColorStop(0, `hsla(${binHue}, ${sat}%, 35%, 0.7)`)
        grad.addColorStop(0.6, `hsla(${binHue}, ${Math.min(100, sat * 1.2)}%, 70%, 1)`)
        grad.addColorStop(1, `hsla(${binHue}, 100%, 90%, 1)`)
      } else {
        grad.addColorStop(0, `hsla(${binHue}, ${sat}%, 18%, 0.8)`)
        grad.addColorStop(0.7, `hsla(${binHue}, ${sat}%, 48%, 1)`)
        grad.addColorStop(1, `hsla(${binHue}, 100%, 80%, 1)`)
      }
      pCtx.fillStyle = grad
      pCtx.fillRect(b, 0, 1, 100)

      capStrings[b] = `hsla(${binHue}, 100%, 85%, 0.8)`
      glowStrings[b] = `hsla(${binHue}, 100%, 70%, 0.3)`
      tipStrings[b] = `hsla(${binHue}, 100%, 92%, 0.8)`
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

        // Sample palette by bin position (x=dataIdx) for zone color, full gradient height
        ctx.drawImage(palette, dataIdx, 0, 1, 100, x, baseline - barHeight, barWidth, barHeight)

        if (barHeight > 6) {
          ctx.fillStyle = caps[dataIdx]
          ctx.fillRect(x, baseline - barHeight, barWidth, 2)

          if (ratio > 0.7) {
            ctx.fillStyle = glows[dataIdx]
            ctx.fillRect(x - 2, baseline - barHeight - 2, barWidth + 4, 4)
            ctx.fillStyle = tips[dataIdx]
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
        aria-hidden="true"
        width={effectiveWidth}
        height={effectiveHeight}
        className={className}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  )
}
