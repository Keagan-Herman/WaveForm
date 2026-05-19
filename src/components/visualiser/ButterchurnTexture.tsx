import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface ButterchurnTextureProps {
  canvas: HTMLCanvasElement
  opacity?: number
}

export function ButterchurnTexture({ canvas, opacity = 1 }: ButterchurnTextureProps) {
  const textureRef = useRef<THREE.CanvasTexture | null>(null)
  const materialRef = useRef<THREE.MeshBasicMaterial>(null)

  useFrame(() => {
    if (textureRef.current) {
      textureRef.current.needsUpdate = true
    }
    if (materialRef.current) {
      materialRef.current.opacity = opacity
    }
  })

  return (
    <mesh position={[0, 0, -5]} scale={[25, 25, 1]}>
      <planeGeometry />
      <meshBasicMaterial
        ref={materialRef}
        transparent
        depthTest={false}
        opacity={opacity}
      >
        <canvasTexture
          ref={textureRef}
          attach="map"
          args={[canvas]}
          colorSpace={THREE.SRGBColorSpace}
        />
      </meshBasicMaterial>
    </mesh>
  )
}
