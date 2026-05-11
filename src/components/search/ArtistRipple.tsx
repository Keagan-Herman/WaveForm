/**
 * ArtistRipple.tsx
 *
 * Wraps any element with a ripple effect that fires on hover.
 * Used in the now-playing section to add life to the artist name.
 *
 * The ripple is a set of concentric circles that scale out and fade.
 * Beat-aware: the ripple also fires on every detected beat when
 * the wrapped element is in an "active" state.
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useVisualiserStore } from '@/stores/visualiserStore'

interface RippleInstance {
  id: number
  x: number
  y: number
}

interface ArtistRippleProps {
  children: React.ReactNode
  active?: boolean // when true, ripple fires on beats too
  color?: string
  className?: string
}

export function ArtistRipple({
  children,
  active = false,
  color = '#1db954',
  className,
}: ArtistRippleProps) {
  const [ripples, setRipples] = useState<RippleInstance[]>([])
  const beat = useVisualiserStore(state => state.beat)

  const addRipple = useCallback((x: number, y: number) => {
    const id = Date.now() + Math.random()
    setRipples(prev => [...prev, { id, x, y }])
    // Remove after animation completes
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== id))
    }, 800)
  }, [])

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      addRipple(e.clientX - rect.left, e.clientY - rect.top)
    },
    [addRipple]
  )

  // Fire from centre on beat when active (playing)
  useEffect(() => {
    if (!active || !beat) return
    addRipple(50, 50) // centre of element — fine for beat-driven ripples
  }, [beat, active, addRipple])

  return (
    <div style={styles.wrap} className={className} onMouseEnter={handleMouseEnter}>
      {children}

      <AnimatePresence>
        {ripples.map(ripple => (
          <motion.span
            key={ripple.id}
            style={{
              ...styles.ripple,
              left: ripple.x,
              top: ripple.y,
              borderColor: color,
            }}
            initial={{ scale: 0, opacity: 0.6 }}
            animate={{ scale: 4, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'relative',
    overflow: 'hidden',
    display: 'inline-flex',
    alignItems: 'center',
  },
  ripple: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: '50%',
    border: '1px solid',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
  },
}
