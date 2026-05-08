import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useVisualiserStore } from '@/stores/visualiserStore'

export function CoreOrb({ color = '#ffffff' }) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (!meshRef.current) return
    const { bassPower } = useVisualiserStore.getState()
    const t = state.clock.elapsedTime

    const s = 1 + bassPower * 0.8
    meshRef.current.scale.set(s, s, s)
    meshRef.current.rotation.y = t * 0.5
    meshRef.current.rotation.x = t * 0.3
  })

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1, 15]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={2}
        wireframe
      />
      <pointLight color={color} intensity={2} distance={10} />
    </mesh>
  )
}
