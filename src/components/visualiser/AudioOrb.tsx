import { useRef, forwardRef, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useVisualiserStore } from '@/stores/visualiserStore'
import type { AlbumColour } from '@/hooks/useAlbumColour'

// Configuration constants
const CONFIG = {
  GEOMETRY: {
    CORE_RADIUS: 0.8,
    POINTS_RADIUS: 1.5,
  },
  ANIMATION: {
    BASS_SMOOTHING: 0.12,
    ROTATION_SMOOTHING: 0.1,
    BASE_ROT_Y: 0.004,
    BASE_ROT_Z: 0.002,
    BASS_ROT_Y_MULT: 0.008,
    BASS_ROT_Z_MULT: 0.006,
  }
}

export const AudioOrb = forwardRef<THREE.Mesh, { accent: AlbumColour }>(({ accent }, ref) => {
  const meshRef = useRef<THREE.Group>(null)
  const coreRef = useRef<THREE.Mesh>(null)
  const pointsMatRef = useRef<THREE.PointsMaterial>(null)

  const combinedRef = useCallback((node: THREE.Mesh | null) => {
    if (coreRef.current !== node) {
      (coreRef as React.MutableRefObject<THREE.Mesh | null>).current = node;
    }
    if (ref) {
      if (typeof ref === 'function') ref(node);
      else (ref as React.MutableRefObject<THREE.Mesh | null>).current = node;
    }
  }, [ref]);
  const orbOpacity = useVisualiserStore(state => state.orbOpacity)

  const smoothedBass = useRef(0)
  const smoothedRotation = useRef({ y: 0, z: 0 })

  useFrame(() => {
    const { bassPower } = useVisualiserStore.getState()

    // Inertia for bass reactivity
    smoothedBass.current += (bassPower - smoothedBass.current) * CONFIG.ANIMATION.BASS_SMOOTHING

    if (meshRef.current) {
      // Rotation with inertia
      const targetRotY = CONFIG.ANIMATION.BASE_ROT_Y + smoothedBass.current * CONFIG.ANIMATION.BASS_ROT_Y_MULT
      const targetRotZ = CONFIG.ANIMATION.BASE_ROT_Z + smoothedBass.current * CONFIG.ANIMATION.BASS_ROT_Z_MULT

      smoothedRotation.current.y += (targetRotY - smoothedRotation.current.y) * CONFIG.ANIMATION.ROTATION_SMOOTHING
      smoothedRotation.current.z += (targetRotZ - smoothedRotation.current.z) * CONFIG.ANIMATION.ROTATION_SMOOTHING

      meshRef.current.rotation.y += smoothedRotation.current.y
      meshRef.current.rotation.z += smoothedRotation.current.z
    }

    if (coreRef.current) {
      const s = 1.0 + smoothedBass.current * 0.5
      coreRef.current.scale.set(s, s, s)
    }

    if (pointsMatRef.current) {
      pointsMatRef.current.opacity = orbOpacity * smoothedBass.current * 0.3
    }
  })

  return (
    <group ref={meshRef}>
      {/* Inner Core - Now the main sun source */}
      <mesh ref={combinedRef}>
        <sphereGeometry args={[CONFIG.GEOMETRY.CORE_RADIUS, 32, 32]} />
        <meshBasicMaterial
          color={accent.palette.accent}
          transparent
          opacity={orbOpacity * 0.4}
        />
      </mesh>

      {/* Volumetric light rays (simulated with points) */}
      <points>
        <sphereGeometry args={[CONFIG.GEOMETRY.POINTS_RADIUS, 64, 64]} />
        <pointsMaterial
          ref={pointsMatRef}
          color={accent.palette.accent}
          size={0.05}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  )
})
