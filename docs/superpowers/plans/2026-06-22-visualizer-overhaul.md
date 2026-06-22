# Visualizer Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make WaveForm's Ambient visualizer react to bass, mids, treble, and spectral flux independently, add a GPU-instanced particle crown, and fix the Presets layer UX.

**Architecture:** Expose three new normalized audio signals (`midPower`, `treblePower`, `spectralFlux`) from `BeatDetector` → `useAudioAnalyser` → `visualiserStore`. Downstream components (`AudioOrb`, `AudioTerrain`, `FrequencyBars`, new `ParticleCrown`) read these via `useVisualiserStore.getState()` imperatively inside their hot paths. `PresetInfoStrip` surfaces Butterchurn state through callback props and a forwarded ref.

**Tech Stack:** TypeScript, React 18, React Three Fiber, Three.js, Zustand, Vitest, Framer Motion, Butterchurn

## Global Constraints

- Raw `Uint8Array` audio data never enters React state or Zustand — only normalized scalars cross the boundary
- `AudioEngine` is a singleton — import `audioEngine`, never `new AudioEngine()`
- R3F `useFrame` reads store state via `useVisualiserStore.getState()` — not via React subscriptions
- All component styling uses inline `React.CSSProperties` — no CSS modules, no Tailwind
- No semicolons, single quotes, 2-space indent, trailing commas ES5, 100-char print width (Prettier config)
- `pnpm build` must pass (strict TS, `noUnusedLocals`, `noUnusedParameters`)
- Use `pnpm test:run` for single-run tests, `pnpm test` for watch mode
- Dark base `#050505`, color from album art via `AlbumColour` — no hardcoded accent colors in visualizer components

---

### Task 1: Multi-band audio signals

**Files:**

- Modify: `src/audio/BeatDetector.ts`
- Modify: `src/hooks/useAudioAnalyser.ts`
- Modify: `src/stores/visualiserStore.ts`
- Test: `src/audio/BeatDetector.test.ts`
- Test: `src/stores/visualiserStore.test.ts`

**Interfaces:**

- Produces: `BeatDetector.detect()` returns `{ beat, confidence, bassEnergy, bpm, spectralFlux: number }` where `spectralFlux` is normalized 0–1
- Produces: `visualiserStore` gains `midPower: number`, `treblePower: number`, `spectralFlux: number` (all 0 at init)
- Produces: `setAudioData()` parameter type expands to include those three fields
- Produces: `useAudioAnalyser` tick computes `midPower` (bins 20–59) and `treblePower` (bins 70–109) from `freqData` and passes all new fields to `setAudioData`

- [ ] **Step 1: Write failing tests for BeatDetector spectralFlux**

Add to `src/audio/BeatDetector.test.ts`:

```ts
it('should expose spectralFlux as a 0–1 normalized value', () => {
  const data = new Uint8Array(128).fill(0)
  const result = detector.detect(data)
  expect(result.spectralFlux).toBeGreaterThanOrEqual(0)
  expect(result.spectralFlux).toBeLessThanOrEqual(1)
})

it('should return higher spectralFlux on large spectral change', () => {
  const silence = new Uint8Array(128).fill(0)
  detector.detect(silence)
  // Sudden full-spectrum burst
  const loud = new Uint8Array(128).fill(200)
  const result = detector.detect(loud)
  expect(result.spectralFlux).toBeGreaterThan(0.1)
})
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm test:run src/audio/BeatDetector.test.ts
```

Expected: FAIL — `result.spectralFlux` is `undefined`

- [ ] **Step 3: Update BeatDetector to expose spectralFlux**

In `src/audio/BeatDetector.ts`, update the `detect` return type and add `spectralFlux` to the return statement:

```ts
detect(frequencyData: Uint8Array): {
  beat: boolean
  confidence: number
  bassEnergy: number
  bpm: number
  spectralFlux: number
} {
  // ... existing code unchanged until the return statement ...

  return {
    beat: isBeat,
    confidence,
    bassEnergy: bassEnergy / 255,
    bpm,
    spectralFlux: Math.min(1, flux / 5000),
  }
}
```

`flux` is already computed on line ~52 as the sum of positive bin-to-bin differences. `5000` is a practical normalization max (128 bins × average delta of ~40 on a big transient ≈ 5000). No new state is needed.

- [ ] **Step 4: Run BeatDetector tests to verify they pass**

```
pnpm test:run src/audio/BeatDetector.test.ts
```

Expected: all 7 tests PASS

- [ ] **Step 5: Write failing tests for visualiserStore new fields**

Add to the `beforeEach` reset block in `src/stores/visualiserStore.test.ts`:

```ts
midPower: 0,
treblePower: 0,
spectralFlux: 0,
```

Add new test:

