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
  const mousePosRef = useRef<{ x: number; y: number } | null>(null)

  const { start, stop } = useAudioAnalyser({
    onWaveformData: waveData => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d', { alpha: true })
      if (!ctx) return

      const state = usePlayerStore.getState()
      const { currentTime, currentTrack } = state
      const duration = currentTrack?.duration || 0
      const progress = duration > 0 ? currentTime / duration : 0
      const beat = useVisualiserStore.getState().beat

      ctx.clearRect(0, 0, width, height)

      const barWidth = 2
      const gap = 1
      const totalBars = Math.floor(width / (barWidth + gap))

      const hoverFraction = mousePosRef.current ? mousePosRef.current.x / width : -1

      for (let i = 0; i < totalBars; i++) {
        const dataIdx = Math.floor((i / totalBars) * waveData.length)
        const value = waveData[dataIdx] / 255.0
        const barHeight = Math.max(2, (value - 0.5) * 2 * height * 0.8)

        const x = i * (barWidth + gap)
        const y = (height - barHeight) / 2
        const barProgress = i / totalBars

        const isPlayed = barProgress < progress
        const isGhost = hoverFraction !== -1 && barProgress < hoverFraction && barProgress > progress

        if (isGhost) {
          ctx.globalAlpha = 0.4
          ctx.fillStyle = accentColour
        } else {
          ctx.globalAlpha = 1.0
          ctx.fillStyle = isPlayed ? (beat ? '#fff' : accentColour) : 'rgba(255,255,255,0.15)'
        }

        ctx.fillRect(x, y, barWidth, barHeight)
        ctx.globalAlpha = 1.0

        // Vertical glow line on hover
        if (Math.abs(barProgress - hoverFraction) < (1 / totalBars)) {
          ctx.fillStyle = '#fff'
          ctx.fillRect(x, 0, 1, height)
        }
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
    if (audioEl && !isNaN(audioEl.duration)) {
      audioEl.currentTime = fraction * audioEl.duration
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    mousePosRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  const handleMouseLeave = () => {
    mousePosRef.current = null
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ cursor: 'pointer', display: 'block' }}
    />
  )
}
