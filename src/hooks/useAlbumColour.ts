/**
 * useAlbumColour.ts — v3
 *
 * Core fix: the DEFAULT_COLOUR (green) is no longer the fallback for
 * low-saturation images. White/grey/black albums now return an
 * appropriate light or dark neutral theme instead of green.
 *
 * Strategy:
 * - Sample all pixels, find dominant hue via bucket voting
 * - Measure overall image brightness and saturation
 * - Branch into four character types: colourful, bright/white, dark/black, greyscale
 * - Each branch produces an appropriate accent — never defaults to green
 *   unless the image is actually green
 *
 * The only time green appears is when the dominant hue is genuinely green.
 */

import { useState, useEffect, useRef } from 'react'

export interface AlbumColour {
  h: number
  s: number
  l: number
  hex: string
}

// Neutral fallback — used only on load error, not on greyscale images
const LOAD_ERROR_COLOUR: AlbumColour = { h: 220, s: 15, l: 55, hex: '#7a8fa6' }

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
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
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * c).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

export function useAlbumColour(imageUrl: string | null): AlbumColour {
  const [colour, setColour] = useState<AlbumColour>(LOAD_ERROR_COLOUR)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!imageUrl) {
      setColour(LOAD_ERROR_COLOUR)
      return
    }

    if (!canvasRef.current) canvasRef.current = document.createElement('canvas')
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = imageUrl

    img.onload = () => {
      const SIZE = 40
      canvas.width = SIZE
      canvas.height = SIZE
      ctx.drawImage(img, 0, 0, SIZE, SIZE)
      const data = ctx.getImageData(0, 0, SIZE, SIZE).data

      // 36 hue buckets × 10 degrees each
      const hueBuckets = new Float32Array(36)
      let totalBrightness = 0
      let totalSaturation = 0
      let pixelCount = 0

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2]
        const brightness = (r + g + b) / 3
        const { h, s } = rgbToHsl(r, g, b)

        totalBrightness += brightness
        totalSaturation += s
        pixelCount++

        // All pixels vote — saturated pixels get a much louder vote
        const weight = 0.05 + (s / 100) * 3.0
        const bucket = Math.floor(h / 10) % 36
        hueBuckets[bucket] += weight
      }

      const avgBrightness = totalBrightness / pixelCount    // 0–255
      const avgSaturation = totalSaturation / pixelCount    // 0–100

      // Find dominant hue
      let maxVotes = 0
      let winningBucket = 0
      for (let i = 0; i < 36; i++) {
        if (hueBuckets[i] > maxVotes) {
          maxVotes = hueBuckets[i]
          winningBucket = i
        }
      }
      const dominantHue = winningBucket * 10

      let finalH: number, finalS: number, finalL: number

      if (avgSaturation < 8) {
        // Genuinely greyscale image (black, white, or grey album)
        if (avgBrightness > 160) {
          // White/light grey album — return a clean near-white
          finalH = 220  // slight cool tint
          finalS = 10
          finalL = 78
        } else if (avgBrightness > 80) {
          // Mid grey album
          finalH = 220
          finalS = 12
          finalL = 55
        } else {
          // Black album — return a subtle dark blue-grey
          finalH = 220
          finalS = 20
          finalL = 40
        }
      } else if (avgBrightness > 185 && avgSaturation < 25) {
        // Mostly white with some colour (like the Panchiko cover)
        // Use the dominant hue but keep it light
        finalH = dominantHue
        finalS = Math.max(30, avgSaturation * 2)
        finalL = 72
      } else if (avgBrightness > 185) {
        // Bright colourful image
        finalH = dominantHue
        finalS = Math.min(100, avgSaturation * 1.2)
        finalL = 60
      } else if (avgBrightness < 45) {
        // Very dark / black album
        finalH = dominantHue
        finalS = Math.max(50, avgSaturation * 1.5)
        finalL = 48
      } else {
        // Normal colourful album — standard path
        finalH = dominantHue
        finalS = Math.min(100, avgSaturation * 1.3)
        finalL = Math.max(42, Math.min(58, avgBrightness / 255 * 80))
      }

      const hex = hslToHex(finalH, finalS, finalL)
      setColour({ h: finalH, s: finalS, l: finalL, hex })
    }

    img.onerror = () => setColour(LOAD_ERROR_COLOUR)
  }, [imageUrl])

  return colour
}