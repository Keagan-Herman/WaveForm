/**
 * useReducedMotion.ts
 *
 * Returns true if the user has requested reduced motion via their OS settings.
 * Apply this in every animated component — disable or simplify animations
 * when true.
 *
 * Usage:
 *   const reduced = useReducedMotion()
 *   <motion.div animate={reduced ? {} : { scale: 1.2 }} />
 */

import { useState, useEffect } from 'react'

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return reduced
}