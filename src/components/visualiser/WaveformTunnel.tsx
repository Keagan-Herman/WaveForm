import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useVisualiserStore } from '@/stores/visualiserStore'
import { audioEngine } from '@/audio/AudioEngine'
import type { AlbumColour } from '@/hooks/useAlbumColour'

interface WaveformTunnelProps {
  accent: AlbumColour
}

export function WaveformTunnel({ accent }: WaveformTunnelProps) {
  const groupRef = useRef<THREE.Group>(null)
  const ringCount = 40
  const segmentCount = 64
  const tunnelRadius = 5
  const tunnelLength = 40

  const rings = useMemo(() => {
    return Array.from({ length: ringCount }).map((_, i) => ({
      z: -i * (tunnelLength / ringCount),
      id: i
    }))
  }, [])

  const geometry = useMemo(() => new THREE.RingGeometry(tunnelRadius, tunnelRadius + 0.1, segmentCount), [])

  useFrame((state) => {
    if (!groupRef.current) return
    const { bassPower } = useVisualiserStore.getState()
    const freqData = audioEngine.getFrequencyData()
    const time = state.clock.elapsedTime

    groupRef.current.children.forEach((child, i) => {
      const ring = child as THREE.Mesh
      const material = ring.material as THREE.MeshBasicMaterial

      // Move rings towards camera
      ring.position.z += 0.1 + bassPower * 0.2
      if (ring.position.z > 5) {
        ring.position.z = -tunnelLength + 5
      }

      // React to audio
      const intensity = freqData[i % freqData.length] / 255
      const scale = 1 + intensity * 0.5 * (1 + bassPower)
      ring.scale.set(scale, scale, 1)

      material.color.set(accent.hex)
      material.opacity = Math.max(0.1, intensity * 0.8)

      // Twist
      ring.rotation.z = time * 0.2 + i * 0.1
    })
  })

  return (
    <group ref={groupRef}>
      {rings.map((ring) => (
        <mesh key={ring.id} position={[0, 0, ring.z]} geometry={geometry}>
          <meshBasicMaterial
            transparent
            side={THREE.DoubleSide}
            color={accent.hex}
            opacity={0.5}
          />
        </mesh>
      ))}
    </group>
  )
}
