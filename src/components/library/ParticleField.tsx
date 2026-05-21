import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useVisualiserStore } from '@/stores/visualiserStore'

const CONFIG = {
  COUNTS: {
    Low: 800,
    Medium: 3000,
    Epic: 8000,
  },
  BOUNDS: {
    X: 20,
    Y: 10,
    Z: 10,
    LIMIT_X: 15,
    LIMIT_Y: 10,
    LIMIT_Z: 10,
  },
  PHYSICS: {
    INITIAL_VEL_MULT: 0.04,
    EXPLOSION_FORCE: 0.2,
    FRICTION: 0.98,
    DRIFT_FORCE: 0.001,
    WRAP_BOUNCE: -0.9,
  },
  VISUALS: {
    SIZE: 0.05,
    OPACITY_MULT: 0.6,
    FLASH_THRESHOLD: 0.8,
    COLOR_SMOOTHING: 0.1,
    BASS_SCALE_MULT: 0.1,
    BASS_ROT_MULT: 0.005,
  }
}

interface ParticleFieldProps {
  color?: string
  accent?: string
  secondary?: string
}

export function ParticleField({ color = '#ffffff', accent, secondary }: ParticleFieldProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const { quality } = useVisualiserStore.getState()

  const actualCount = useMemo(() => {
    return CONFIG.COUNTS[quality as keyof typeof CONFIG.COUNTS] || CONFIG.COUNTS.Medium
  }, [quality])

  const velocitiesRef = useRef<Float32Array | null>(null)
  const originalColorsRef = useRef<Float32Array | null>(null)

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(actualCount * 3)
    const vel = new Float32Array(actualCount * 3)
    const col = new Float32Array(actualCount * 3)

    const baseColor = new THREE.Color(color)
    const accentColor = accent ? new THREE.Color(accent) : baseColor
    const secondaryColor = secondary ? new THREE.Color(secondary) : baseColor

    /* eslint-disable react-hooks/purity */
    for (let i = 0; i < actualCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * CONFIG.BOUNDS.X
      pos[i * 3 + 1] = (Math.random() - 0.5) * CONFIG.BOUNDS.Y
      pos[i * 3 + 2] = (Math.random() - 0.5) * CONFIG.BOUNDS.Z

      vel[i * 3] = (Math.random() - 0.5) * CONFIG.PHYSICS.INITIAL_VEL_MULT
      vel[i * 3 + 1] = (Math.random() - 0.5) * CONFIG.PHYSICS.INITIAL_VEL_MULT
      vel[i * 3 + 2] = (Math.random() - 0.5) * CONFIG.PHYSICS.INITIAL_VEL_MULT

      // Distribute colors across the palette
      const r = Math.random()
      const targetCol = r > 0.7 ? accentColor : (r > 0.4 ? secondaryColor : baseColor)

      col[i * 3] = targetCol.r
      col[i * 3 + 1] = targetCol.g
      col[i * 3 + 2] = targetCol.b
    }
    /* eslint-enable react-hooks/purity */
    /* eslint-disable react-hooks/refs */
    velocitiesRef.current = vel
    originalColorsRef.current = new Float32Array(col)
    /* eslint-enable react-hooks/refs */
    return [pos, col]
  }, [actualCount, color, accent, secondary])

  useFrame((state) => {
    if (!pointsRef.current || !velocitiesRef.current) return
    const { beat, bassPower, beatConfidence } = useVisualiserStore.getState()
    const points = pointsRef.current
    const positionsAttr = points.geometry.attributes.position
    const colorsAttr = points.geometry.attributes.color
    const posArray = positionsAttr.array as Float32Array
    const colArray = colorsAttr.array as Float32Array
    const velocities = velocitiesRef.current
    const originalColors = originalColorsRef.current!

    const time = state.clock.elapsedTime

    for (let i = 0; i < actualCount; i++) {
      const idx = i * 3

      // Apply audio-driven forces to velocity
      if (beat) {
        const explosionForce = CONFIG.PHYSICS.EXPLOSION_FORCE * beatConfidence
        velocities[idx] += (Math.random() - 0.5) * explosionForce
        velocities[idx + 1] += (Math.random() - 0.5) * explosionForce
        velocities[idx + 2] += (Math.random() - 0.5) * explosionForce
      }

      // Air resistance / friction
      velocities[idx] *= CONFIG.PHYSICS.FRICTION
      velocities[idx + 1] *= CONFIG.PHYSICS.FRICTION
      velocities[idx + 2] *= CONFIG.PHYSICS.FRICTION

      // Gentle drift
      velocities[idx] += Math.sin(time + i) * CONFIG.PHYSICS.DRIFT_FORCE
      velocities[idx + 1] += Math.cos(time + i * 1.1) * CONFIG.PHYSICS.DRIFT_FORCE

      // Update position
      posArray[idx] += velocities[idx]
      posArray[idx + 1] += velocities[idx + 1]
      posArray[idx + 2] += velocities[idx + 2]

      // Wrapping instead of bouncing for "endless" feel
      if (Math.abs(posArray[idx]) > CONFIG.BOUNDS.LIMIT_X) posArray[idx] *= CONFIG.PHYSICS.WRAP_BOUNCE
      if (Math.abs(posArray[idx + 1]) > CONFIG.BOUNDS.LIMIT_Y) posArray[idx + 1] *= CONFIG.PHYSICS.WRAP_BOUNCE
      if (Math.abs(posArray[idx + 2]) > CONFIG.BOUNDS.LIMIT_Z) posArray[idx + 2] *= CONFIG.PHYSICS.WRAP_BOUNCE

      // Reactive colors
      if (beat && beatConfidence > CONFIG.VISUALS.FLASH_THRESHOLD) {
        // Flash bright on strong beats
        colArray[idx] = 1.0
        colArray[idx + 1] = 1.0
        colArray[idx + 2] = 1.0
      } else {
        // Smoothly return to original themed color
        colArray[idx] += (originalColors[idx] - colArray[idx]) * CONFIG.VISUALS.COLOR_SMOOTHING
        colArray[idx + 1] += (originalColors[idx + 1] - colArray[idx + 1]) * CONFIG.VISUALS.COLOR_SMOOTHING
        colArray[idx + 2] += (originalColors[idx + 2] - colArray[idx + 2]) * CONFIG.VISUALS.COLOR_SMOOTHING
      }
    }

    positionsAttr.needsUpdate = true
    colorsAttr.needsUpdate = true

    // Scale and rotate field based on audio
    points.scale.setScalar(1 + bassPower * CONFIG.VISUALS.BASS_SCALE_MULT)
    points.rotation.y += 0.001 + bassPower * CONFIG.VISUALS.BASS_ROT_MULT
  })

  const matRef = useRef<THREE.PointsMaterial>(null)
  useFrame(() => {
    if (matRef.current) {
      const { particlesOpacity } = useVisualiserStore.getState()
      matRef.current.opacity = particlesOpacity * CONFIG.VISUALS.OPACITY_MULT
    }
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={actualCount}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={actualCount}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        ref={matRef}
        size={CONFIG.VISUALS.SIZE}
        vertexColors
        transparent
        opacity={CONFIG.VISUALS.OPACITY_MULT}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