```ts
it('should accept and store midPower, treblePower, and spectralFlux from setAudioData', () => {
  useVisualiserStore.getState().setAudioData({
    beat: false,
    bassPower: 0.3,
    beatConfidence: 0.1,
    bpm: 120,
    midPower: 0.6,
    treblePower: 0.4,
    spectralFlux: 0.2,
  })
  const s = useVisualiserStore.getState()
  expect(s.midPower).toBe(0.6)
  expect(s.treblePower).toBe(0.4)
  expect(s.spectralFlux).toBe(0.2)
})
```

- [ ] **Step 6: Run store test to verify it fails**

```
pnpm test:run src/stores/visualiserStore.test.ts
```

Expected: FAIL — `midPower` is `undefined`

- [ ] **Step 7: Update visualiserStore**

In `src/stores/visualiserStore.ts`:

Add to the `VisualiserStore` interface (after `bpm: number`):

```ts
midPower: number
treblePower: number
spectralFlux: number
```

Add to initial state (after `bpm: 0`):

```ts
midPower: 0,
treblePower: 0,
spectralFlux: 0,
```

Update the `setAudioData` signature in the interface:

```ts
setAudioData: (data: {
  beat: boolean
  bassPower: number
  beatConfidence: number
  bpm: number
  midPower: number
  treblePower: number
  spectralFlux: number
}) => void
```

The implementation (`setAudioData: data => set(data)`) requires no change — `set(data)` already spreads all fields.

- [ ] **Step 8: Run store tests to verify they pass**

```
pnpm test:run src/stores/visualiserStore.test.ts
```

Expected: all tests PASS

- [ ] **Step 9: Update useAudioAnalyser tick to compute and pass new fields**

In `src/hooks/useAudioAnalyser.ts`, update the `tick` function:

```ts
function tick() {
  if (subscribers.size === 0) {
    animFrameId = null
    return
  }

  const freqData = audioEngine.getFrequencyData()
  const waveData = audioEngine.getWaveformData()

  const { setAudioData } = useVisualiserStore.getState()

  const { beat, confidence, bassEnergy, bpm, spectralFlux } = beatDetector.detect(freqData)

  // Mid band: bins 20–59 (~400–2400 Hz)
  let midTotal = 0
  for (let i = 20; i < 60; i++) midTotal += freqData[i]
  const midPower = midTotal / (40 * 255)

  // Treble band: bins 70–109 (~2800–8500 Hz)
  let trebleTotal = 0
  for (let i = 70; i < 110; i++) trebleTotal += freqData[i]
  const treblePower = trebleTotal / (40 * 255)

  setAudioData({
    beat,
    beatConfidence: confidence,
    bassPower: bassEnergy,
    bpm,
    midPower,
    treblePower,
    spectralFlux,
  })

  subscribers.forEach(cb => cb(freqData, waveData))

  animFrameId = requestAnimationFrame(tick)
}
```

- [ ] **Step 10: Verify TypeScript compiles**

```
pnpm build
```

Expected: no errors

- [ ] **Step 11: Commit**

```
git add src/audio/BeatDetector.ts src/audio/BeatDetector.test.ts src/hooks/useAudioAnalyser.ts src/stores/visualiserStore.ts src/stores/visualiserStore.test.ts
git commit -m "feat: expose midPower, treblePower, spectralFlux in audio pipeline"
```

---

### Task 2: AudioOrb multi-band shader upgrade

**Files:**

- Modify: `src/components/visualiser/AudioOrb.tsx`

**Interfaces:**

- Consumes: `midPower: number`, `treblePower: number`, `spectralFlux: number` from `useVisualiserStore.getState()` inside `useFrame`
- Produces: visually, the orb's surface detail, color temperature, sparkle, and glow now respond to mid and treble bands separately from bass

- [ ] **Step 1: Add new uniforms to AudioOrb**

In `src/components/visualiser/AudioOrb.tsx`, add three new uniforms to the `uniforms` `useMemo` and update the shaders.

**Vertex shader** — add uniform declarations and a treble noise octave. Replace the `coreVertexShader` string:

