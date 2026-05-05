/**
 * useAlbumColour.ts — fixed
 *
 * Previous version skipped pixels with brightness > 220, meaning white
 * albums returned the default green. This version samples ALL pixels
 * and uses a weighted approach — saturated pixels contribute more but
 * bright/white/dark pixels still count.
 *
 * Strategy:
 * 1. Sample every pixel
 * 2. Group into hue buckets to find the dominant hue
 * 3. If the image is predominantly bright (white album), return a
 *    light-toned version of the dominant hue — or near-white if truly grey
 * 4. If predominantly dark, return a vivid version of the dominant hue
 */

import { useState, useEffect, useRef } from 'react'

export interface AlbumColour {
  h: number
  s: number
  l: number
  hex: string
}

const DEFAULT_COLOUR: AlbumColour = { h: 120, s: 70, l: 45, hex: '#1db954' }

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
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
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
  const [colour, setColour] = useState<AlbumColour>(DEFAULT_COLOUR)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!imageUrl) { setColour(DEFAULT_COLOUR); return }

    if (!canvasRef.current) canvasRef.current = document.createElement('canvas')
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = imageUrl

    img.onload = () => {
      const SIZE = 32
      canvas.width = SIZE
      canvas.height = SIZE
      ctx.drawImage(img, 0, 0, SIZE, SIZE)
      const data = ctx.getImageData(0, 0, SIZE, SIZE).data

      // Hue bucket voting — 36 buckets of 10 degrees each
      const hueBuckets = new Array(36).fill(0)
      let totalBrightness = 0
      let pixelCount = 0
      let totalSaturation = 0

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2]
        const brightness = (r + g + b) / 3
        totalBrightness += brightness
        pixelCount++

        const { h, s } = rgbToHsl(r, g, b)
        totalSaturation += s

        // All pixels vote, but saturated ones vote harder
        const weight = 0.1 + (s / 100) * 2.0
        const bucket = Math.floor(h / 10) % 36
        hueBuckets[bucket] += weight
      }

      const avgBrightness = totalBrightness / pixelCount
      const avgSaturation = totalSaturation / pixelCount

      // Find winning hue bucket
      const maxVotes = Math.max(...hueBuckets)
      const winningBucket = hueBuckets.indexOf(maxVotes)
      const dominantHue = winningBucket * 10

      // Determine output based on overall image character
      let finalH = dominantHue
      let finalS = 0
      let finalL = 0

      if (avgSaturation < 12) {
        // Greyscale image — near-white or near-black depending on brightness
        finalH = dominantHue
        finalS = 15
        finalL = avgBrightness > 128 ? 75 : 30
      } else if (avgBrightness > 190) {
        // Bright/white-dominant album art — use light vivid accent
        finalH = dominantHue
        finalS = Math.max(50, avgSaturation * 1.2)
        finalL = 65
      } else if (avgBrightness < 50) {
        // Dark/black album art — use vivid mid-tone
        finalH = dominantHue
        finalS = Math.max(60, avgSaturation * 1.3)
        finalL = 50
      } else {
        // Normal colourful album — standard extraction
        finalH = dominantHue
        finalS = Math.min(100, avgSaturation * 1.4)
        finalL = Math.max(40, Math.min(60, avgBrightness / 255 * 80))
      }

      const hex = hslToHex(finalH, finalS, finalL)
      setColour({ h: finalH, s: finalS, l: finalL, hex })
    }

    img.onerror = () => setColour(DEFAULT_COLOUR)
  }, [imageUrl])

  return colour
}