/**
 * useAlbumColour.ts
 *
 * Extracts the dominant colour from the current track's album art
 * by drawing it to a hidden canvas and sampling pixels.
 *
 * No library needed — native canvas API handles this cleanly.
 * Returns an HSL object so consumers can derive variants easily.
 *
 * The colour is used to theme the entire app dynamically —
 * accent colour, background hue, visualiser colours all shift
 * to match the album art when something is playing.
 */

import { useState, useEffect, useRef } from 'react'

export interface AlbumColour {
    h: number   // 0–360
    s: number   // 0–100
    l: number   // 0–100
    hex: string
}

const DEFAULT_COLOUR: AlbumColour = { h: 120, s: 70, l: 45, hex: '#1db954' }

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255; g /= 255; b /= 255
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const l = (max + min) / 2
    let h = 0, s = 0

    if (max !== min) {
        const d = max - min
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
            case g: h = ((b - r) / d + 2) / 6; break
            case b: h = ((r - g) / d + 4) / 6; break
        }
    }

    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

function hslToHex(h: number, s: number, l: number): string {
    s /= 100; l /= 100
    const a = s * Math.min(l, 1 - l)
    const f = (n: number) => {
        const k = (n + h / 30) % 12
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
        return Math.round(255 * color).toString(16).padStart(2, '0')
    }
    return `#${f(0)}${f(8)}${f(4)}`
}

export function useAlbumColour(imageUrl: string | null): AlbumColour {
    const [colour, setColour] = useState<AlbumColour>(DEFAULT_COLOUR)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)

    useEffect(() => {
        if (!imageUrl) {
            setColour(DEFAULT_COLOUR)
            return
        }

        if (!canvasRef.current) {
            canvasRef.current = document.createElement('canvas')
        }

        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = imageUrl

        img.onload = () => {
            // Sample at small size for performance
            const SIZE = 20
            canvas.width = SIZE
            canvas.height = SIZE
            ctx.drawImage(img, 0, 0, SIZE, SIZE)

            const data = ctx.getImageData(0, 0, SIZE, SIZE).data

            // Accumulate RGB values, skip near-black and near-white pixels
            let rSum = 0, gSum = 0, bSum = 0, count = 0

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i + 1], b = data[i + 2]
                const brightness = (r + g + b) / 3

                // Skip very dark or very light pixels — they're not interesting
                if (brightness < 30 || brightness > 220) continue

                // Weight more saturated pixels higher
                const max = Math.max(r, g, b)
                const min = Math.min(r, g, b)
                const saturation = max === 0 ? 0 : (max - min) / max
                if (saturation < 0.2) continue  // Skip near-grey pixels

                rSum += r; gSum += g; bSum += b; count++
            }

            if (count === 0) {
                setColour(DEFAULT_COLOUR)
                return
            }

            const r = Math.round(rSum / count)
            const g = Math.round(gSum / count)
            const b = Math.round(bSum / count)

            const { h, s, l } = rgbToHsl(r, g, b)

            // Boost saturation and normalise lightness for UI use
            const boostedS = Math.min(100, s * 1.3)
            const normalisedL = Math.max(35, Math.min(55, l))
            const hex = hslToHex(h, boostedS, normalisedL)

            setColour({ h, s: boostedS, l: normalisedL, hex })
        }

        img.onerror = () => setColour(DEFAULT_COLOUR)
    }, [imageUrl])

    return colour
}