```ts
const coreVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vNoise;
  uniform float uTime;
  uniform float uBass;
  uniform float uTreble;
  uniform int uQuality;

  ${SIMPLEX_NOISE_3D}

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;

    float noise = 0.0;
    if (uQuality > 0) {
      noise = snoise(position * 2.0 + uTime * 0.5) * 0.5;
      if (uQuality > 1) {
        noise += snoise(position * 4.0 - uTime * 0.8) * 0.25;
      }
      // Treble adds fine-grain surface detail (skipped on Low quality)
      noise += snoise(position * 12.0 + uTime * 1.2) * uTreble * 0.08;
    } else {
      noise = sin(position.y * 5.0 + uTime * 2.0) * 0.2;
    }

    vNoise = noise;
    vec3 newPos = position + normal * noise * uBass * 0.3;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
  }
`
```

**Fragment shader** — add uniforms and three new effects. Replace `coreFragmentShader`:

```ts
const coreFragmentShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vNoise;
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uTreble;
  uniform float uSpectralFlux;
  uniform vec3 uColor;
  uniform vec3 uAccent;
  uniform float uOpacity;
  uniform int uQuality;

  void main() {
    float intensity = vNoise * 0.5 + 0.5;

    float filaments = snoise(vPosition * 8.0 + uTime * 0.4) * 0.5 + 0.5;
    filaments *= snoise(vPosition * 16.0 - uTime * 0.6) * 0.5 + 0.5;

    // Mid-frequency warms the color mix (voice = warmer orb)
    float mixFactor = clamp(intensity + uBass * 0.4 + uMid * 0.15, 0.0, 1.0);
    vec3 color = mix(uColor * 0.4, uAccent, mixFactor);
    color = mix(color, uAccent * 1.5, filaments * intensity * (0.2 + uBass * 0.8));

    // Rim lighting — spectralFlux keeps glow alive between beats
    float rim = 1.0 - max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0);
    float rimPower = uQuality > 1 ? 6.0 : 4.0;
    color += uAccent * pow(rim, rimPower) * (1.5 + uBass * 3.0 + uSpectralFlux * 0.4);

    // Flare patterns
    if (uQuality > 0) {
      float flares = sin(vPosition.x * 20.0 + uTime) * cos(vPosition.y * 15.0 - uTime);
      if (uQuality > 1) {
        flares *= sin(vPosition.z * 10.0 + uTime * 0.5);
      }
      color += uAccent * max(0.0, flares) * 0.4 * (1.0 + uBass);

      // Treble sparkle: scattered bright flecks on cymbal hits
      float sparkleNoise = snoise(vPosition * 12.0 + uTime * 1.5) * 0.5 + 0.5;
      float sparkleMask = step(1.0 - uTreble * 0.2, sparkleNoise);
      color += uAccent * sparkleMask * uTreble * 1.5;
    }

    // Interior glow
    float interior = max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0);
    color += uColor * pow(interior, 2.5) * 0.5;

    // Organic pulse
    float pulse = sin(uTime * 2.0) * 0.5 + 0.5;
    color += uAccent * pulse * 0.1 * (1.0 + uBass);

    gl_FragColor = vec4(color, uOpacity);
  }
`
```

- [ ] **Step 2: Add new uniforms to the useMemo block**

In `AudioOrb`, update the `uniforms` `useMemo`:

```ts
const uniforms = useMemo(
  () => ({
    uTime: { value: 0 },
    uBass: { value: 0 },
    uMid: { value: 0 },
    uTreble: { value: 0 },
    uSpectralFlux: { value: 0 },
    uColor: { value: new THREE.Color(accent.palette.primary) },
    uAccent: { value: new THREE.Color(accent.palette.accent) },
    uOpacity: { value: 1.0 },
    uQuality: { value: qualityInt },
  }),
  [accent.palette.primary, accent.palette.accent, qualityInt]
)
```

- [ ] **Step 3: Update useFrame to write new uniforms and fix BPM breathing**

In the `useFrame` callback, destructure and write the new uniforms. Also fix the BPM breathing multiplier from `Math.PI` to `Math.PI * 2` (one breath per beat instead of per two beats):

```ts
useFrame(state => {
  const { bassPower, bpm, beat, beatConfidence, midPower, treblePower, spectralFlux } =
    useVisualiserStore.getState()
  const time = state.clock.elapsedTime

  smoothedBass.current += (bassPower - smoothedBass.current) * CONFIG.ANIMATION.BASS_SMOOTHING

  if (meshRef.current) {
    const targetRotY =
      CONFIG.ANIMATION.BASE_ROT_Y + smoothedBass.current * CONFIG.ANIMATION.BASS_ROT_Y_MULT
    const targetRotZ =
      CONFIG.ANIMATION.BASE_ROT_Z + smoothedBass.current * CONFIG.ANIMATION.BASS_ROT_Z_MULT
    smoothedRotation.current.y +=
      (targetRotY - smoothedRotation.current.y) * CONFIG.ANIMATION.ROTATION_SMOOTHING
    smoothedRotation.current.z +=
      (targetRotZ - smoothedRotation.current.z) * CONFIG.ANIMATION.ROTATION_SMOOTHING
    meshRef.current.rotation.y += smoothedRotation.current.y
    meshRef.current.rotation.z += smoothedRotation.current.z
  }

  if (coreRef.current) {
    // BPM-synced breathing: Math.PI * 2 gives one breath per beat (was Math.PI = two beats)
    const breathing = Math.sin(time * (bpm > 0 ? (bpm / 60) * Math.PI * 2 : 2)) * 0.05
    const baseScale = 1.0 + smoothedBass.current * 0.4 + breathing
    const targetScale = baseScale + (beat ? beatConfidence * 0.3 : 0)
    const currentScale = coreRef.current.scale.x
    const nextScale = THREE.MathUtils.lerp(currentScale, targetScale, 0.15)
    coreRef.current.scale.set(nextScale, nextScale, nextScale)
  }

  if (coreMaterialRef.current) {
    coreMaterialRef.current.uniforms.uTime.value = time
    coreMaterialRef.current.uniforms.uBass.value = smoothedBass.current
    coreMaterialRef.current.uniforms.uMid.value = midPower
    coreMaterialRef.current.uniforms.uTreble.value = treblePower
    coreMaterialRef.current.uniforms.uSpectralFlux.value = spectralFlux
    coreMaterialRef.current.uniforms.uOpacity.value = orbOpacity * 0.8
  }

  if (pointsMatRef.current) {
    pointsMatRef.current.opacity = orbOpacity * (0.1 + smoothedBass.current * 0.6)
    const pointsScale = 1.0 + smoothedBass.current * 0.8
    pointsMatRef.current.size = 0.05 * pointsScale
    colorRef.current.set(accent.palette.secondary)
    pointsMatRef.current.color.lerp(colorRef.current, smoothedBass.current * 0.2)
  }
})
```

