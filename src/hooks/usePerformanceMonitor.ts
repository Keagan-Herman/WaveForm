import { useEffect, useRef, useState } from 'react'

/**
 * usePerformanceMonitor
 *
 * Tracks frame delta times to calculate a rolling average FPS.
 * Provides a callback when FPS falls below a threshold for a sustained period.
 */
export function usePerformanceMonitor(
  threshold = 55,
  sustainedMs = 3000,
  onDowngrade?: () => void
) {
  const frameTimes = useRef<number[]>([])
  const lastFrameTime = useRef<number>(performance.now())
  const [fps, setFps] = useState(60)
  const lowFpsStart = useRef<number | null>(null)

  useEffect(() => {
    let animFrameId: number

    const tick = () => {
      const now = performance.now()
      const delta = now - lastFrameTime.current
      lastFrameTime.current = now

      // Track last 60 frames
      frameTimes.current.push(delta)
      if (frameTimes.current.length > 60) {
        frameTimes.current.shift()
      }

      // Calculate average FPS
      const avgDelta = frameTimes.current.reduce((a, b) => a + b, 0) / frameTimes.current.length
      const currentFps = 1000 / avgDelta

      if (frameTimes.current.length === 60) {
        setFps(Math.round(currentFps))

        // Check if FPS is below threshold
        if (currentFps < threshold) {
          if (lowFpsStart.current === null) {
            lowFpsStart.current = now
          } else if (now - lowFpsStart.current > sustainedMs) {
            onDowngrade?.()
            lowFpsStart.current = null // Reset after trigger
            frameTimes.current = [] // Reset window
          }
        } else {
          lowFpsStart.current = null
        }
      }

      animFrameId = requestAnimationFrame(tick)
    }

    animFrameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animFrameId)
  }, [threshold, sustainedMs, onDowngrade])

  return fps
}
