import { useEffect, useRef } from 'react'
import { useVisualiserStore, type VisualLayer } from '@/stores/visualiserStore'

const SCENE_CONFIGS: Record<VisualLayer, Record<string, number>> = {
  Ambient: {
    orb: 0,
    terrain: 1,
    particles: 0.5,
    presets: 0,
    albumGravity: 1,
  },
  Energy: {
    orb: 1,
    terrain: 0,
    particles: 1,
    presets: 0,
    albumGravity: 0,
  },
  Minimal: {
    orb: 0,
    terrain: 0,
    particles: 0.2,
    presets: 0,
    albumGravity: 0,
  },
  Presets: {
    orb: 0,
    terrain: 0,
    particles: 0,
    presets: 1,
    albumGravity: 0,
  },
}

export function useSceneManager() {
  const autoCycle = useVisualiserStore(state => state.autoCycle)
  const visualLayer = useVisualiserStore(state => state.visualLayer)
  const cycleVisualLayer = useVisualiserStore(state => state.cycleVisualLayer)
  const setLayerOpacity = useVisualiserStore(state => state.setLayerOpacity)

  const targetOpacities = useRef<Record<string, number>>(SCENE_CONFIGS[visualLayer])
  const currentOpacities = useRef<Record<string, number>>({ ...SCENE_CONFIGS[visualLayer] })

  // Auto-cycle logic
  useEffect(() => {
    if (!autoCycle) return

    const interval = setInterval(() => {
      cycleVisualLayer()
    }, 30000)

    return () => clearInterval(interval)
  }, [autoCycle, cycleVisualLayer])

  // Update targets when visualLayer changes
  useEffect(() => {
    targetOpacities.current = SCENE_CONFIGS[visualLayer]
  }, [visualLayer])

  // Smooth blending loop
  useEffect(() => {
    let frameId: number

    const update = () => {
      const lerpSpeed = 0.02
      const updates: Record<string, number> = {}
      let hasChanges = false

      Object.keys(targetOpacities.current).forEach(key => {
        const target = targetOpacities.current[key]
        const current = currentOpacities.current[key]
        const diff = target - current

        if (Math.abs(diff) > 0.001) {
          currentOpacities.current[key] += diff * lerpSpeed
          updates[key] = currentOpacities.current[key]
          hasChanges = true
        }
      })

      if (hasChanges) {
        // Single Zustand update for all opacity changes this frame
        Object.entries(updates).forEach(([key, val]) => setLayerOpacity(key, val))
      }

      frameId = requestAnimationFrame(update)
    }

    update()
    return () => cancelAnimationFrame(frameId)
  }, [setLayerOpacity])
}
