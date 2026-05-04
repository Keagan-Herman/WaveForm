/**
 * RadialVisualiser.tsx
 *
 * Polar frequency visualiser — bars radiate outward from a centre point.
 * The most visually striking of the three visualisers. Reacts to both
 * frequency data and the dynamic accent colour extracted from album art.
 *
 * Rendered entirely to canvas — no React state at 60fps.
 * Supports a colour prop so it themes with the album art dynamically.
 */

import { useRef, useEffect, useCallback } from 'react'
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser'

interface RadialVisualiserProps {
    size?: number
    accentColour?: string
    accentHue?: number
}

export function RadialVisualiser({
    size = 320,
    accentColour = '#1db954',
    accentHue = 120,
}: RadialVisualiserProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const accentRef = useRef({ colour: accentColour, hue: accentHue })

    useEffect(() => {
        accentRef.current = { colour: accentColour, hue: accentHue }
    }, [accentColour, accentHue])

    const draw = useCallback((data: Uint8Array) => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const { width: w, height: h } = canvas
        const cx = w / 2
        const cy = h / 2
        const { hue } = accentRef.current

        ctx.clearRect(0, 0, w, h)

        const bins = Math.floor(data.length / 2)
        const angleStep = (Math.PI * 2) / bins
        const innerRadius = w * 0.18
        const maxBarLen = w * 0.28

        // Draw inner circle
        ctx.beginPath()
        ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2)
        ctx.strokeStyle = `hsla(${hue}, 60%, 50%, 0.15)`
        ctx.lineWidth = 1
        ctx.stroke()

        // Draw bars
        for (let i = 0; i < bins; i++) {
            const value = data[i]
            const ratio = value / 255
            const barLen = ratio * maxBarLen
            const angle = i * angleStep - Math.PI / 2

            const x1 = cx + Math.cos(angle) * innerRadius
            const y1 = cy + Math.sin(angle) * innerRadius
            const x2 = cx + Math.cos(angle) * (innerRadius + barLen)
            const y2 = cy + Math.sin(angle) * (innerRadius + barLen)

            // Colour: shift hue with frequency position
            const freqHue = (hue + ratio * 60) % 360
            const alpha = 0.4 + ratio * 0.6

            ctx.beginPath()
            ctx.moveTo(x1, y1)
            ctx.lineTo(x2, y2)
            ctx.strokeStyle = `hsla(${freqHue}, 85%, 55%, ${alpha})`
            ctx.lineWidth = 2 + ratio * 2
            ctx.lineCap = 'round'
            ctx.stroke()

            // Glow tip on loud bars
            if (ratio > 0.65) {
                ctx.beginPath()
                ctx.arc(x2, y2, 2 + ratio * 3, 0, Math.PI * 2)
                ctx.fillStyle = `hsla(${freqHue}, 100%, 75%, ${ratio * 0.8})`
                ctx.fill()
            }
        }

        // Centre glow circle — pulses with bass
        const bassAvg = Array.from(data.slice(0, 8)).reduce((a, b) => a + b, 0) / 8
        const bassRatio = bassAvg / 255
        const glowRadius = innerRadius * (0.7 + bassRatio * 0.5)

        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius)
        grd.addColorStop(0, `hsla(${hue}, 80%, 60%, ${0.15 + bassRatio * 0.25})`)
        grd.addColorStop(1, `hsla(${hue}, 80%, 60%, 0)`)

        ctx.beginPath()
        ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2)
        ctx.fillStyle = grd
        ctx.fill()

    }, [])

    const { start, stop } = useAudioAnalyser({ onFrequencyData: draw })

    useEffect(() => {
        start()
        return () => stop()
    }, [start, stop])

    return (
        <canvas
            ref={canvasRef}
            width={size}
            height={size}
            style={{ display: 'block' }}
        />
    )
}