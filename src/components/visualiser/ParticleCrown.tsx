import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useVisualiserStore } from '@/stores/visualiserStore'
import type { AlbumColour } from '@/hooks/useAlbumColour'

const POOL_SIZE = 1500
const POOL_SIZE_LOW = 400
const NOISE_G = 16 // 16×16×16 curl-noise grid
const ORB_RADIUS = 1.2

// Sample a pre-baked noise grid — module-level to avoid closure re-creation
function sampleNoise(
  grid: Float32Array,
  x: number,
  y: number,
  z: number
): [number, number, number] {
  const xi = Math.abs(Math.floor(x * NOISE_G)) % NOISE_G
  const yi = Math.abs(Math.floor(y * NOISE_G)) % NOISE_G
  const zi = Math.abs(Math.floor(z * NOISE_G)) % NOISE_G
  const idx = (xi + yi * NOISE_G + zi * NOISE_G * NOISE_G) * 3
  return [grid[idx], grid[idx + 1], grid[idx + 2]]
}

export function ParticleCrown({ accent }: { accent: AlbumColour }) {
  const quality = useVisualiserStore(state => state.quality)
  const opacity = useVisualiserStore(state => state.particlesOpacity)
  const poolSize = quality === 'Low' ? POOL_SIZE_LOW : POOL_SIZE

  // Particle state — parallel typed arrays, allocated once at max pool size
  const pos = useRef(new Float32Array(POOL_SIZE * 3))
  const vel = useRef(new Float32Array(POOL_SIZE * 3))
  const life = useRef(new Float32Array(POOL_SIZE))
  const maxLife = useRef(new Float32Array(POOL_SIZE))
  const active = useRef(new Uint8Array(POOL_SIZE))

  // Curl-noise grid — built once on mount
  const noiseGrid = useMemo(() => {
    const g = new Float32Array(NOISE_G * NOISE_G * NOISE_G * 3)
    for (let i = 0; i < g.length; i++) g[i] = (Math.random() - 0.5) * 2
    return g
  }, [])

  // Three.js working objects — never re-allocated in the hot path
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const tempMatrix = useRef(new THREE.Matrix4())
  const tempColor = useRef(new THREE.Color())
  const color1 = useMemo(() => new THREE.Color(accent.palette.primary), [accent.palette.primary])
  const color2 = useMemo(
    () => new THREE.Color(accent.palette.secondary),
    [accent.palette.secondary]
  )

  const lastBeat = useRef(false)
  const freeList = useRef<Int32Array | null>(null)
  const freeHead = useRef(-1)

  // Initialize free list once on first render
  useMemo(() => {
    const list = new Int32Array(POOL_SIZE)
    for (let i = 0; i < POOL_SIZE; i++) list[i] = POOL_SIZE - 1 - i
    freeList.current = list
    freeHead.current = POOL_SIZE - 1
  }, [])

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh || opacity <= 0) return

    const { beat, beatConfidence, bassPower, midPower, treblePower } = useVisualiserStore.getState()
    const dt = Math.min(delta, 0.05)

    // --- Spawn: beat burst (rising edge only) ---
    if (beat && !lastBeat.current) {
      const count =
        quality === 'Low'
          ? Math.floor(15 + beatConfidence * 15)
          : Math.floor(40 + beatConfidence * 40)
      const speed = 0.8 + bassPower * 1.2

      for (let b = 0; b < count; b++) {
        // Find an inactive slot
        if (freeHead.current < 0) break
        const slot = freeList.current![freeHead.current--]

        // Random point on unit sphere (surface of orb)
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1)
        const nx = Math.sin(phi) * Math.cos(theta)
        const ny = Math.sin(phi) * Math.sin(theta)
        const nz = Math.cos(phi)

        const s3 = slot * 3
        pos.current[s3] = nx * ORB_RADIUS
        pos.current[s3 + 1] = ny * ORB_RADIUS
        pos.current[s3 + 2] = nz * ORB_RADIUS
        vel.current[s3] = nx * speed
        vel.current[s3 + 1] = ny * speed
        vel.current[s3 + 2] = nz * speed
        const ls = 1.5 + Math.random() * 2.0
        maxLife.current[slot] = ls
        life.current[slot] = ls
        active.current[slot] = 1
      }
    }
    lastBeat.current = beat

    // --- Spawn: continuous trickle (skipped on Low quality) ---
    if (quality !== 'Low') {
      const trickleCount = 2 + Math.floor(Math.random() * 3)
      for (let t = 0; t < trickleCount; t++) {
        if (freeHead.current < 0) break
        const slot = freeList.current![freeHead.current--]

        const pole = Math.random() > 0.5 ? 1 : -1
        const jx = (Math.random() - 0.5) * 0.4
        const jz = (Math.random() - 0.5) * 0.4
        const s3 = slot * 3
        pos.current[s3] = jx * 0.5
        pos.current[s3 + 1] = pole * ORB_RADIUS
        pos.current[s3 + 2] = jz * 0.5
        vel.current[s3] = jx * 0.2
        vel.current[s3 + 1] = pole * 0.3
        vel.current[s3 + 2] = jz * 0.2
        const ls = 2.0 + Math.random() * 1.5
        maxLife.current[slot] = ls
        life.current[slot] = ls
        active.current[slot] = 1
      }
    }

    // --- Update all particles ---
    for (let i = 0; i < poolSize; i++) {
      if (!active.current[i]) {
        tempMatrix.current.makeScale(0, 0, 0)
        mesh.setMatrixAt(i, tempMatrix.current)
        continue
      }

      const i3 = i * 3
      const px = pos.current[i3]
      const py = pos.current[i3 + 1]
      const pz = pos.current[i3 + 2]

      // Curl-noise displacement
      const [nx, ny, nz] = sampleNoise(noiseGrid, px * 0.3, py * 0.3, pz * 0.3)
      const noiseScale = 0.015 + midPower * 0.025

      // Radial push from bass
      const dist = Math.sqrt(px * px + py * py + pz * pz) + 0.001
      const radPush = bassPower * 0.008

      vel.current[i3] += nx * noiseScale + (px / dist) * radPush
      vel.current[i3 + 1] += ny * noiseScale + (py / dist) * radPush
      vel.current[i3 + 2] += nz * noiseScale + (pz / dist) * radPush

      // Dampen
      vel.current[i3] *= 0.97
      vel.current[i3 + 1] *= 0.97
      vel.current[i3 + 2] *= 0.97

      // Integrate
      pos.current[i3] += vel.current[i3] * dt
      pos.current[i3 + 1] += vel.current[i3 + 1] * dt
      pos.current[i3 + 2] += vel.current[i3 + 2] * dt

      // Age
      life.current[i] -= dt
      if (life.current[i] <= 0) {
        active.current[i] = 0
        freeList.current![++freeHead.current] = i
        tempMatrix.current.makeScale(0, 0, 0)
        mesh.setMatrixAt(i, tempMatrix.current)
        continue
      }

      // Matrix
      tempMatrix.current.makeTranslation(pos.current[i3], pos.current[i3 + 1], pos.current[i3 + 2])
      mesh.setMatrixAt(i, tempMatrix.current)

      // Color: lerp by distance from center (near=primary, far=secondary)
      const normalizedDist = Math.min(1, dist / 6)
      tempColor.current.copy(color1).lerp(color2, normalizedDist)

      // Treble brightens the whole crown; mid warms reds
      const brightness = (0.6 + treblePower * 1.4) * opacity
      tempColor.current.multiplyScalar(brightness)
      tempColor.current.r = Math.min(1, tempColor.current.r + midPower * 0.12)

      // Fade out in final 20% of life
      const lifeRatio = life.current[i] / maxLife.current[i]
      if (lifeRatio < 0.2) tempColor.current.multiplyScalar(lifeRatio / 0.2)

      mesh.setColorAt(i, tempColor.current)
    }

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={
        [undefined, undefined, POOL_SIZE] as [
          THREE.BufferGeometry | undefined,
          THREE.Material | undefined,
          number,
        ]
      }
      frustumCulled={false}
    >
      <planeGeometry args={[0.04, 0.04]} />
      <meshBasicMaterial
        vertexColors
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  )
}