- [ ] **Step 4: Verify TypeScript compiles**

```
pnpm build
```

Expected: no errors. If TypeScript complains about unused `beat` or `beatConfidence` in the new `useFrame` destructure — note those are used in the scale calculation above (replace the original `const { beat, beatConfidence } = useVisualiserStore.getState()` that was in a separate block).

- [ ] **Step 5: Commit**

```
git add src/components/visualiser/AudioOrb.tsx
git commit -m "feat: multi-band AudioOrb shader — mids warm color, treble sparkles, spectralFlux rim glow"
```

---

### Task 3: ParticleCrown component

**Files:**

- Create: `src/components/visualiser/ParticleCrown.tsx`
- Modify: `src/components/visualiser/FullscreenOverlay.tsx`

**Interfaces:**

- Consumes: `beat`, `beatConfidence`, `bassPower`, `midPower`, `treblePower` from store; `particlesOpacity` from store; `accent: AlbumColour` prop
- Produces: an `<instancedMesh>` of up to 1,500 point sprites that burst on beat, trickle continuously, and drift through a curl-noise field

- [ ] **Step 1: Create ParticleCrown.tsx**

Create `src/components/visualiser/ParticleCrown.tsx` with the full contents below. All particle data lives in pre-allocated typed arrays (no per-frame allocation). Motion runs entirely inside `useFrame`.

```tsx
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
        let slot = -1
        for (let k = 0; k < poolSize; k++) {
          if (!active.current[k]) {
            slot = k
            break
          }
        }
        if (slot === -1) break

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
        let slot = -1
        for (let k = 0; k < poolSize; k++) {
          if (!active.current[k]) {
            slot = k
            break
          }
        }
        if (slot === -1) break

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
    <instancedMesh ref={meshRef} args={[undefined, undefined, POOL_SIZE]} frustumCulled={false}>
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
```

- [ ] **Step 2: Mount ParticleCrown in the Ambient scene**

In `src/components/visualiser/FullscreenOverlay.tsx`, add the import at the top:

```ts
import { ParticleCrown } from './ParticleCrown'
```

In `FullscreenScene`, add `<ParticleCrown>` after `<AudioOrb>` (it renders between the orb and the terrain):

```tsx
{
  orbOpacity > 0 && <AudioOrb ref={setOrb} accent={accent} />
}
{
  particlesOpacity > 0 && <ParticleCrown accent={accent} />
}
{
  terrainOpacity > 0 && <AudioTerrain accent={accent} />
}
```

The existing `{particlesOpacity > 0 && <ParticleField ...>}` block that renders before the orb remains unchanged — `ParticleCrown` is a second particle layer closer to the orb.

- [ ] **Step 3: Verify TypeScript compiles**

```
pnpm build
```

Expected: no errors. Common TS issue: `args={[undefined, undefined, POOL_SIZE]}` on `instancedMesh` — if TypeScript rejects `undefined`, cast as `args={[undefined, undefined, POOL_SIZE] as [THREE.BufferGeometry | undefined, THREE.Material | undefined, number]}`.

- [ ] **Step 4: Commit**

```
git add src/components/visualiser/ParticleCrown.tsx src/components/visualiser/FullscreenOverlay.tsx
git commit -m "feat: add ParticleCrown GPU-instanced particle system to Ambient layer"
```

---

### Task 4: FrequencyBars band coloring and AudioTerrain mid-power hue shift

**Files:**

- Modify: `src/components/visualiser/FrequencyBars.tsx`
- Modify: `src/components/visualiser/AudioTerrain.tsx`

**Interfaces:**

- Consumes (AudioTerrain): `midPower` from `useVisualiserStore.getState()` inside `useFrame`
- Produces: FrequencyBars bars are colored by frequency zone (warm bass, mid green, cool treble); AudioTerrain hue shifts warm when voice is present

- [ ] **Step 1: Update FrequencyBars — band-colored LUT**

The palette is currently 256×100, indexed by amplitude. Change it to 128×100, indexed by frequency bin position. Each bin's color is determined by its spectral zone; brightness still comes from the gradient height.

