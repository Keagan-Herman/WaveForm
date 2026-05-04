/**
 * Spectrogram.tsx
 *
 * Scrolling spectrogram — frequency over time rendered as a heatmap.
 * Each frame, a new column of frequency data is painted on the right
 * and the entire image scrolls left. Every second of audio leaves a
 * permanent visual trace.
 *
 * This is what audio engineers use. Showing it in a portfolio app
 * signals genuine depth. It's also genuinely beautiful.
 *
 * Colour mapping: dark (silence) → deep blue → cyan → green → yellow → white (loud)
 * The colour shifts with the dynamic accent hue so it themes with album art.
 *
 * Rendered entirely imperatively — no React state at 60fps.
 */

import { useRef, useEffect, useCallback } from 'react'
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser'

interface SpectrogramProps {
    width?: number
    height?: number
    accentHue?: number
}

export function Spectrogram({
    width = 560,
    height = 120,
    accentHue = 120,
}: SpectrogramProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const offscreenRef = useRef<HTMLCanvasElement | null>(null)
    const accentHueRef = useRef(accentHue)

    useEffect(() => {
        accentHueRef.current = accentHue
    }, [accentHue])

    // Initialise offscreen canvas for scroll effect
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
        const hue = accentHueRef.current

        // Copy current canvas to offscreen, shifted 1px left
        offCtx.drawImage(canvas, 0, 0)
        ctx.drawImage(offscreen, -1, 0)

        // Clear the rightmost column
        ctx.clearRect(w - 1, 0, 1, h)

        // Paint new frequency column on the right edge
        const bins = data.length
        const colHeight = h / bins

        for (let i = 0; i < bins; i++) {
            const value = data[bins - 1 - i] // flip so bass is at bottom
            const ratio = value / 255

            if (ratio < 0.02) continue // skip near-silence

            // Colour map: dark → accent hue → bright white
            // Low values: dark version of accent hue
            // Mid values: full saturation accent
            // High values: shift toward white
            const lightness = 10 + ratio * 70
            const saturation = ratio < 0.5 ? ratio * 180 : 90 - (ratio - 0.5) * 80
            const freqHue = (hue + ratio * 40) % 360

            ctx.fillStyle = `hsl(${freqHue}, ${saturation}%, ${lightness}%)`
            ctx.fillRect(w - 1, i * colHeight, 1, colHeight + 0.5)
        }

    }, [])

    const { start, stop } = useAudioAnalyser({ onFrequencyData: draw })

    useEffect(() => {
        start()
        return () => stop()
    }, [start, stop])

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            style={{
                display: 'block',
                borderRadius: 4,
                imageRendering: 'pixelated',
            }}
        />
    )
}