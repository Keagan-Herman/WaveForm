import { useState, useEffect, useRef } from 'react'
import type { ButterchurnHandle } from './ButterchurnVisualiser'

const CYCLE_MS = 20000

interface PresetInfoStripProps {
  presetName: string
  butterchurnRef: React.RefObject<ButterchurnHandle>
  accentHex: string
}

export function PresetInfoStrip({ presetName, butterchurnRef, accentHex }: PresetInfoStripProps) {
  const [visible, setVisible] = useState(true)
  const [progress, setProgress] = useState(0)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTimeRef = useRef(Date.now())
  const rafRef = useRef<number>()

  // Reset cycle timer whenever the preset name changes
  useEffect(() => {
    startTimeRef.current = Date.now()
  }, [presetName])

  // Animate progress bar
  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current
      setProgress(Math.min(1, elapsed / CYCLE_MS))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const handleMouseMove = () => {
    setVisible(true)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => setVisible(false), 3000)
  }

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    hideTimerRef.current = setTimeout(() => setVisible(false), 3000)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const displayName = presetName.length > 48 ? presetName.slice(0, 47) + '…' : presetName

  return (
    <div style={{ ...styles.strip, opacity: visible ? 1 : 0.15 }}>
      <div style={styles.timerTrack}>
        <div
          style={{
            ...styles.timerFill,
            width: `${progress * 100}%`,
            background: accentHex,
          }}
        />
      </div>

      <div style={styles.row}>
        <button
          style={{ ...styles.chevronBtn, borderColor: `${accentHex}44`, color: accentHex }}
          onClick={() => butterchurnRef.current?.prevPreset()}
          aria-label="Previous preset"
        >
          ‹
        </button>

        <div style={styles.info}>
          <div style={styles.label}>MILKDROP PRESET</div>
          <div style={{ ...styles.presetName, color: accentHex }}>{displayName}</div>
        </div>

        <button
          style={{ ...styles.chevronBtn, borderColor: `${accentHex}44`, color: accentHex }}
          onClick={() => butterchurnRef.current?.nextPreset()}
          aria-label="Next preset"
        >
          ›
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  strip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    transition: 'opacity 0.6s ease',
    pointerEvents: 'auto',
    fontFamily: 'monospace',
    zIndex: 5,
  },
  timerTrack: {
    height: 2,
    background: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  timerFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    transition: 'width 0.1s linear',
    opacity: 0.7,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '0.75rem 1.5rem',
    background: 'rgba(0,0,0,0.45)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
  },
  chevronBtn: {
    background: 'transparent',
    border: '1px solid',
    borderRadius: 4,
    fontSize: '1.25rem',
    lineHeight: 1,
    width: 36,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    fontFamily: 'monospace',
  },
  info: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
  },
  label: {
    fontSize: '0.6rem',
    letterSpacing: '0.25em',
    opacity: 0.4,
    textTransform: 'uppercase',
    color: '#fff',
  },
  presetName: {
    fontSize: '0.8rem',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
}