In `src/components/visualiser/FrequencyBars.tsx`, replace the `useEffect` that builds the palette and the cap/glow string arrays:

```ts
useEffect(() => {
  accentRef.current = accent

  if (!paletteCanvasRef.current) {
    paletteCanvasRef.current = document.createElement('canvas')
  }

  const pCanvas = paletteCanvasRef.current
  // 128 columns (one per frequency bin), 100 rows (amplitude gradient)
  pCanvas.width = 128
  pCanvas.height = 100
  const pCtx = pCanvas.getContext('2d')
  if (!pCtx) return

  const { s: sat, l: lit } = accent
  const isLight = lit > 62

  const capStrings: string[] = []
  const glowStrings: string[] = []
  const tipStrings: string[] = []

  for (let b = 0; b < 128; b++) {
    // Zone-based hue: warm bass → green mid → cool treble, 5-bin soft crossfades
    let binHue: number
    if (b < 6) {
      binHue = 25
    } else if (b < 11) {
      binHue = 25 + ((b - 6) / 5) * 95 // 25° → 120°
    } else if (b < 65) {
      binHue = 120
    } else if (b < 70) {
      binHue = 120 + ((b - 65) / 5) * 100 // 120° → 220°
    } else {
      binHue = 220
    }

    const grad = pCtx.createLinearGradient(b, 100, b, 0)
    if (isLight) {
      grad.addColorStop(0, `hsla(${binHue}, ${sat}%, 35%, 0.7)`)
      grad.addColorStop(0.6, `hsla(${binHue}, ${Math.min(100, sat * 1.2)}%, 70%, 1)`)
      grad.addColorStop(1, `hsla(${binHue}, 100%, 90%, 1)`)
    } else {
      grad.addColorStop(0, `hsla(${binHue}, ${sat}%, 18%, 0.8)`)
      grad.addColorStop(0.7, `hsla(${binHue}, ${sat}%, 48%, 1)`)
      grad.addColorStop(1, `hsla(${binHue}, 100%, 80%, 1)`)
    }
    pCtx.fillStyle = grad
    pCtx.fillRect(b, 0, 1, 100)

    capStrings[b] = `hsla(${binHue}, 100%, 85%, 0.8)`
    glowStrings[b] = `hsla(${binHue}, 100%, 70%, 0.3)`
    tipStrings[b] = `hsla(${binHue}, 100%, 92%, 0.8)`
  }

  capStringsRef.current = capStrings
  glowStringsRef.current = glowStrings
  tipStringsRef.current = tipStrings
}, [accent])
```

Then update `drawBars` to sample the palette by `dataIdx` (bin position) instead of `value` (amplitude):

```ts
const drawBars = useCallback(
  (data: Uint8Array) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    const { width: w, height: h } = canvas
    const bins = mirrorMode ? Math.floor(data.length / 2) : data.length
    const drawCount = mirrorMode ? bins * 2 : bins
    const barSpacing = 1.5
    const barWidth = Math.max(1, w / drawCount - barSpacing)
    const baseline = h * 0.7

    ctx.fillStyle = accentRef.current.palette.background
    ctx.fillRect(0, 0, w, h)

    const palette = paletteCanvasRef.current
    if (!palette) return

    const caps = capStringsRef.current
    const glows = glowStringsRef.current
    const tips = tipStringsRef.current

    for (let i = 0; i < drawCount; i++) {
      const dataIdx = mirrorMode ? (i < bins ? bins - 1 - i : i - bins) : i
      const value = data[dataIdx]
      if (value < 2) continue

      const ratio = value / 255
      const barHeight = ratio * baseline
      const x = i * (barWidth + barSpacing)

      // Sample palette by bin position (x=dataIdx) for zone color, full gradient height
      ctx.drawImage(palette, dataIdx, 0, 1, 100, x, baseline - barHeight, barWidth, barHeight)

      if (barHeight > 6) {
        ctx.fillStyle = caps[dataIdx]
        ctx.fillRect(x, baseline - barHeight, barWidth, 2)

        if (ratio > 0.7) {
          ctx.fillStyle = glows[dataIdx]
          ctx.fillRect(x - 2, baseline - barHeight - 2, barWidth + 4, 4)
          ctx.fillStyle = tips[dataIdx]
          ctx.fillRect(x, baseline - barHeight - 1, barWidth, 2)
        }
      }
    }

    // Reflection pass (unchanged)
    ctx.save()
    ctx.globalAlpha = 0.15
    ctx.setTransform(1, 0, 0, -0.4, 0, baseline + baseline * 0.4)
    ctx.drawImage(canvas, 0, 0, w, baseline, 0, 0, w, baseline)
    ctx.restore()
  },
  [mirrorMode]
)
```

- [ ] **Step 2: Update AudioTerrain — add uMid uniform and warm hue shift**

In `src/components/visualiser/AudioTerrain.tsx`:

