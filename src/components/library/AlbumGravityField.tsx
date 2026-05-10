/**
 * AlbumGravityField.tsx
 *
 * React Three Fiber scene — a field of floating album art cards.
 * Mounted as a Canvas overlay in the visualiser panel.
 *
 * RENDER LOOP STRATEGY:
 * This is the second render loop in the app (the first is the rAF canvas loop).
 * They coexist without conflict because:
 * - The rAF loop writes beat/bassPower to visualiserStore
 * - R3F reads from visualiserStore.getState() inside useFrame (imperative)
 * - No shared mutable state, no timing dependency between the two loops
 *
 * LAYOUT:
 * Albums are scattered across a 3D volume using a seeded pseudo-random
 * layout so positions are deterministic (no jitter on re-render).
 * Z-depth varies to create a parallax sense of depth.
 *
 * DEDUPLICATION:
 * The same album can appear multiple times in search results. We deduplicate
 * by album ID before rendering so we don't show the same cover twice.
 *
 * GRACEFUL DEGRADATION:
 * If fewer than 3 albums are available, the field renders with whatever
 * is available. If zero, the Canvas is not mounted at all (see parent).
 */

/**
 * AlbumGravityField.tsx — Deezer version
 *
 * Changes from Spotify version:
 * - DeezerTrack instead of SpotifyTrack
 * - track.album.id (number) instead of track.album.id (string)
 * - track.album.cover_medium instead of getAlbumArt()
 * - track.album.title instead of track.album.name
 */

import { Suspense, useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { Bloom, EffectComposer, ChromaticAberration, Vignette } from '@react-three/postprocessing'
import { AlbumMesh } from './AlbumMesh'
import { ParticleField } from './ParticleField'
import { CoreOrb } from './CoreOrb'
import { useVisualiserStore } from '@/stores/visualiserStore'
import { useResize } from '@/hooks/useResize'
import type { DeezerTrack } from '@/lib/deezerApi'
import type { AlbumColour } from '@/hooks/useAlbumColour'

interface AlbumGravityFieldProps {
  tracks: DeezerTrack[]
  width?: number
  height?: number
  accent?: AlbumColour
}

interface AlbumLayout {
  imageUrl: string
  albumId: string
  position: [number, number, number]
  phaseOffset: number
  rotationSpeed: number
  floatSpeed: number
  floatAmplitude: number
  size: number
}

function seededRandom(seed: number) {
  const x = Math.sin(seed + 1) * 10000
  return x - Math.floor(x)
}

function buildLayout(tracks: DeezerTrack[], isLowQuality: boolean): AlbumLayout[] {
  const seen = new Set<number>()
  const unique = tracks.filter(t => {
    if (seen.has(t.album.id)) return false
    seen.add(t.album.id)
    return true
  })

  return unique.slice(0, isLowQuality ? 6 : 12).map((track, i) => {
    const r = (n: number) => seededRandom(i * 17 + n)
    return {
      imageUrl: track.album.cover_medium,
      albumId: String(track.album.id),
      position: [(r(0) - 0.5) * 8, (r(1) - 0.5) * 3, r(2) * -2] as [number, number, number],
      phaseOffset: r(3) * Math.PI * 2,
      rotationSpeed: 0.02 + r(4) * 0.06,
      floatSpeed: 0.2 + r(5) * 0.3,
      floatAmplitude: 0.08 + r(6) * 0.12,
      size: 0.9 + r(7) * 0.5,
    }
  })
}

function Scene({ layout, accent }: { layout: AlbumLayout[]; accent?: AlbumColour }) {
  const { isLowQuality } = useVisualiserStore()
  const color = accent?.hex ?? '#ffffff'

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <fog attach="fog" args={[accent?.palette.background ?? '#050e05', 4, 15]} />

      <Suspense fallback={null}>
        <CoreOrb color={color} />
        <ParticleField color={color} />
        {layout.map(album => (
          <AlbumMesh key={album.albumId} {...album} />
        ))}
      </Suspense>

      {!isLowQuality && (
        <EffectComposer>
          <Bloom luminanceThreshold={0.2} mipmapBlur intensity={1.2} radius={0.4} />
          <ChromaticAberration
            offset={new THREE.Vector2(0.002, 0.002)}
            radialModulation={false}
            modulationOffset={0}
          />
          <Vignette eskil={false} offset={0.1} darkness={1.1} />
        </EffectComposer>
      )}
    </>
  )
}

export function AlbumGravityField({
  tracks,
  width: _initialWidth = 560,
  height: _initialHeight = 340,
  accent,
}: AlbumGravityFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { width: _, height: __ } = useResize(containerRef)
  const isLowQuality = useVisualiserStore(state => state.isLowQuality)
  const layout = useMemo(() => buildLayout(tracks, isLowQuality), [tracks, isLowQuality])

  if (layout.length === 0) return null

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 6,
        overflow: 'hidden',
        background: 'transparent',
      }}
      aria-hidden="true"
    >
      <Canvas
        camera={{ position: [0, 0, 8], fov: 55 }}
        gl={{
          alpha: true,
          antialias: !useVisualiserStore.getState().isLowQuality,
          powerPreference: 'high-performance',
        }}
        style={{ background: 'transparent' }}
        frameloop="always"
      >
        <Scene layout={layout} accent={accent} />
      </Canvas>
    </div>
  )
}
