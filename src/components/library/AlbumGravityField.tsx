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

import { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { AlbumMesh } from './AlbumMesh'
import type { SpotifyTrack } from '@/lib/spotifyApi'
import { getAlbumArt } from '@/lib/spotifyApi'

interface AlbumGravityFieldProps {
  tracks: SpotifyTrack[]
  /** Canvas width in px */
  width?: number
  /** Canvas height in px */
  height?: number
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

// Seeded pseudo-random — deterministic layout, no flicker on re-render
function seededRandom(seed: number) {
  const x = Math.sin(seed + 1) * 10000
  return x - Math.floor(x)
}

function buildLayout(tracks: SpotifyTrack[]): AlbumLayout[] {
  // Deduplicate by album ID
  const seen = new Set<string>()
  const unique = tracks.filter(t => {
    if (seen.has(t.album.id)) return false
    seen.add(t.album.id)
    return true
  })

  // Cap at 12 — more than this gets visually crowded
  const capped = unique.slice(0, 12)

  return capped.map((track, i) => {
    const r = (n: number) => seededRandom(i * 17 + n)

    // Spread albums across a wide, shallow 3D volume
    // X: -4 to +4, Y: -1.5 to +1.5, Z: -2 to 0
    const x = (r(0) - 0.5) * 8
    const y = (r(1) - 0.5) * 3
    const z = r(2) * -2

    return {
      imageUrl: getAlbumArt(track, 'medium'),
      albumId: track.album.id,
      position: [x, y, z] as [number, number, number],
      phaseOffset: r(3) * Math.PI * 2,
      rotationSpeed: 0.02 + r(4) * 0.06,
      floatSpeed: 0.2 + r(5) * 0.3,
      floatAmplitude: 0.08 + r(6) * 0.12,
      size: 0.9 + r(7) * 0.5,
    }
  })
}

// Fog + ambient scene setup — rendered as R3F children
function Scene({ layout }: { layout: AlbumLayout[] }) {
  return (
    <>
      <ambientLight intensity={0.8} />
      <fog attach="fog" args={['#050e05', 4, 10]} />

      <Suspense fallback={null}>
        {layout.map(album => (
          <AlbumMesh key={album.albumId} {...album} />
        ))}
      </Suspense>
    </>
  )
}

export function AlbumGravityField({
  tracks,
  width = 560,
  height = 340,
}: AlbumGravityFieldProps) {
  const layout = useMemo(() => buildLayout(tracks), [tracks])

  // Don't mount the Canvas at all if there's nothing to show
  if (layout.length === 0) return null

  return (
    <div
      style={{
        width,
        height,
        borderRadius: 6,
        overflow: 'hidden',
        background: 'transparent',
      }}
      aria-hidden="true"  // decorative — screen readers don't need this
    >
      <Canvas
        camera={{ position: [0, 0, 5], fov: 55 }}
        gl={{
          alpha: true,           // transparent background
          antialias: true,
          powerPreference: 'high-performance',
        }}
        style={{ background: 'transparent' }}
        frameloop="always"
      >
        <Scene layout={layout} />
      </Canvas>
    </div>
  )
}