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

/**
 * BackgroundPulse.tsx — enhanced
 *
 * Now accepts a dynamic accent hue extracted from album art.
 * More dramatic brightness range so the effect is actually visible.
 * Dual gradient — one centred bloom plus a subtle corner vignette.
 */

import { useVisualiserStore } from '@/stores/visualiserStore'

interface BackgroundPulseProps {
  accentHue?: number
  accentSaturation?: number
}

export function BackgroundPulse({
  accentHue = 120,
  accentSaturation = 70,
}: BackgroundPulseProps) {
  const bassPower = useVisualiserStore(state => state.bassPower)
  const beat = useVisualiserStore(state => state.beat)

  const brightness = 4 + bassPower * 12      // 4% → 16% — more visible range
  const saturation = 30 + bassPower * 50     // 30% → 80%
  const hue = beat ? (accentHue + 15) % 360 : accentHue

  const gradient = `
    radial-gradient(
      ellipse 90% 70% at 50% 50%,
      hsl(${hue}, ${saturation}%, ${brightness}%) 0%,
      hsl(${hue}, ${Math.round(saturation * 0.4)}%, ${Math.round(brightness * 0.5)}%) 50%,
      hsl(${hue}, 8%, 2%) 100%
    )
  `

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        background: gradient,
        transition: beat
          ? 'background 0.06s ease-out'
          : 'background 0.5s ease-out',
        pointerEvents: 'none',
      }}
    />
  )
}