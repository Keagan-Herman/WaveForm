import { useRef, useEffect } from 'react'
import { useVisualiserStore } from '@/stores/visualiserStore'
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser'
import type { AlbumColour } from '@/hooks/useAlbumColour'

interface BackgroundPulseProps {
  accent: AlbumColour
}

export function BackgroundPulse({ accent }: BackgroundPulseProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const patternRef = useRef<HTMLDivElement>(null)
  const accentRef = useRef(accent)

  useEffect(() => {
    accentRef.current = accent
  }, [accent])

  const updatePulse = () => {
    const el = containerRef.current
    const p = patternRef.current
    if (!el || !p) return

    const { bassPower, beat } = useVisualiserStore.getState()
    const { h } = accentRef.current

    // Subtle Japanese/Rams background: Deep base with a very faint, slow organic pulse
    // and a reactive "glow" only on beat.
    el.style.backgroundColor = `hsla(${h}, 10%, 4%, 1)`

    // Klimt-inspired reactive pattern opacity
    p.style.opacity = (0.02 + bassPower * 0.08).toString()

    if (beat) {
      el.style.boxShadow = `inset 0 0 ${20 + bassPower * 100}px hsla(${h}, 50%, 40%, ${0.05 + bassPower * 0.1})`
    } else {
      el.style.boxShadow = 'none'
    }
  }

  const { start, stop } = useAudioAnalyser({
    onFrequencyData: updatePulse,
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
        transition: 'background-color 1s ease, box-shadow 0.2s ease',
      }}
    >
      {/* Subtle Klimt-inspired geometric pattern (Gold/Metallic feel) */}
      <div
        ref={patternRef}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            radial-gradient(circle at 2px 2px, var(--accent-color) 1px, transparent 0),
            linear-gradient(45deg, transparent 48%, var(--accent-color) 50%, transparent 52%),
            linear-gradient(-45deg, transparent 48%, var(--accent-color) 50%, transparent 52%)
          `,
          backgroundSize: '40px 40px, 120px 120px, 120px 120px',
          opacity: 0.03,
          mixBlendMode: 'overlay',
        }}
      />

      {/* Noise texture for paper/plastic feel */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--noise-filter)',
          opacity: 0.05,
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
