import { useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
// @ts-expect-error - three-stdlib type resolution issue in this environment
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

/**
 * SceneController Logic:
 * - Provides OrbitControls for immersive navigation (zoom, rotate).
 * - Implements a "return to auto-pilot" feature that slowly restarts rotation
 *   after user interaction ceases.
 * - Uses high damping for a premium, heavy-weight cinematic feel.
 */
export function SceneController() {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const lastInteractionTime = useRef(0)
  const isInteractingRef = useRef(false)
  const { camera } = useThree()

  useEffect(() => {
    // Initial camera placement for better perspective
    camera.position.set(0, 5, 15)
    camera.lookAt(0, 0, 0)
  }, [camera])

  useFrame((state) => {
    if (!controlsRef.current) return

    const time = state.clock.elapsedTime

    if (isInteractingRef.current) {
      lastInteractionTime.current = time
    }

    // Auto-pilot logic: if no interaction for 5 seconds, slowly resume auto-rotation
    const idleTime = time - lastInteractionTime.current
    if (idleTime > 5) {
      const autoRotateSpeed = Math.min((idleTime - 5) * 0.05, 0.5)
      controlsRef.current.autoRotate = true
      controlsRef.current.autoRotateSpeed = autoRotateSpeed
    } else {
      controlsRef.current.autoRotate = false
    }

    controlsRef.current.update()
  })

  return (
    <OrbitControls
      ref={controlsRef}
      onStart={() => {
        isInteractingRef.current = true
      }}
      onEnd={() => {
        isInteractingRef.current = false
      }}
      enableDamping
      dampingFactor={0.05}
      rotateSpeed={0.5}
      zoomSpeed={0.8}
      minDistance={5}
      maxDistance={40}
      makeDefault
    />
  )
}