Add `uMid` to the fragment shader's uniform declarations (after `uniform int uQuality;`):

```glsl
uniform float uMid;
```

In the fragment shader `main()`, before `gl_FragColor`, add the mid-power warm tint:

```glsl
// Mid frequencies (voice) warm the terrain with an amber cast
color += vec3(uMid * 0.08, uMid * 0.04, 0.0);
```

Add `uMid` to the `uniforms` `useMemo` (inside the returned object):

```ts
uMid: { value: 0 },
```

In `useFrame`, read `midPower` from the store and update the uniform (add after the existing uniform writes):

```ts
const { bassPower, beat, beatConfidence, midPower } = visualState
// ...
materialRef.current.uniforms.uMid.value = midPower
```

The full `useFrame` after the change:

```ts
useFrame(state => {
  const { clock } = state
  const data = audioEngine.getFrequencyData()
  const visualState = useVisualiserStore.getState()
  const { bassPower, beat, beatConfidence, midPower } = visualState

  if (beat) {
    lastBeatTime.current = clock.elapsedTime
  }

  if (materialRef.current && freqTextureRef.current) {
    freqDataRef.current.set(data.subarray(0, 128))
    freqTextureRef.current.needsUpdate = true

    materialRef.current.uniforms.uTime.value = clock.elapsedTime
    materialRef.current.uniforms.uBass.value = bassPower
    materialRef.current.uniforms.uMid.value = midPower
    materialRef.current.uniforms.uBeat.value = beat
      ? beatConfidence
      : materialRef.current.uniforms.uBeat.value * 0.95
    materialRef.current.uniforms.uBeatTime.value = lastBeatTime.current
    materialRef.current.uniforms.uOpacity.value = terrainOpacity
  }
})
```

- [ ] **Step 3: Verify TypeScript compiles**

```
pnpm build
```

Expected: no errors

- [ ] **Step 4: Commit**

```
git add src/components/visualiser/FrequencyBars.tsx src/components/visualiser/AudioTerrain.tsx
git commit -m "feat: band-colored FrequencyBars and AudioTerrain mid-power warm shift"
```

---

### Task 5: Presets UX fix

**Files:**

- Modify: `src/components/visualiser/ButterchurnVisualiser.tsx`
- Create: `src/components/visualiser/PresetInfoStrip.tsx`
- Modify: `src/components/visualiser/FullscreenOverlay.tsx`

**Interfaces:**

- Produces: `ButterchurnVisualiser` gets `onPresetChange?: (name: string) => void` prop and exposes `{ nextPreset, prevPreset }` via `forwardRef`/`useImperativeHandle`
- Produces: `PresetInfoStrip` renders a self-hiding info overlay with the preset name, cycle timer bar, and prev/next buttons
- Consumes (FullscreenOverlay): `butterchurnRef` forwarded ref, `currentPresetName` state, passed to `PresetInfoStrip`

- [ ] **Step 1: Refactor ButterchurnVisualiser to expose preset controls**

Replace `src/components/visualiser/ButterchurnVisualiser.tsx` with:

