import { useRef } from 'react'
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser'
import { useVisualiserStore } from '@/stores/visualiserStore'
import { useResize } from '@/hooks/useResize'
import type { AlbumColour } from '@/hooks/useAlbumColour'

interface RadialVisualiserProps {
  width?: number
  height?: number
  accent: AlbumColour
}

export function RadialVisualiser({ width: initialWidth = 400, height: initialHeight = 400, accent }: RadialVisualiserProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { width, height } = useResize(containerRef)

  const effectiveWidth = width || initialWidth
  const effectiveHeight = height || initialHeight

  useAudioAnalyser({
    onFrequencyData: freqData => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const { isLowQuality } = useVisualiserStore.getState()

      ctx.clearRect(0, 0, effectiveWidth, effectiveHeight)

      const centerX = effectiveWidth / 2
      const centerY = effectiveHeight / 2
      const radius = Math.min(effectiveWidth, effectiveHeight) * 0.25
      const barCount = isLowQuality ? 40 : 80
      const barWidth = (2 * Math.PI * radius) / barCount * 0.8

      ctx.strokeStyle = accent.hex
      ctx.lineWidth = barWidth
      ctx.lineCap = 'round'

      for (let i = 0; i < barCount; i++) {
        // Map bar to frequency data, skipping the very low/high end
        const idx = Math.floor((i / barCount) * (freqData.length * 0.8))
        const val = freqData[idx]
        const barHeight = (val / 255) * radius * 0.8

        const angle = (i / barCount) * Math.PI * 2
        const x1 = centerX + Math.cos(angle) * radius
        const y1 = centerY + Math.sin(angle) * radius
        const x2 = centerX + Math.cos(angle) * (radius + barHeight)
        const y2 = centerY + Math.sin(angle) * (radius + barHeight)

        const opacity = 0.3 + (val / 255) * 0.7
        ctx.strokeStyle = `rgba(${accent.h}, ${accent.s}%, ${accent.l}%, ${opacity})`

        // Use HSL for stroke if easier or keep hex with alpha
        ctx.strokeStyle = `hsla(${accent.h}, ${accent.s}%, ${accent.l}%, ${opacity})`

        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
      }

      // Inner circle glow
      const { bassPower } = useVisualiserStore.getState()
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius - 5, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${accent.h}, ${accent.s}%, ${accent.l}%, ${0.05 + bassPower * 0.1})`
      ctx.fill()
    }
  })

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        width={effectiveWidth}
        height={effectiveHeight}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  )
}
