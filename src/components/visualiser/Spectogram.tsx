/**
 * Spectrogram.tsx — v4
 *
 * Fix: low-saturation albums (white, grey) were still producing blue/purple
 * spectrograms because the hue was 220 and the colour map anchored to it.
 *
 * For desaturated albums: use a neutral warm-white colour map that
 * doesn't carry a hue cast. Bright = white/cream, dark = near-black.
 * This looks clean and appropriate for white/grey covers.
 *
 * For saturated albums: existing behaviour — colour map anchored to
 * the dominant hue with ratio-based shifts.
 */

import { useRef, useEffect, useCallback, useState } from 'react'
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser'
import type { AlbumColour } from '@/hooks/useAlbumColour'

interface SpectrogramProps {
  width?: number
  height?: number
  accent: AlbumColour
}

export function Spectrogram({
  width = 560,
  height = 110,
  accent,
}: SpectrogramProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const offscreenRef = useRef<HTMLCanvasElement | null>(null)
  const accentRef = useRef(accent)
  const [hoverInfo, setHoverInfo] = useState<{ x: number; freqLabel: string } | null>(null)

  useEffect(() => { accentRef.current = accent }, [accent])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    offscreenRef.current = document.createElement('canvas')
    offscreenRef.current.width = canvas.width
    offscreenRef.current.height = canvas.height
  }, [width, height])

  const draw = useCallback((data: Uint8Array) => {
    const canvas = canvasRef.current
    const offscreen = offscreenRef.current
    if (!canvas || !offscreen) return

    const ctx = canvas.getContext('2d')
    const offCtx = offscreen.getContext('2d')
    if (!ctx || !offCtx) return

    const { width: w, height: h } = canvas
    const { h: hue, s: sat, l: lit } = accentRef.current
    const isLight = lit > 62
    const isDesaturated = sat < 20

    offCtx.drawImage(canvas, 0, 0)
    ctx.drawImage(offscreen, -1, 0)
    ctx.clearRect(w - 1, 0, 1, h)

    const bins = data.length
    const colHeight = h / bins

    for (let i = 0; i < bins; i++) {
      const value = data[bins - 1 - i]
      const ratio = value / 255
      if (ratio < 0.015) continue

      let fillStyle: string

      if (isDesaturated) {
        // White/grey album — neutral warm colour map, no hue cast
        // Dark silence → warm grey → bright white/cream at peaks
        const lightness = 12 + ratio * 75
        const warmth = ratio * 15  // slight warm tint at peaks only
        fillStyle = `hsl(${30 + warmth}, ${ratio * 12}%, ${lightness}%)`

      } else if (isLight) {
        // Bright saturated album — vivid mid-tones, shifts toward white at peaks
        const freqHue = (hue + ratio * 45) % 360
        const lightness = 30 + ratio * 55
        const saturation = ratio < 0.5
          ? 50 + ratio * 50
          : Math.max(20, 100 - ratio * 70)
        fillStyle = `hsl(${freqHue}, ${saturation}%, ${lightness}%)`

      } else {
        // Dark/normal album — existing behaviour: dark → vivid → bright
        const freqHue = (hue + ratio * 50) % 360
        const lightness = 8 + ratio * 72
        const saturation = ratio < 0.4
          ? ratio * 200
          : 80 - (ratio - 0.4) * 60
        fillStyle = `hsl(${freqHue}, ${saturation}%, ${lightness}%)`
      }

      ctx.fillStyle = fillStyle
      ctx.fillRect(w - 1, i * colHeight, 1, colHeight + 0.5)
    }
  }, [])

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
    const label = freq >= 1000
      ? `${(freq / 1000).toFixed(1)} kHz`
      : `${freq} Hz`
    setHoverInfo({ x, freqLabel: label })
  }, [])

  const handleMouseLeave = useCallback(() => setHoverInfo(null), [])

  const accentHex = accent.hex

  return (
    <div
      style={{ position: 'relative', display: 'block', cursor: 'crosshair' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ display: 'block', borderRadius: 4, imageRendering: 'pixelated' }}
      />

      {/* Frequency axis labels */}
      <div style={{
        position: 'absolute',
        right: 4,
        top: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        pointerEvents: 'none',
        padding: '2px 0',
      }}>
        {['20k', '10k', '4k', '1k', '250', '60'].map(label => (
          <span key={label} style={{
            fontSize: '0.45rem',
            color: `${accentHex}99`,
            fontFamily: 'monospace',
            lineHeight: 1,
            transition: 'color 1s ease',
          }}>
            {label}
          </span>
        ))}
      </div>

      {hoverInfo && (
        <>
          <div style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: hoverInfo.x,
            width: 1,
            background: `${accentHex}55`,
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute',
            bottom: 4,
            left: Math.min(hoverInfo.x + 6, width - 80),
            fontFamily: 'monospace',
            fontSize: '0.55rem',
            color: accentHex,
            background: 'rgba(0,0,0,0.75)',
            padding: '0.15rem 0.4rem',
            borderRadius: 3,
            pointerEvents: 'none',
            border: `1px solid ${accentHex}33`,
            whiteSpace: 'nowrap',
            transition: 'color 1s ease',
          }}>
            {hoverInfo.freqLabel}
          </div>
        </>
      )}
    </div>
  )
}