```tsx
import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import butterchurn, { type Visualizer } from 'butterchurn'
import butterchurnPresets from 'butterchurn-presets'
import { audioEngine } from '@/audio/AudioEngine'
import { usePlayerStore } from '@/stores/playerStore'
import { useResize } from '@/hooks/useResize'

export interface ButterchurnHandle {
  nextPreset: () => void
  prevPreset: () => void
}

interface ButterchurnVisualiserProps {
  onFailure?: () => void
  onCanvasReady?: (canvas: HTMLCanvasElement) => void
  onPresetChange?: (name: string) => void
  opacity?: number
}

export const ButterchurnVisualiser = forwardRef<ButterchurnHandle, ButterchurnVisualiserProps>(
  function ButterchurnVisualiser({ onFailure, onCanvasReady, onPresetChange, opacity = 1 }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const visualizerRef = useRef<{
      visualizer: Visualizer
      presets: string[]
      allPresets: Record<string, unknown>
    } | null>(null)
    const hasInitialisedRef = useRef(false)
    const frameIdRef = useRef<number>()
    const { width, height } = useResize(containerRef)

    const currentPresetIndex = useRef(0)
    const isPlaying = usePlayerStore(state => state.isPlaying)

    const loadPresetAtIndex = (index: number, blendTime: number) => {
      if (!visualizerRef.current) return
      const { visualizer, presets, allPresets } = visualizerRef.current
      const name = presets[index]
      visualizer.loadPreset(allPresets[name], blendTime)
      onPresetChange?.(name)
    }

    useImperativeHandle(ref, () => ({
      nextPreset: () => {
        if (!visualizerRef.current) return
        currentPresetIndex.current =
          (currentPresetIndex.current + 1) % visualizerRef.current.presets.length
        loadPresetAtIndex(currentPresetIndex.current, 0)
      },
      prevPreset: () => {
        if (!visualizerRef.current) return
        currentPresetIndex.current =
          (currentPresetIndex.current - 1 + visualizerRef.current.presets.length) %
          visualizerRef.current.presets.length
        loadPresetAtIndex(currentPresetIndex.current, 0)
      },
    }))

    useEffect(() => {
      if (!isPlaying || hasInitialisedRef.current) return

      const audioContext = audioEngine.audioContext
      const canvas = canvasRef.current
      const analyser = audioEngine.analyserNode

      if (!audioContext || !canvas || !analyser) return

      hasInitialisedRef.current = true

      let visualizer: Visualizer
      try {
        // @ts-expect-error - butterchurn ESM interop
        const createVisualizer =
          butterchurn.default?.createVisualizer || butterchurn.createVisualizer
        if (typeof createVisualizer !== 'function') throw new Error('butterchurn not found')
        visualizer = createVisualizer(audioContext, canvas, {
          width: canvas.width,
          height: canvas.height,
        })
      } catch (err) {
        console.error('Failed to initialize Butterchurn:', err)
        onFailure?.()
        return
      }

      visualizer.connectAudio(analyser)

      const presets = butterchurnPresets.getPresets()
      const keys = Object.keys(presets).sort(() => Math.random() - 0.5)

      visualizerRef.current = { visualizer, presets: keys, allPresets: presets }
      loadPresetAtIndex(0, 0)

      const render = () => {
        if (opacity > 0) visualizer.render()
        frameIdRef.current = requestAnimationFrame(render)
      }
      render()

      if (onCanvasReady && canvas) onCanvasReady(canvas)

      return () => {
        if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPlaying])

    useEffect(() => {
      if (visualizerRef.current && width && height) {
        visualizerRef.current.visualizer.setRendererSize(width, height)
      }
    }, [width, height])

    useEffect(() => {
      const autoCycle = () => {
        if (!visualizerRef.current) return
        currentPresetIndex.current =
          (currentPresetIndex.current + 1) % visualizerRef.current.presets.length
        loadPresetAtIndex(currentPresetIndex.current, 5.7)
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key.toLowerCase() === 'p') autoCycle()
      }

      const interval = setInterval(autoCycle, 20000)
      window.addEventListener('keydown', handleKeyDown)
      return () => {
        window.removeEventListener('keydown', handleKeyDown)
        clearInterval(interval)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          width={width || 800}
          height={height || 600}
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
      </div>
    )
  }
)
```

Key changes: `forwardRef` wraps the component; `useImperativeHandle` exposes `nextPreset`/`prevPreset`; `onPresetChange` callback fires on every preset change (including auto-cycle); the old "Press 'P'" hint is removed (replaced by `PresetInfoStrip`); `loadPresetAtIndex` is a shared helper so name tracking is consistent.

- [ ] **Step 2: Create PresetInfoStrip.tsx**

Create `src/components/visualiser/PresetInfoStrip.tsx`:

```tsx
import { useState, useEffect, useRef } from 'react'
import type { ButterchurnHandle } from './ButterchurnVisualiser'

const CYCLE_MS = 20000

interface PresetInfoStripProps {
  presetName: string
  butterchurnRef: React.RefObject<ButterchurnHandle>
  accentHex: string
}

export function PresetInfoStrip({ presetName, butterchurnRef, accentHex }: PresetInfoStripProps) {
  const [visible, setVisible] = useState(true)
  const [progress, setProgress] = useState(0) // 0–1, resets on cycle
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTimeRef = useRef(Date.now())
  const rafRef = useRef<number>()

  // Reset cycle timer whenever the preset name changes
  useEffect(() => {
    startTimeRef.current = Date.now()
  }, [presetName])

  // Animate progress bar
  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current
      setProgress(Math.min(1, elapsed / CYCLE_MS))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // Auto-hide after 3s of no mouse movement
  const handleMouseMove = () => {
    setVisible(true)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => setVisible(false), 3000)
  }

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    hideTimerRef.current = setTimeout(() => setVisible(false), 3000)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Truncate long preset names so they don't overflow
  const displayName = presetName.length > 48 ? presetName.slice(0, 47) + '…' : presetName

  return (
    <div
      style={{
        ...styles.strip,
        opacity: visible ? 1 : 0.15,
      }}
    >
      {/* Timer progress bar */}
      <div style={styles.timerTrack}>
        <div
          style={{
            ...styles.timerFill,
            width: `${progress * 100}%`,
            background: accentHex,
          }}
        />
      </div>

      <div style={styles.row}>
        {/* Prev button */}
        <button
          style={{ ...styles.chevronBtn, borderColor: `${accentHex}44`, color: accentHex }}
          onClick={() => butterchurnRef.current?.prevPreset()}
          aria-label="Previous preset"
        >
          ‹
        </button>

        {/* Preset info */}
        <div style={styles.info}>
          <div style={styles.label}>MILKDROP PRESET</div>
          <div style={{ ...styles.presetName, color: accentHex }}>{displayName}</div>
        </div>

        {/* Next button */}
        <button
          style={{ ...styles.chevronBtn, borderColor: `${accentHex}44`, color: accentHex }}
          onClick={() => butterchurnRef.current?.nextPreset()}
          aria-label="Next preset"
        >
          ›
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  strip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    transition: 'opacity 0.6s ease',
    pointerEvents: 'auto',
    fontFamily: 'monospace',
    zIndex: 5,
  },
  timerTrack: {
    height: 2,
    background: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  timerFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    transition: 'width 0.1s linear',
    opacity: 0.7,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '0.75rem 1.5rem',
    background: 'rgba(0,0,0,0.45)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
  },
  chevronBtn: {
    background: 'transparent',
    border: '1px solid',
    borderRadius: 4,
    color: '#fff',
    fontSize: '1.25rem',
    lineHeight: 1,
    width: 36,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    fontFamily: 'monospace',
  },
  info: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
  },
  label: {
    fontSize: '0.6rem',
    letterSpacing: '0.25em',
    opacity: 0.4,
    textTransform: 'uppercase',
  },
  presetName: {
    fontSize: '0.8rem',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
}
```

