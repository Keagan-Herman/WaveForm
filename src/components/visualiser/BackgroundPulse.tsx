/**
 * BackgroundPulse.tsx
 *
 * Full-screen background element that subtly shifts colour and brightness
 * in response to bass power. Driven by the visualiserStore — reads the
 * pre-computed bassPower float (0–1) rather than raw frequency data.
 *
 * Uses CSS transitions rather than canvas — this is a slow, ambient
 * reaction (not frame-accurate), so React state is fine here.
 * The store update rate is 60fps but the visual change is subtle enough
 * that React's batching handles it without jank.
 *
 * Position: fixed, behind everything (z-index: -1).
 * Place this as a direct child of your root layout.
 */

import { useVisualiserStore } from '@/stores/visualiserStore'

interface BackgroundPulseProps {
  /** Base hue in degrees (default: 120 = green, matching Spotify) */
  baseHue?: number
  /** How much the hue shifts on a beat (default: 15 degrees) */
  hueShift?: number
}

export function BackgroundPulse({
  baseHue = 120,
  hueShift = 15,
}: BackgroundPulseProps) {
  const bassPower = useVisualiserStore(state => state.bassPower)
  const beat = useVisualiserStore(state => state.beat)

  // Bass power drives brightness — quiet = very dark, loud = slightly less dark
  const brightness = 3 + bassPower * 8   // 3% → 11% lightness
  const saturation = 20 + bassPower * 40  // 20% → 60% saturation
  const hue = beat ? baseHue + hueShift : baseHue

  // Radial gradient: the "bloom" effect — brightest at centre, fades to black
  const gradient = `radial-gradient(
    ellipse 80% 60% at 50% 50%,
    hsl(${hue}, ${saturation}%, ${brightness}%) 0%,
    hsl(${hue}, 10%, 2%) 100%
  )`

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        background: gradient,
        transition: beat
          ? 'background 0.05s ease-out'   // snap fast on beat
          : 'background 0.3s ease-out',   // decay slowly
        pointerEvents: 'none',
      }}
    />
  )
}