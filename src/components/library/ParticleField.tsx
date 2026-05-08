import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useVisualiserStore } from '@/stores/visualiserStore'

export function ParticleField({ count = 500, color = '#ffffff' }) {
  const pointsRef = useRef<THREE.Points>(null)
  const { isLowQuality } = useVisualiserStore.getState()
  const actualCount = isLowQuality ? count / 2 : count

  const [positions, velocities, colors] = useMemo(() => {
    const pos = new Float32Array(actualCount * 3)
    const vel = new Float32Array(actualCount * 3)
    const col = new Float32Array(actualCount * 3)
    const baseColor = new THREE.Color(color)

    for (let i = 0; i < actualCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10

      vel[i * 3] = (Math.random() - 0.5) * 0.02
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.02
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.02

      col[i * 3] = baseColor.r
      col[i * 3 + 1] = baseColor.g
      col[i * 3 + 2] = baseColor.b
    }
    return [pos, vel, col]
  }, [actualCount, color])

  useFrame(() => {
    if (!pointsRef.current) return
    const { beat, bassPower, beatConfidence } = useVisualiserStore.getState()
    const points = pointsRef.current
    const positions = points.geometry.attributes.position.array as Float32Array

    for (let i = 0; i < actualCount; i++) {
      const idx = i * 3

      // Update position based on velocity
      positions[idx] += velocities[idx]
      positions[idx + 1] += velocities[idx + 1]
      positions[idx + 2] += velocities[idx + 2]

      // Bounce/Wrap
      if (Math.abs(positions[idx]) > 10) velocities[idx] *= -1
      if (Math.abs(positions[idx + 1]) > 5) velocities[idx + 1] *= -1
      if (Math.abs(positions[idx + 2]) > 5) velocities[idx + 2] *= -1

      // React to beat
      if (beat) {
        const force = 0.05 * beatConfidence
        positions[idx] += (Math.random() - 0.5) * force
        positions[idx + 1] += (Math.random() - 0.5) * force
        positions[idx + 2] += (Math.random() - 0.5) * force
      }
    }
    points.geometry.attributes.position.needsUpdate = true

    // Scale points based on audio
    points.scale.setScalar(1 + bassPower * 0.2)
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
        size={0.05}
        vertexColors
        transparent
        opacity={0.6}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
