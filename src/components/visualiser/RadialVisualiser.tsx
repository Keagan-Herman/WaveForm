/**
 * RadialVisualiser.tsx — interactive
 *
 * Added: click a frequency segment to highlight/isolate that band.
 * Highlighted band glows brightly, others dim.
 * Click same band again to deselect.
 * Hover shows the frequency range of that segment.
 */

import { useRef, useEffect, useCallback, useState } from 'react'
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
    const selectedBandRef = useRef<number | null>(null)
    const hoveredBandRef = useRef<number | null>(null)
    const [selectedBand, setSelectedBand] = useState<number | null>(null)
    const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string } | null>(null)

    useEffect(() => {
        accentRef.current = { colour: accentColour, hue: accentHue }
    }, [accentColour, accentHue])

    // Band labels for the tooltip
    const getBandLabel = (binIndex: number, totalBins: number): string => {
        const sampleRate = 44100
        const fftSize = 256
        const binWidth = sampleRate / fftSize
        const freq = Math.round(binIndex * binWidth)
        if (freq < 1000) return `${freq} Hz`
        return `${(freq / 1000).toFixed(1)} kHz`
    }

    const draw = useCallback((data: Uint8Array) => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const { width: w, height: h } = canvas
        const cx = w / 2
        const cy = h / 2
        const { hue } = accentRef.current
        const selected = selectedBandRef.current
        const hovered = hoveredBandRef.current

        ctx.clearRect(0, 0, w, h)

        const bins = Math.floor(data.length / 2)
        const angleStep = (Math.PI * 2) / bins
        const innerRadius = w * 0.18
        const maxBarLen = w * 0.30

        // Inner ring
        ctx.beginPath()
        ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2)
        ctx.strokeStyle = `hsla(${hue}, 60%, 50%, 0.12)`
        ctx.lineWidth = 1
        ctx.stroke()

        for (let i = 0; i < bins; i++) {
            const value = data[i]
            const ratio = value / 255
            const barLen = ratio * maxBarLen
            const angle = i * angleStep - Math.PI / 2

            const x1 = cx + Math.cos(angle) * innerRadius
            const y1 = cy + Math.sin(angle) * innerRadius
            const x2 = cx + Math.cos(angle) * (innerRadius + barLen)
            const y2 = cy + Math.sin(angle) * (innerRadius + barLen)

            const isSelected = selected === i
            const isHovered = hovered === i
            const hasSelection = selected !== null
            const dimmed = hasSelection && !isSelected

            const freqHue = (hue + (i / bins) * 60) % 360
            const alpha = dimmed ? 0.1 : (isSelected ? 1 : 0.5 + ratio * 0.5)
            const lw = isSelected
                ? 3 + ratio * 3
                : isHovered
                    ? 2 + ratio * 2
                    : 1.5 + ratio * 1.5

            ctx.beginPath()
            ctx.moveTo(x1, y1)
            ctx.lineTo(x2, y2)
            ctx.strokeStyle = `hsla(${freqHue}, 85%, ${isSelected ? 70 : 55}%, ${alpha})`
            ctx.lineWidth = lw
            ctx.lineCap = 'round'
            ctx.stroke()

            // Glow tip
            if (ratio > 0.5 && !dimmed) {
                ctx.beginPath()
                ctx.arc(x2, y2, isSelected ? 3 + ratio * 4 : 1.5 + ratio * 2, 0, Math.PI * 2)
                ctx.fillStyle = `hsla(${freqHue}, 100%, 80%, ${ratio * (isSelected ? 1 : 0.6)})`
                if (isSelected) {
                    ctx.shadowColor = `hsl(${freqHue}, 100%, 70%)`
                    ctx.shadowBlur = 8
                }
                ctx.fill()
                ctx.shadowBlur = 0
            }
        }

        // Centre glow
        const bassAvg = Array.from(data.slice(0, 8)).reduce((a, b) => a + b, 0) / 8
        const bassRatio = bassAvg / 255
        const glowRadius = innerRadius * (0.7 + bassRatio * 0.6)

        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius)
        grd.addColorStop(0, `hsla(${hue}, 90%, 65%, ${0.2 + bassRatio * 0.35})`)
        grd.addColorStop(1, `hsla(${hue}, 80%, 60%, 0)`)
        ctx.beginPath()
        ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2)
        ctx.fillStyle = grd
        ctx.fill()

        // Selected band label in centre
        if (selected !== null) {
            ctx.fillStyle = `hsla(${hue}, 80%, 70%, 0.9)`
            ctx.font = `600 11px monospace`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(getBandLabel(selected, bins), cx, cy)
        }
    }, [])

    const { start, stop } = useAudioAnalyser({ onFrequencyData: draw })

    useEffect(() => {
        start()
        return () => stop()
    }, [start, stop])

    const getClickedBin = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current
        if (!canvas) return null
        const rect = canvas.getBoundingClientRect()
        const x = e.clientX - rect.left - canvas.width / 2
        const y = e.clientY - rect.top - canvas.height / 2
        const dist = Math.sqrt(x * x + y * y)
        const innerRadius = canvas.width * 0.18

        if (dist < innerRadius * 0.7) return null // centre click — deselect

        let angle = Math.atan2(y, x) + Math.PI / 2
        if (angle < 0) angle += Math.PI * 2

        const bins = 64 // half of 128
        const bin = Math.floor((angle / (Math.PI * 2)) * bins)
        return bin
    }, [])

    const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const bin = getClickedBin(e)
        if (bin === null) {
            selectedBandRef.current = null
            setSelectedBand(null)
            setTooltip(null)
            return
        }
        if (selectedBandRef.current === bin) {
            selectedBandRef.current = null
            setSelectedBand(null)
        } else {
            selectedBandRef.current = bin
            setSelectedBand(bin)
        }
    }, [getClickedBin])

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current
        if (!canvas) return
        const bin = getClickedBin(e)
        hoveredBandRef.current = bin
        if (bin !== null) {
            const rect = canvas.getBoundingClientRect()
            setTooltip({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top - 24,
                label: getBandLabel(bin, 64),
            })
        } else {
            setTooltip(null)
        }
    }, [getClickedBin])

    const handleMouseLeave = useCallback(() => {
        hoveredBandRef.current = null
        setTooltip(null)
    }, [])

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <canvas
                ref={canvasRef}
                width={size}
                height={size}
                onClick={handleClick}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                style={{ display: 'block', cursor: 'crosshair' }}
                title="Click a frequency band to isolate it"
            />
            {tooltip && (
                <div style={{
                    position: 'absolute',
                    left: tooltip.x,
                    top: tooltip.y,
                    transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.75)',
                    color: accentColour,
                    fontFamily: 'monospace',
                    fontSize: '0.6rem',
                    letterSpacing: '0.08em',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '3px',
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                    border: `1px solid ${accentColour}44`,
                    transition: 'color 0.5s',
                }}>
                    {tooltip.label}
                </div>
            )}
            {selectedBand !== null && (
                <div style={{
                    position: 'absolute',
                    bottom: 4,
                    left: 0,
                    right: 0,
                    textAlign: 'center',
                    fontSize: '0.55rem',
                    color: accentColour,
                    opacity: 0.6,
                    fontFamily: 'monospace',
                    letterSpacing: '0.1em',
                    pointerEvents: 'none',
                }}>
                    click centre to deselect
                </div>
            )}
        </div>
    )
}