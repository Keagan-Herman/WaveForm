import { useRef, useEffect, useCallback } from 'react'
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser'
import { useVisualiserStore } from '@/stores/visualiserStore'
import { useResize } from '@/hooks/useResize'
import type { AlbumColour } from '@/hooks/useAlbumColour'

interface RadialVisualiserProps {
  width?: number
  height?: number
  accent: AlbumColour
}

export function RadialVisualiser({
  width: initialWidth = 400,
  height: initialHeight = 400,
  accent,
}: RadialVisualiserProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { width, height } = useResize(containerRef)

  const effectiveWidth = width || initialWidth
  const effectiveHeight = height || initialHeight

  const accentRef = useRef(accent)
  // Pre-calculated color map to avoid string allocations in the hot path
  const colorMapRef = useRef<string[]>([])

  useEffect(() => {
    accentRef.current = accent
    // Pre-calculate 256 HSL strings for all possible byte values
    const newMap = new Array(256)
    const { h, s, l } = accent
    for (let i = 0; i < 256; i++) {
      const opacity = 0.3 + (i / 255) * 0.7
      newMap[i] = `hsla(${h}, ${s}%, ${l}%, ${opacity.toFixed(2)})`
    }
    colorMapRef.current = newMap
  }, [accent])

  const draw = useCallback(
    (freqData: Uint8Array) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d', { alpha: true })
      if (!ctx) return

      const { isLowQuality } = useVisualiserStore.getState()

      // Explicitly clear the whole canvas every frame.
      // Use canvas.width/height to ensure the full area is cleared even if resize is pending.
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const centerX = canvas.width / 2
      const centerY = canvas.height / 2
      const radius = Math.min(canvas.width, canvas.height) * 0.25
      const barCount = isLowQuality ? 40 : 80
      const barWidth = ((2 * Math.PI * radius) / barCount) * 0.8

      ctx.lineWidth = barWidth
      ctx.lineCap = 'round'

      const colorMap = colorMapRef.current

      for (let i = 0; i < barCount; i++) {
        // Map bar to frequency data, skipping the very low/high end
        const idx = Math.floor((i / barCount) * (freqData.length * 0.8))
        const val = freqData[idx]
        if (val < 2) continue // Skip silence

        const barHeight = (val / 255) * radius * 0.8

        const angle = (i / barCount) * Math.PI * 2
        const x1 = centerX + Math.cos(angle) * radius
        const y1 = centerY + Math.sin(angle) * radius
        const x2 = centerX + Math.cos(angle) * (radius + barHeight)
        const y2 = centerY + Math.sin(angle) * (radius + barHeight)

        ctx.strokeStyle = colorMap[val] || colorMap[0]

        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
      }

      // Inner circle glow
      const { bassPower } = useVisualiserStore.getState()
      const { h, s, l } = accentRef.current
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius - 5, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${h}, ${s}%, ${l}%, ${(0.05 + bassPower * 0.1).toFixed(2)})`
      ctx.fill()
    },
    [] // Stable dependencies, we read dimensions from canvas directly
  )

  const { start, stop } = useAudioAnalyser({ onFrequencyData: draw })

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
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  )
}
