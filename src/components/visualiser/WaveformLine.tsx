/**
 * WaveformLine.tsx
 *
 * Scrolling time-domain waveform visualiser.
 * Uses getByteTimeDomainData — values are 0–255 where 128 = silence.
 *
 * Renders as a continuous line that draws left to right across the canvas.
 * Looks like an oscilloscope trace. Distinct from the frequency bars —
 * this shows the actual waveform shape of the audio signal.
 */

import { useRef, useEffect, useCallback } from 'react'
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser'

interface WaveformLineProps {
  width?: number
  height?: number
  lineColor?: string
  lineWidth?: number
  className?: string
}

export function WaveformLine({
  width = 800,
  height = 100,
  lineColor = '#1db954',
  lineWidth = 2,
  className,
}: WaveformLineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const drawWaveform = useCallback(
    (data: Uint8Array) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const { width: w, height: h } = canvas
      ctx.clearRect(0, 0, w, h)

      // Subtle centre line
      ctx.strokeStyle = `${lineColor}22`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, h / 2)
      ctx.lineTo(w, h / 2)
      ctx.stroke()

      // Waveform line
      ctx.lineWidth = lineWidth
      ctx.strokeStyle = lineColor
      ctx.shadowColor = lineColor
      ctx.shadowBlur = 6
      ctx.beginPath()

      const sliceWidth = w / data.length

      for (let i = 0; i < data.length; i++) {
        // data[i] is 0–255; 128 = zero crossing (silence)
        const v = data[i] / 128 - 1 // normalise to -1 → +1
        const y = (v * h) / 2 + h / 2 // map to canvas y

        if (i === 0) {
          ctx.moveTo(0, y)
        } else {
          ctx.lineTo(i * sliceWidth, y)
        }
      }

      ctx.lineTo(w, h / 2)
      ctx.stroke()

      // Reset shadow so it doesn't bleed onto other canvas draws
      ctx.shadowBlur = 0
    },
    [lineColor, lineWidth]
  )

  const { start, stop } = useAudioAnalyser({
    onWaveformData: drawWaveform,
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
