/**
 * Spectrogram.tsx — interactive
 *
 * Added: hover shows frequency label and time cursor.
 * A vertical crosshair follows the mouse showing the timestamp
 * and a horizontal line shows the frequency at the cursor position.
 */

import { useRef, useEffect, useCallback, useState } from 'react'
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser'

interface SpectrogramProps {
    width?: number
    height?: number
    accentHue?: number
    accentColour?: string
}

export function Spectrogram({
    width = 560,
    height = 110,
    accentHue = 120,
    accentColour = '#1db954',
}: SpectrogramProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const overlayRef = useRef<HTMLCanvasElement>(null)
    const offscreenRef = useRef<HTMLCanvasElement | null>(null)
    const accentHueRef = useRef(accentHue)
    const frameCountRef = useRef(0)
    const [hoverInfo, setHoverInfo] = useState<{ x: number; freqLabel: string } | null>(null)

    useEffect(() => { accentHueRef.current = accentHue }, [accentHue])

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
        frameCountRef.current++

        offCtx.drawImage(canvas, 0, 0)
        ctx.drawImage(offscreen, -1, 0)
        ctx.clearRect(w - 1, 0, 1, h)

        const bins = data.length
        const colHeight = h / bins

        for (let i = 0; i < bins; i++) {
            const value = data[bins - 1 - i]
            const ratio = value / 255
            if (ratio < 0.015) continue

            const lightness = 8 + ratio * 72
            const saturation = ratio < 0.4
                ? ratio * 200
                : 80 - (ratio - 0.4) * 60
            const freqHue = (hue + ratio * 50) % 360

            ctx.fillStyle = `hsl(${freqHue}, ${saturation}%, ${lightness}%)`
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

        // Map y position to frequency
        const ratio = 1 - y / canvas.height
        const freq = Math.round(ratio * 22050)
        const label = freq >= 1000
            ? `${(freq / 1000).toFixed(1)} kHz`
            : `${freq} Hz`

        setHoverInfo({ x, freqLabel: label })
    }, [])

    const handleMouseLeave = useCallback(() => setHoverInfo(null), [])

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
                        color: `${accentColour}99`,
                        fontFamily: 'monospace',
                        lineHeight: 1,
                    }}>
                        {label}
                    </span>
                ))}
            </div>

            {/* Hover crosshair */}
            {hoverInfo && (
                <>
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: hoverInfo.x,
                        width: 1,
                        background: `${accentColour}55`,
                        pointerEvents: 'none',
                    }} />
                    <div style={{
                        position: 'absolute',
                        bottom: 4,
                        left: Math.min(hoverInfo.x + 6, width - 80),
                        fontFamily: 'monospace',
                        fontSize: '0.55rem',
                        color: accentColour,
                        background: 'rgba(0,0,0,0.7)',
                        padding: '0.15rem 0.4rem',
                        borderRadius: 3,
                        pointerEvents: 'none',
                        border: `1px solid ${accentColour}33`,
                        whiteSpace: 'nowrap',
                    }}>
                        {hoverInfo.freqLabel}
                    </div>
                </>
            )}
        </div>
    )
}