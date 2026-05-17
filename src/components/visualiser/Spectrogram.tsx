/**
 * Spectrogram.tsx — v5 (Optimized)
 *
 * Optimized version:
 * 1. Pre-calculated color map for all 256 byte values to eliminate per-frame
 *    HSL string allocations and complex branching in the hot path.
 * 2. Stable draw callback using accentRef.
 * 3. Minimized logic inside the frequency bin loop.
 */

import { useRef, useEffect, useCallback, useState } from 'react'
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser'
import { useResize } from '@/hooks/useResize'
import type { AlbumColour } from '@/hooks/useAlbumColour'

interface SpectrogramProps {
  width?: number
  height?: number
  accent: AlbumColour
}

export function Spectrogram({
  width: initialWidth = 560,
  height: initialHeight = 110,
  accent,
}: SpectrogramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const offscreenRef = useRef<HTMLCanvasElement | null>(null)
  const { width, height } = useResize(containerRef)

  const effectiveWidth = width || initialWidth
  const effectiveHeight = height || initialHeight
  const accentRef = useRef(accent)
  const colorMapRef = useRef<string[]>([])
  const [hoverInfo, setHoverInfo] = useState<{ x: number; freqLabel: string } | null>(null)

  useEffect(() => {
    accentRef.current = accent

    // Pre-calculate color map for 256 possible byte values (0-255)
    const newMap = new Array(256)
    const { h: hue, s: sat, l: lit } = accent
    const isLight = lit > 62
    const isDesaturated = sat < 20

    for (let i = 0; i < 256; i++) {
      const ratio = i / 255
      if (ratio < 0.015) {
        newMap[i] = 'transparent'
        continue
      }

      if (isDesaturated) {
        // White/grey album — neutral warm colour map, no hue cast
        const lightness = 12 + ratio * 75
        const warmth = ratio * 15
        newMap[i] = `hsl(${30 + warmth}, ${ratio * 12}%, ${lightness}%)`
      } else if (isLight) {
        // Bright saturated album — vivid mid-tones, shifts toward white at peaks
        const freqHue = (hue + ratio * 45) % 360
        const lightness = 30 + ratio * 55
        const saturation = ratio < 0.5 ? 50 + ratio * 50 : Math.max(20, 100 - ratio * 70)
        newMap[i] = `hsl(${freqHue}, ${saturation}%, ${lightness}%)`
      } else {
        // Dark/normal album
        const freqHue = (hue + ratio * 50) % 360
        const lightness = 8 + ratio * 72
        const saturation = ratio < 0.4 ? ratio * 200 : 80 - (ratio - 0.4) * 60
        newMap[i] = `hsl(${freqHue}, ${saturation}%, ${lightness}%)`
      }
    }
    colorMapRef.current = newMap
  }, [accent])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    offscreenRef.current = document.createElement('canvas')
    offscreenRef.current.width = effectiveWidth
    offscreenRef.current.height = effectiveHeight
  }, [effectiveWidth, effectiveHeight])

  const draw = useCallback(
    (data: Uint8Array) => {
      const canvas = canvasRef.current
      const offscreen = offscreenRef.current
      if (!canvas || !offscreen) return

      const ctx = canvas.getContext('2d')
      const offCtx = offscreen.getContext('2d')
      if (!ctx || !offCtx) return

      const w = canvas.width
      const h = canvas.height
      const colorMap = colorMapRef.current

      // Shift the existing image to the left
      offCtx.drawImage(canvas, 0, 0)
      ctx.drawImage(offscreen, -1, 0)
      // Clear the last column
      ctx.clearRect(w - 1, 0, 1, h)

      const bins = data.length
      const colHeight = h / bins

      for (let i = 0; i < bins; i++) {
        const value = data[bins - 1 - i]
        if (value < 4) continue // Minor threshold for noise/silence

        ctx.fillStyle = colorMap[value] || 'transparent'
        ctx.fillRect(w - 1, i * colHeight, 1, colHeight + 0.5)
      }
    },
    []
  )

  const { start, stop } = useAudioAnalyser({ onFrequencyData: draw })

  useEffect(() => {
    start()
    return () => stop()
  }, [start, stop])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const y = e.clientY - rect.top
    const x = e.clientX - rect.left
    const ratio = 1 - y / canvas.height
    const freq = Math.round(ratio * 22050)
    const label = freq >= 1000 ? `${(freq / 1000).toFixed(1)} kHz` : `${freq} Hz`
    setHoverInfo({ x, freqLabel: label })
  }, [])

  const handleMouseLeave = useCallback(() => setHoverInfo(null), [])

  const accentHex = accent.hex

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'block',
        cursor: 'crosshair',
        width: '100%',
        height: '100%',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <canvas
        ref={canvasRef}
        width={effectiveWidth}
        height={effectiveHeight}
        style={{
          display: 'block',
          borderRadius: 4,
          imageRendering: 'pixelated',
          width: '100%',
          height: '100%',
        }}
      />

      {/* Frequency axis labels */}
      <div
        style={{
          position: 'absolute',
          right: 4,
          top: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          pointerEvents: 'none',
          padding: '2px 0',
        }}
      >
        {['20k', '10k', '4k', '1k', '250', '60'].map(label => (
          <span
            key={label}
            style={{
              fontSize: '0.6rem',
              color: `${accentHex}99`,
              fontFamily: 'monospace',
              lineHeight: 1,
              transition: 'color 1s ease',
            }}
          >
            {label}
          </span>
        ))}
      </div>

      {hoverInfo && (
        <>
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: hoverInfo.x,
              width: 1,
              background: `${accentHex}55`,
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 4,
              left: Math.min(hoverInfo.x + 6, (width || initialWidth) - 80),
              fontFamily: 'monospace',
              fontSize: '0.65rem',
              color: accentHex,
              background: 'rgba(0,0,0,0.75)',
              padding: '0.15rem 0.4rem',
              borderRadius: 3,
              pointerEvents: 'none',
              border: `1px solid ${accentHex}33`,
              whiteSpace: 'nowrap',
              transition: 'color 1s ease',
            }}
          >
            {hoverInfo.freqLabel}
          </div>
        </>
      )}
    </div>
  )
}
