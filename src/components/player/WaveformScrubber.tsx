import React, { useRef, useEffect } from 'react'
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser'
import { usePlayerStore } from '@/stores/playerStore'
import { useVisualiserStore } from '@/stores/visualiserStore'

interface WaveformScrubberProps {
  width: number
  height: number
  accentColour: string
}

export function WaveformScrubber({ width, height, accentColour }: WaveformScrubberProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isPlaying = usePlayerStore(state => state.isPlaying)

  const { start, stop } = useAudioAnalyser({
    onWaveformData: waveData => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Pull high-frequency state imperatively to avoid React re-renders
      const progress = usePlayerStore.getState().progress
      const beat = useVisualiserStore.getState().beat

      ctx.clearRect(0, 0, width, height)

      const barWidth = 2
      const gap = 1
      const totalBars = Math.floor(width / (barWidth + gap))

      // We draw the live waveform reflected across the progress bar
      ctx.fillStyle = accentColour

      for (let i = 0; i < totalBars; i++) {
        const dataIdx = Math.floor((i / totalBars) * waveData.length)
        const value = waveData[dataIdx] / 255.0
        const barHeight = Math.max(2, (value - 0.5) * 2 * height * 0.8)

        const x = i * (barWidth + gap)
        const y = (height - barHeight) / 2

        // Change color based on progress
        const isPlayed = i / totalBars < progress
        ctx.fillStyle = isPlayed ? (beat ? '#fff' : accentColour) : 'rgba(255,255,255,0.15)'

        ctx.fillRect(x, y, barWidth, barHeight)
      }
    },
  })

  useEffect(() => {
    if (isPlaying) start()
    else stop()
  }, [isPlaying, start, stop])

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const fraction = (e.clientX - rect.left) / rect.width
    const audioEl = document.getElementById('preview-audio') as HTMLAudioElement
    if (audioEl) {
      audioEl.currentTime = fraction * audioEl.duration
      usePlayerStore.getState().setProgress(fraction)
    }
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onClick={handleClick}
      style={{ cursor: 'pointer', display: 'block' }}
    />
  )
}