- [ ] **Step 3: Wire ButterchurnVisualiser and PresetInfoStrip into FullscreenOverlay**

In `src/components/visualiser/FullscreenOverlay.tsx`:

Add imports:

```ts
import { ButterchurnVisualiser, type ButterchurnHandle } from './ButterchurnVisualiser'
import { PresetInfoStrip } from './PresetInfoStrip'
```

(Replace the existing `ButterchurnVisualiser` import.)

In `FullscreenOverlay`, add state and ref for preset name and butterchurn handle:

```ts
const butterchurnRef = React.useRef<ButterchurnHandle>(null)
const [currentPresetName, setCurrentPresetName] = React.useState('')
```

Update the `<ButterchurnVisualiser>` JSX to pass the new props:

```tsx
<ButterchurnVisualiser
  ref={butterchurnRef}
  onFailure={() => setVisualLayer('Minimal')}
  onCanvasReady={setButterchurnCanvas}
  onPresetChange={setCurrentPresetName}
  opacity={presetsOpacity}
/>
```

Add `<PresetInfoStrip>` inside the `styles.uiLayer` div, showing only when on the Presets layer:

```tsx
{
  visualLayer === 'Presets' && currentPresetName && (
    <PresetInfoStrip
      presetName={currentPresetName}
      butterchurnRef={butterchurnRef}
      accentHex={accent.hex}
    />
  )
}
```

Place this block just before the closing `</div>` of `styles.uiLayer` (after the controls block).

- [ ] **Step 4: Verify TypeScript compiles**

```
pnpm build
```

Expected: no errors. If TypeScript complains about `ref` on `ButterchurnVisualiser` (since it's now a `forwardRef` component), ensure the import uses the named export not a default export.

- [ ] **Step 5: Commit**

```
git add src/components/visualiser/ButterchurnVisualiser.tsx src/components/visualiser/PresetInfoStrip.tsx src/components/visualiser/FullscreenOverlay.tsx
git commit -m "feat: Presets UX — named preset strip with prev/next controls and cycle timer"
```

---

## Self-Review

**Spec coverage:**

- Section 1 (multi-band signals): ✅ Task 1
- Section 2 (AudioOrb upgrade): ✅ Task 2 — uMid color temp, uTreble sparkle + vertex noise, uSpectralFlux rim, BPM breathing fix
- Section 3 (ParticleCrown): ✅ Task 3
- Section 4 (Presets UX): ✅ Task 5
- Section 5a (FrequencyBars coloring): ✅ Task 4
- Section 5b (AudioTerrain uMid): ✅ Task 4
- Section 5c (BPM-synced breathing): ✅ folded into Task 2

**Type consistency:**

- `BeatDetector.detect()` returns `spectralFlux: number` → consumed in `useAudioAnalyser` tick → stored as `spectralFlux` in `visualiserStore` → read as `spectralFlux` in `AudioOrb.useFrame()` as `uSpectralFlux` uniform ✅
- `ButterchurnHandle.nextPreset` / `prevPreset` defined in `ButterchurnVisualiser.tsx` → consumed in `PresetInfoStrip.tsx` via `butterchurnRef.current?.nextPreset()` ✅
- `ParticleCrown` receives `accent: AlbumColour` → uses `accent.palette.primary` and `accent.palette.secondary` ✅

**Placeholder scan:** No TBDs or stubs. All code blocks are complete and runnable.

**Performance check:**

- `ParticleCrown` allocates its typed arrays once at mount; `useFrame` has no object allocations except the pre-allocated `tempMatrix` and `tempColor` refs
- `BeatDetector` additions are 2 loop passes of 40 iterations each — negligible overhead at 60fps
- `FrequencyBars` palette rebuild only triggers on accent change (album switch), not per frame
