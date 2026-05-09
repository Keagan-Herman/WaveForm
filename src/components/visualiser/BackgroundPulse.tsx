/**
 * BackgroundPulse.tsx — v4
 *
 * Fix: light albums with low saturation (white/grey covers) were still
 * producing a visible blue background because hue 220 at s=20% l=12%
 * reads as dark blue.
 *
 * For light, low-saturation albums: drop saturation to near-zero so
 * the hue is irrelevant and the background reads as neutral dark grey.
 * The lightness still pulses with bass — just without a colour cast.
 */

import { useRef, useEffect } from 'react'
import { useVisualiserStore } from '@/stores/visualiserStore'
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser'
import type { AlbumColour } from '@/hooks/useAlbumColour'

interface BackgroundPulseProps {
  accent: AlbumColour
}

/**
 * BackgroundPulse.tsx — Optimized
 *
 * Performance: Moved to imperative DOM updates.
 * Previously, this component subscribed to bassPower (60fps) via Zustand,
 * causing React to re-render the entire component every frame.
 * Now, it uses a ref and the useAudioAnalyser callback to update styles directly.
 */
export function BackgroundPulse({ accent }: BackgroundPulseProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const accentRef = useRef(accent)

  useEffect(() => {
    accentRef.current = accent
  }, [accent])

  const updatePulse = () => {
    const el = containerRef.current
    if (!el) return

    const { bassPower, beat } = useVisualiserStore.getState()
    const { h, s, l } = accentRef.current

    const isLight = l > 62
    const isDark = l < 30
    const isDesaturated = s < 20

    const hue = beat ? (h + 12) % 360 : h

    let centerL: number
    let centerS: number
    let edgeL: number
    let edgeS: number
    let floorL: number

    if (isLight && isDesaturated) {
      centerL = 10 + bassPower * 14
      centerS = 4 + bassPower * 8
      edgeL = 4 + bassPower * 4
      edgeS = 2
      floorL = 2
    } else if (isLight) {
      centerL = 14 + bassPower * 18
      centerS = s * 0.7 + bassPower * 25
      edgeL = 6 + bassPower * 8
      edgeS = s * 0.35
      floorL = 3
    } else if (isDark && isDesaturated) {
      centerL = 5 + bassPower * 10
      centerS = 4
      edgeL = 2 + bassPower * 3
      edgeS = 2
      floorL = 1
    } else if (isDark) {
      centerL = 6 + bassPower * 14
      centerS = Math.min(s * 1.4, 90) + bassPower * 20
      edgeL = 3 + bassPower * 5
      edgeS = s * 0.5
      floorL = 2
    } else if (isDesaturated) {
      centerL = 8 + bassPower * 12
      centerS = 5 + bassPower * 8
      edgeL = 3 + bassPower * 4
      edgeS = 3
      floorL = 2
    } else {
      centerL = 8 + bassPower * 16
      centerS = s * 0.8 + bassPower * 30
      edgeL = 4 + bassPower * 6
      edgeS = s * 0.4
      floorL = 3
    }

    const gradient = `radial-gradient(
      ellipse 90% 70% at 50% 50%,
      hsl(${hue}, ${Math.round(centerS)}%, ${Math.round(centerL)}%) 0%,
      hsl(${hue}, ${Math.round(edgeS)}%, ${Math.round(edgeL)}%) 55%,
      hsl(${hue}, 4%, ${floorL}%) 100%
    )`

    el.style.background = gradient
    el.style.transition = beat
      ? 'background 0.06s ease-out'
      : 'background 0.6s ease-out'
  }

  const { start, stop } = useAudioAnalyser({
    onFrequencyData: updatePulse
  })

  useEffect(() => {
    start()
    return () => stop()
  }, [start, stop])

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        pointerEvents: 'none',
      }}
    />
  )
}