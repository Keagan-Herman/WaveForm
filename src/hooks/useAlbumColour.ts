/**
 * useAlbumColour.ts — v4
 *
 * Root causes fixed:
 * 1. Canvas was reused across tracks — stale pixel data could contaminate results
 *    Fix: create a fresh canvas and fresh Image object on every imageUrl change
 *
 * 2. getImageData was called without willReadFrequently
 *    Fix: pass { willReadFrequently: true } to getContext
 *
 * 3. The hue bucket approach gave every pixel a minimum vote weight of 0.05,
 *    meaning even unsaturated pixels shifted the dominant hue toward 0° (red).
 *    On a white+blue+red image like Panchiko, near-white pixels were voting for
 *    red/yellow and overwhelming the actual blue.
 *    Fix: unsaturated pixels (s < 15) contribute zero to hue buckets entirely.
 *    They still count toward brightness/saturation averages.
 *
 * 4. The greyscale threshold (avgSaturation < 8) was too tight — images with
 *    small colour accents on white were passing through as "colourful" with
 *    nonsense dominant hues.
 *    Fix: raised to < 15, and added a "mostly white with small accent" branch.
 *
 * DEBUG: set DEBUG_LOG = true to see extraction values in the console.
 */

import { useState, useEffect } from 'react'
import tinycolor from 'tinycolor2'

export interface AlbumColour {
  h: number
  s: number
  l: number
  hex: string
  palette: {
    background: string
    surface: string
    primary: string
    secondary: string
    accent: string
    text: string
    textDim: string
    border: string
  }
}

const DEBUG_LOG = true

// Neutral blue-grey — only used on network/load error
const ERROR_HEX = '#7082a0'
const ERROR_COLOUR: AlbumColour = generatePaletteFromHex(ERROR_HEX, 220, 15, 52)

function generatePaletteFromHex(hex: string, h: number, s: number, l: number): AlbumColour {
  // Create a dark, moody background based on the dominant color
  // We want it very dark, but slightly tinted.
  // FIX: For white/light albums, darkening by a fixed % still leaves it too bright.
  // We now force a maximum lightness for background and surface.
  const bg = tinycolor(hex).desaturate(50).toHsl()
  bg.l = Math.min(bg.l, 0.08) // Max 8% lightness
  const background = tinycolor(bg).toHexString()

  const surf = tinycolor(hex).desaturate(40).toHsl()
  surf.l = Math.min(surf.l, 0.12) // Max 12% lightness
  const surface = tinycolor(surf).toHexString()

  // Primary is the dominant color itself
  const primary = hex

  // Secondary is a shifted hue or a lighter version
  const secondary = tinycolor(hex).spin(30).lighten(10).toHexString()

  // Accent is a high-contrast complementary or split-complementary
  const accent = tinycolor(hex).complement().lighten(20).toHexString()

  // Text should always be readable
  const text = l > 70 ? '#111111' : '#f0f0f0'
  const textDim = l > 70 ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)'

  const border = tinycolor(hex).darken(20).setAlpha(0.2).toRgbString()

  return {
    h, s, l, hex,
    palette: {
      background,
      surface,
      primary,
      secondary,
      accent,
      text,
      textDim,
      border,
    }
  }
}

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
  const [colour, setColour] = useState<AlbumColour>(ERROR_COLOUR)

  useEffect(() => {
    if (!imageUrl) {
      setColour(ERROR_COLOUR)
      return
    }

    // Fresh canvas and image every time — no stale data from previous track
    const canvas = document.createElement('canvas')
    // willReadFrequently tells the browser to optimise this canvas for pixel reads
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      const SIZE = 48
      canvas.width = SIZE
      canvas.height = SIZE
      ctx.drawImage(img, 0, 0, SIZE, SIZE)

      let data: Uint8ClampedArray
      try {
        data = ctx.getImageData(0, 0, SIZE, SIZE).data
      } catch {
        // CORS block — shouldn't happen with crossOrigin='anonymous' but guard anyway
        setColour(ERROR_COLOUR)
        return
      }

      // 36 hue buckets (10° each)
      const hueBuckets = new Float32Array(36)
      let totalBrightness = 0
      let totalSaturation = 0
      let pixelCount = 0

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2]
        const { h, s, l } = rgbToHsl(r, g, b)

        totalBrightness += l   // use HSL lightness (0-100), not raw brightness
        totalSaturation += s
        pixelCount++

        // KEY FIX: only saturated pixels vote on hue
        // Unsaturated pixels (white, grey, black) have no meaningful hue
        // and were previously polluting the dominant hue with noise
        if (s >= 15) {
          // Brighter, more saturated pixels vote harder
          const weight = (s / 100) * (0.3 + l / 100)
          const bucket = Math.floor(h / 10) % 36
          hueBuckets[bucket] += weight
        }
      }

      const avgLightness = totalBrightness / pixelCount    // 0–100
      const avgSaturation = totalSaturation / pixelCount   // 0–100
      const totalHueVotes = hueBuckets.reduce((a, b) => a + b, 0)

      // Find dominant hue bucket
      let maxVotes = 0
      let winningBucket = 0
      for (let i = 0; i < 36; i++) {
        if (hueBuckets[i] > maxVotes) {
          maxVotes = hueBuckets[i]
          winningBucket = i
        }
      }
      const dominantHue = winningBucket * 10
      // Confidence: how dominant is the winning hue vs all hue votes?
      const hueConfidence = totalHueVotes > 0 ? maxVotes / totalHueVotes : 0

      if (DEBUG_LOG) {
        console.log('[AlbumColour]', {
          imageUrl: imageUrl.slice(-40),
          avgLightness: avgLightness.toFixed(1),
          avgSaturation: avgSaturation.toFixed(1),
          dominantHue,
          hueConfidence: hueConfidence.toFixed(2),
        })
      }

      let finalH: number, finalS: number, finalL: number

      // Branch on image character
      if (avgSaturation < 15 || hueConfidence < 0.12) {
        // Greyscale or very low colour — no reliable hue, theme on brightness
        if (avgLightness > 65) {
          // White / light album
          finalH = 220; finalS = 12; finalL = 75
        } else if (avgLightness > 35) {
          // Grey album
          finalH = 220; finalS = 14; finalL = 52
        } else {
          // Black album
          finalH = 220; finalS = 18; finalL = 38
        }

      } else if (avgLightness > 70 && avgSaturation < 30) {
        // Mostly white/light with small colour accents (e.g. Panchiko)
        // Use the dominant hue but render it as a light, visible pastel
        finalH = dominantHue
        finalS = Math.max(35, avgSaturation * 2.5)
        finalL = 68

      } else if (avgLightness > 70) {
        // Bright, saturated image
        finalH = dominantHue
        finalS = Math.min(100, avgSaturation * 1.1)
        finalL = 58

      } else if (avgLightness < 25) {
        // Very dark / black album with colour
        finalH = dominantHue
        finalS = Math.max(55, avgSaturation * 1.6)
        finalL = 50

      } else {
        // Normal colourful album
        finalH = dominantHue
        finalS = Math.min(100, avgSaturation * 1.25)
        finalL = Math.max(42, Math.min(60, avgLightness * 0.8))
      }

      const hex = hslToHex(finalH, finalS, finalL)
      const result = generatePaletteFromHex(hex, finalH, finalS, finalL)

      if (DEBUG_LOG) {
        console.log('[AlbumColour] result →', result)
      }

      setColour(result)
    }

    img.onerror = () => setColour(ERROR_COLOUR)

    // Set src after handlers are attached
    img.src = imageUrl
  }, [imageUrl])

  return colour
}