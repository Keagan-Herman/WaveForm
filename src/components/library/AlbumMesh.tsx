/**
 * AlbumMesh.tsx
 *
 * A single floating album art card rendered as a textured plane in R3F.
 *
 * MOTION:
 * - Gentle sine-wave float on Y axis — each album has a unique phase offset
 *   so they don't all bob in sync (looks cheap if they do)
 * - Slow Y-axis rotation drift — adds depth without being distracting
 * - Beat pulse: scales up to 1.08 on beat, lerps back to 1.0 each frame
 *
 * TEXTURE:
 * useTexture from @react-three/drei handles loading and caching.
 * crossOrigin is handled by the Canvas renderer — Spotify CDN supports CORS.
 *
 * PERFORMANCE:
 * All motion is computed inside useFrame — no React state, no re-renders.
 * The beat boolean comes from visualiserStore via getState() to avoid
 * subscribing the R3F component to Zustand re-renders.
 */

import { useRef, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { useVisualiserStore } from '@/stores/visualiserStore'
import { usePlayerStore } from '@/stores/playerStore'

interface AlbumMeshProps {
  imageUrl: string
  albumId?: string
  position: [number, number, number]
  phaseOffset: number      // 0–2π, makes float timing unique per album
  rotationSpeed: number    // radians per second, small value (0.02–0.08)
  floatSpeed: number       // cycles per second (0.2–0.5)
  floatAmplitude: number   // world units (0.08–0.2)
  size: number             // card size in world units (0.8–1.4)
}

export function AlbumMesh({
  imageUrl,
  albumId,
  position,
  phaseOffset,
  rotationSpeed,
  floatSpeed,
  floatAmplitude,
  size,
}: AlbumMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const texture = useTexture(imageUrl)
  const [hovered, setHovered] = useState(false)
  const playTrackByAlbumId = usePlayerStore(state => state.playTrackByAlbumId)

  // Memoise geometry and material — don't recreate on every render
  const geometry = useMemo(() => new THREE.PlaneGeometry(size, size), [size])
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
      }),
    [texture]
  )

  useFrame(state => {
    const mesh = meshRef.current
    if (!mesh) return

    const t = state.clock.elapsedTime

    // Float: sine wave with unique phase so albums don't sync
    mesh.position.y =
      position[1] + Math.sin(t * floatSpeed * Math.PI * 2 + phaseOffset) * floatAmplitude

    // Slow drift rotation
    // Faster rotation on hover
    const currentRotSpeed = hovered ? rotationSpeed * 4 : rotationSpeed
    mesh.rotation.y += currentRotSpeed * 0.05
    mesh.rotation.x = Math.sin(t * rotationSpeed * 0.7 + phaseOffset) * 0.05

    // Beat pulse — read from store imperatively, not via subscription
    // This avoids Zustand re-renders propagating into the R3F tree
    const { beat } = useVisualiserStore.getState()

    const targetScale = hovered ? size * 1.2 : size

    if (beat) {
      // Snap up
      mesh.scale.setScalar(targetScale * 1.1)
    } else {
      // Lerp back to target
      const s = mesh.scale.x
      mesh.scale.setScalar(s + (targetScale - s) * 0.1)
    }

    // Material update for hover glow
    if (material instanceof THREE.MeshBasicMaterial) {
      material.opacity = hovered ? 1.0 : 0.92
    }
  })

  return (
    <mesh
      ref={meshRef}
      position={position}
      geometry={geometry}
      material={material}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={() => {
        if (albumId) playTrackByAlbumId(Number(albumId))
      }}
    />
  )
}