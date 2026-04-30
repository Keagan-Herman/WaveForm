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

import { useRef, useEffect, useCallback } from 'react'
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser'

interface FrequencyBarsProps {
  width?: number
  height?: number
  barColor?: string
  mirrorMode?: boolean
  className?: string
}

export function FrequencyBars({
  width = 800,
  height = 200,
  barColor = '#1db954',
  mirrorMode = true,
  className,
}: FrequencyBarsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const drawBars = useCallback(
    (data: Uint8Array) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const { width: w, height: h } = canvas
      ctx.clearRect(0, 0, w, h)

      const bins = mirrorMode ? Math.floor(data.length / 2) : data.length
      const barWidth = (w / bins) - 1

      for (let i = 0; i < bins; i++) {
        const value = mirrorMode
          ? (data[i] + data[data.length - 1 - i]) / 2
          : data[i]

        const barHeight = (value / 255) * h

        // Colour shifts from green (quiet) through yellow to red (loud)
        const ratio = value / 255
        const hue = 120 - ratio * 80  // 120 = green, 40 = yellow-orange
        const saturation = 70 + ratio * 30
        const lightness = 40 + ratio * 15

        // Main bar
        ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`
        ctx.fillRect(
          i * (barWidth + 1),
          h - barHeight,
          barWidth,
          barHeight
        )

        // Subtle glow cap at the top of each bar
        if (barHeight > 4) {
          ctx.fillStyle = `hsla(${hue}, 100%, 80%, 0.6)`
          ctx.fillRect(
            i * (barWidth + 1),
            h - barHeight,
            barWidth,
            2
          )
        }
      }
    },
    [mirrorMode]
  )

  const { start, stop } = useAudioAnalyser({
    onFrequencyData: drawBars,
  })

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