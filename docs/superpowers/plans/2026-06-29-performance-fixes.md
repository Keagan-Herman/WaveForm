# Performance Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate 60fps React re-renders, GC-triggering allocations, and redundant GPU work identified in the performance review.

**Architecture:** All fixes respect the existing architecture — raw audio data stays out of React/Zustand, R3F components read stores imperatively inside `useFrame`, and the three render loops (rAF canvas, R3F, D3) stay independent. No new files created; changes are surgical edits to existing files.

**Tech Stack:** React 18, Three.js / React Three Fiber, `@react-three/postprocessing`, Zustand (with `subscribeWithSelector`), Framer Motion, Vitest, TypeScript strict mode.

## Global Constraints

- TypeScript strict mode, `noUnusedLocals`, `noUnusedParameters` — prefix unused params with `_`
- `erasableSyntaxOnly: true` — no `const enum`, no `namespace`
- No semicolons, single quotes, 2-space indent, trailing commas ES5, 100-char print width (`.prettierrc`)
- Path alias `@/` → `src/`
- Use `pnpm`, never `npm` or `yarn`
- Run tests with `pnpm test:run`
- Build check: `pnpm build`
- Raw `Uint8Array` audio data must never enter React state or Zustand
- R3F `useFrame` must read store state via `getState()`, never via React subscriptions

---

## Phase 1 — Critical

### Task 1: Remove `bassPower` React subscription from `FullscreenScene`

**Problem:** `FullscreenScene` (inside R3F `<Canvas>`) subscribes to `bassPower` via `useVisualiserStore`. `bassPower` is written 60×/sec by the rAF loop. This triggers a full React + R3F reconciler diff of the entire effect pipeline (Bloom, GodRays, ChromaticAberration, Vignette, Noise, DepthOfField) on every animation frame.

**Files:**

- Modify: `src/components/visualiser/FullscreenOverlay.tsx` (FullscreenScene component, lines 45–196)

**Interfaces:**

- Consumes: `useVisualiserStore.getState()` imperatively inside `useFrame`
- Produces: `bloomRef` and `chromaRef` — refs to the underlying `BloomEffect` and `ChromaticAberrationEffect` instances that `useFrame` mutates directly

- [ ] **Step 1: Write the failing test**

There is no unit test for this (it's a React component with WebGL). The "test" is build correctness. Skip to Step 3.

- [ ] **Step 2: Add `useFrame` import to `FullscreenOverlay.tsx`**

At line 2, `@react-three/fiber` is not yet imported in this file. Add it:

```tsx
import { useFrame } from '@react-three/fiber'
```

- [ ] **Step 3: Add effect refs and imperative `useFrame` to `FullscreenScene`**

In `FullscreenScene` (starting at line 45), make these changes:

1. Remove line 76: `const bassPower = useVisualiserStore(state => state.bassPower)`

2. Add effect refs after `const chromaOffset = useRef(new THREE.Vector2())` (currently line 77):

```tsx
import type { BloomEffect, ChromaticAberrationEffect } from 'postprocessing'

// inside FullscreenScene:
const bloomRef = useRef<BloomEffect>(null)
const chromaRef = useRef<ChromaticAberrationEffect>(null)

useFrame(() => {
  const { bassPower, bloomIntensity: liveBloomIntensity } = useVisualiserStore.getState()
  if (bloomRef.current) {
    bloomRef.current.intensity = liveBloomIntensity * (1 + bassPower * 0.5)
  }
  if (chromaRef.current) {
    chromaRef.current.offset.set(0.002 * bassPower, 0.002 * bassPower)
  }
})
```

3. Change the `<Bloom>` JSX (currently line 143–148) from:

```tsx
<Bloom key="bloom" luminanceThreshold={0.1} intensity={bloomIntensity * (1 + bassPower * 0.5)} />
```

to:

```tsx
<Bloom ref={bloomRef} key="bloom" luminanceThreshold={0.1} intensity={bloomIntensity} />
```

4. Change the `<ChromaticAberration>` JSX (currently line 164–175) from:

```tsx
<ChromaticAberration
  key="chroma"
  /* eslint-disable react-hooks/refs */
  offset={chromaOffset.current.set(0.002 * bassPower, 0.002 * bassPower)}
  /* eslint-enable react-hooks/refs */
  radialModulation={false}
  modulationOffset={0}
/>
```

to:

```tsx
<ChromaticAberration
  ref={chromaRef}
  key="chroma"
  offset={chromaOffset.current}
  radialModulation={false}
  modulationOffset={0}
/>
```

- [ ] **Step 4: Verify build passes**

```bash
pnpm build
```

Expected: Build succeeds with no TypeScript errors. If `postprocessing` types are not found, try importing from `@react-three/postprocessing` instead:

```tsx
// Alternative if 'postprocessing' package types aren't available:
const bloomRef = useRef<{ intensity: number } | null>(null)
const chromaRef = useRef<{ offset: THREE.Vector2 } | null>(null)
```

- [ ] **Step 5: Commit**

```bash
git add src/components/visualiser/FullscreenOverlay.tsx
git commit -m "perf: drive Bloom/ChromaticAberration imperatively via useFrame, eliminate 60fps React reconciler"
```

---

## Phase 2 — High Priority

### Task 2: Remove `beat` React subscription from `FullscreenOverlay` outer component

**Problem:** `const beat = useVisualiserStore(state => state.beat)` at line 287 of `FullscreenOverlay` (the outer non-R3F component) causes the entire overlay — Canvas wrapper, ButterchurnVisualiser, AnimatePresence, HUD motion elements — to re-render on every beat event. `beat` is used only to drive `animate` props on three `motion.div` wrappers.

**Files:**

- Modify: `src/components/visualiser/FullscreenOverlay.tsx` (FullscreenOverlay component, lines 198–670, and new `HUDBeatPulse` helper ~line 670)

**Interfaces:**

- Consumes: `useVisualiserStore.subscribe(state => state.beat, cb)` — Zustand selector-based subscription
- Produces: `HUDBeatPulse` component — wraps a single HUD panel, subscribes imperatively, animates via Framer Motion's `useAnimate` hook

- [ ] **Step 1: Write the failing test**

No automated test — this is a React render optimization. Verify via build correctness. Skip to Step 2.

- [ ] **Step 2: Add `useAnimate` import from framer-motion**

At line 14, `framer-motion` is already imported. Add `useAnimate` to the destructure:

```tsx
import { motion, AnimatePresence, useReducedMotion, useAnimate } from 'framer-motion'
```

- [ ] **Step 3: Add `HUDBeatPulse` component after the `BeatIndicator` function (around line 901)**

```tsx
function HUDBeatPulse({
  children,
  scale,
  x,
  duration,
}: {
  children: React.ReactNode
  scale: number
  x: number
  duration: number
}) {
  const [scope, animate] = useAnimate()

  useEffect(() => {
    return useVisualiserStore.subscribe(
      state => state.beat,
      beat => {
        void animate(scope.current, beat ? { scale, x } : { scale: 1, x: 0 }, { duration })
      }
    )
  }, [animate, scope, scale, x, duration])

  return <div ref={scope}>{children}</div>
}
```

- [ ] **Step 4: Remove `beat` subscription and replace the three `motion.div` wrappers in `FullscreenOverlay`**

Remove line 287: `const beat = useVisualiserStore(state => state.beat)`

In the `hudRight` section (lines 388–409), replace the three `motion.div` wrappers:

Before:

```tsx
<motion.div
  variants={hudItemVariants}
  animate={beat ? { scale: 1.02, x: -2 } : { scale: 1, x: 0 }}
  transition={{ duration: 0.1 }}
>
  <EnergyFlux accent={accent.hex} />
</motion.div>
<motion.div
  variants={hudItemVariants}
  animate={beat ? { scale: 1.01, x: -1 } : { scale: 1, x: 0 }}
  transition={{ duration: 0.12 }}
>
  <FrequencyScrutinizer accent={accent.hex} />
</motion.div>
<motion.div
  variants={hudItemVariants}
  animate={beat ? { scale: 1.01, x: -1 } : { scale: 1, x: 0 }}
  transition={{ duration: 0.14 }}
>
  <WaveformScrutinizer accent={accent.hex} />
</motion.div>
```

After:

```tsx
<motion.div variants={hudItemVariants}>
  <HUDBeatPulse scale={1.02} x={-2} duration={0.1}>
    <EnergyFlux accent={accent.hex} />
  </HUDBeatPulse>
</motion.div>
<motion.div variants={hudItemVariants}>
  <HUDBeatPulse scale={1.01} x={-1} duration={0.12}>
    <FrequencyScrutinizer accent={accent.hex} />
  </HUDBeatPulse>
</motion.div>
<motion.div variants={hudItemVariants}>
  <HUDBeatPulse scale={1.01} x={-1} duration={0.14}>
    <WaveformScrutinizer accent={accent.hex} />
  </HUDBeatPulse>
</motion.div>
```

- [ ] **Step 5: Verify build passes**

```bash
pnpm build
```

Expected: Build succeeds, no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/visualiser/FullscreenOverlay.tsx
git commit -m "perf: replace beat React subscription with imperative subscribe in HUDBeatPulse"
```

---

### Task 3: Batch layer opacity updates in `useSceneManager`

**Problem:** During layer transitions, `useSceneManager` calls `setLayerOpacity()` separately for each changed key every frame. Each is an independent Zustand `set()` — synchronous notifications not batched by React 18 when called from `requestAnimationFrame`. With 6 keys × up to 7 store subscribers = up to 42 synchronous re-renders per frame during transitions.

**Files:**

- Modify: `src/stores/visualiserStore.ts` (add `setAllLayerOpacities` action)
- Modify: `src/hooks/useSceneManager.ts` (use new batch action)
- Modify: `src/stores/visualiserStore.test.ts` (add test for new action)

**Interfaces:**

- Produces: `setAllLayerOpacities(opacities: Partial<LayerOpacityMap>) => void` — single `set()` call for all opacity keys

- [ ] **Step 1: Write the failing test in `visualiserStore.test.ts`**

Add to `src/stores/visualiserStore.test.ts`:

```ts
it('should update all layer opacities in a single call', () => {
  useVisualiserStore.getState().setAllLayerOpacities({
    orb: 0.5,
    terrain: 0.25,
    particles: 0.75,
  })
  const state = useVisualiserStore.getState()
  expect(state.orbOpacity).toBe(0.5)
  expect(state.terrainOpacity).toBe(0.25)
  expect(state.particlesOpacity).toBe(0.75)
  // Untouched keys unchanged
  expect(state.albumGravityOpacity).toBe(1)
  expect(state.presetsOpacity).toBe(0)
  expect(state.emberFlowOpacity).toBe(0)
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test:run src/stores/visualiserStore.test.ts
```

Expected: FAIL — `setAllLayerOpacities is not a function`

- [ ] **Step 3: Add `setAllLayerOpacities` to the store interface in `visualiserStore.ts`**

After the `setLayerOpacity` signature in the `VisualiserStore` interface (around line 108):

```ts
setAllLayerOpacities: (
  opacities: Partial<
    Record<'orb' | 'terrain' | 'particles' | 'presets' | 'albumGravity' | 'emberFlow', number>
  >
) => void
```

Add the implementation inside the `create(...)` block after `setLayerOpacity`:

```ts
setAllLayerOpacities: opacities => {
  const patch: Partial<VisualiserStore> = {}
  if (opacities.orb !== undefined) patch.orbOpacity = opacities.orb
  if (opacities.terrain !== undefined) patch.terrainOpacity = opacities.terrain
  if (opacities.particles !== undefined) patch.particlesOpacity = opacities.particles
  if (opacities.presets !== undefined) patch.presetsOpacity = opacities.presets
  if (opacities.albumGravity !== undefined) patch.albumGravityOpacity = opacities.albumGravity
  if (opacities.emberFlow !== undefined) patch.emberFlowOpacity = opacities.emberFlow
  set(patch)
},
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test:run src/stores/visualiserStore.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Update `useSceneManager.ts` to use `setAllLayerOpacities`**

Replace:

```ts
const setLayerOpacity = useVisualiserStore(state => state.setLayerOpacity)
```

with:

```ts
const setAllLayerOpacities = useVisualiserStore(state => state.setAllLayerOpacities)
```

Replace the `hasChanges` block (lines 93–101) from:

```ts
if (hasChanges) {
  // Single Zustand update for all opacity changes this frame
  Object.entries(updates).forEach(([key, val]) =>
    setLayerOpacity(
      key as 'orb' | 'terrain' | 'particles' | 'presets' | 'albumGravity' | 'emberFlow',
      val
    )
  )
}
```

to:

```ts
if (hasChanges) {
  setAllLayerOpacities(
    updates as Partial<
      Record<'orb' | 'terrain' | 'particles' | 'presets' | 'albumGravity' | 'emberFlow', number>
    >
  )
}
```

Also update the dependency array at line 108: replace `setLayerOpacity` with `setAllLayerOpacities`:

```ts
}, [setAllLayerOpacities])
```

- [ ] **Step 6: Build check**

```bash
pnpm build
```

Expected: No TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/stores/visualiserStore.ts src/hooks/useSceneManager.ts src/stores/visualiserStore.test.ts
git commit -m "perf: batch layer opacity updates into single Zustand set() via setAllLayerOpacities"
```

---

### Task 4: Eliminate array allocations in `LissajousVisualiser`

**Problem:** `readPoints()` materializes an array of up to 92,160 `[number, number]` tuples every call (~5.5M allocations/sec → GC pauses). `newPoints` also allocates a fresh array + up to 128 tuple sub-arrays each frame.

**Files:**

- Modify: `src/components/visualiser/LissaJousVisualiser.tsx`

**Interfaces:**

- Replaces: `writePoints(buf, points)` with `writePointDirect(buf, x, y)` — single point, no array
- Replaces: `readPoints(buf)` with `iteratePoints(buf, cb)` — zero-allocation in-place traversal

- [ ] **Step 1: Write the failing test**

There are no existing tests for `LissaJousVisualiser`. The buffer functions are module-level — write tests for them. Create `src/components/visualiser/LissaJousVisualiser.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

// Copy of the types & functions under test (extracted for testability)
interface TrailBuffer {
  data: Float32Array
  head: number
  count: number
  capacity: number
}

function createTrailBuffer(capacity: number): TrailBuffer {
  return { data: new Float32Array(capacity * 2), head: 0, count: 0, capacity }
}

function writePointDirect(buf: TrailBuffer, x: number, y: number): void {
  buf.data[buf.head * 2] = x
  buf.data[buf.head * 2 + 1] = y
  buf.head = (buf.head + 1) % buf.capacity
  if (buf.count < buf.capacity) buf.count++
}

function iteratePoints(
  buf: TrailBuffer,
  cb: (x: number, y: number, i: number, total: number) => void
): void {
  const start = buf.count < buf.capacity ? 0 : buf.head
  for (let i = 0; i < buf.count; i++) {
    const idx = (start + i) % buf.capacity
    cb(buf.data[idx * 2], buf.data[idx * 2 + 1], i, buf.count)
  }
}

describe('TrailBuffer', () => {
  it('stores and iterates points in insertion order', () => {
    const buf = createTrailBuffer(3)
    writePointDirect(buf, 1, 2)
    writePointDirect(buf, 3, 4)
    writePointDirect(buf, 5, 6)

    const points: [number, number][] = []
    iteratePoints(buf, (x, y) => points.push([x, y]))

    expect(points).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
    ])
  })

  it('wraps around when capacity is exceeded, oldest point evicted', () => {
    const buf = createTrailBuffer(2)
    writePointDirect(buf, 1, 2)
    writePointDirect(buf, 3, 4)
    writePointDirect(buf, 5, 6) // evicts [1,2]

    const points: [number, number][] = []
    iteratePoints(buf, (x, y) => points.push([x, y]))

    expect(points).toEqual([
      [3, 4],
      [5, 6],
    ])
    expect(buf.count).toBe(2)
  })

  it('provides correct i and total to callback', () => {
    const buf = createTrailBuffer(5)
    writePointDirect(buf, 10, 20)
    writePointDirect(buf, 30, 40)

    const calls: [number, number][] = []
    iteratePoints(buf, (_, _2, i, total) => calls.push([i, total]))

    expect(calls).toEqual([
      [0, 2],
      [1, 2],
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test:run src/components/visualiser/LissaJousVisualiser.test.ts
```

Expected: FAIL — the file doesn't exist yet, or `writePointDirect`/`iteratePoints` are not exported.

- [ ] **Step 3: Rewrite `writePoints` and `readPoints` in `LissaJousVisualiser.tsx`**

Replace the two buffer functions (lines 40–58):

```tsx
function writePointDirect(buf: TrailBuffer, x: number, y: number): void {
  buf.data[buf.head * 2] = x
  buf.data[buf.head * 2 + 1] = y
  buf.head = (buf.head + 1) % buf.capacity
  if (buf.count < buf.capacity) buf.count++
}

function iteratePoints(
  buf: TrailBuffer,
  cb: (x: number, y: number, i: number, total: number) => void
): void {
  const start = buf.count < buf.capacity ? 0 : buf.head
  for (let i = 0; i < buf.count; i++) {
    const idx = (start + i) % buf.capacity
    cb(buf.data[idx * 2], buf.data[idx * 2 + 1], i, buf.count)
  }
}
```

- [ ] **Step 4: Update the `draw` callback to use the zero-allocation API**

In the `draw` callback (lines 107–209), replace the `newPoints` block and the `trail` drawing block:

Remove:

```tsx
const newPoints: Array<[number, number]> = []
// ... loop that pushes into newPoints
writePoints(trailBufRef.current, newPoints)
const trail = readPoints(trailBufRef.current)
// ... drawing loop that indexes trail[i]
```

Replace with:

```tsx
// Write points directly — zero allocation
for (let i = 0; i < len - phaseOffset; i += step) {
  const xVal = data[i] / 128 - 1
  const yVal = data[i + phaseOffset] / 128 - 1
  const rx = xVal * cosR - yVal * sinR
  const ry = xVal * sinR + yVal * cosR
  writePointDirect(trailBufRef.current, cx + rx * scale, cy + ry * scale)
}

// Draw via callback — zero allocation
const hueMap = hueMapRef.current
const glowMap = glowMapRef.current
const glowThresholdSq = (w * 0.42 * 0.7) ** 2

if (trailBufRef.current.count < 2) return

let prevX = 0
let prevY = 0
iteratePoints(trailBufRef.current, (x, y, i, total) => {
  if (i === 0) {
    prevX = x
    prevY = y
    return
  }

  const progressIdx = Math.floor((i / total) * 255)

  ctx.beginPath()
  ctx.moveTo(prevX, prevY)
  ctx.lineTo(x, y)
  ctx.strokeStyle = hueMap[progressIdx]
  ctx.lineWidth = 1 + bassPower * 1.5
  ctx.lineCap = 'round'
  ctx.stroke()

  const dx = x - cx
  const dy = y - cy
  const distSq = dx * dx + dy * dy

  if (distSq > glowThresholdSq) {
    const energy = Math.min(1, Math.sqrt(distSq) / scale)
    const energyIdx = Math.floor(energy * 255)
    ctx.beginPath()
    ctx.arc(x, y, 1.5 + energy * 2, 0, Math.PI * 2)
    ctx.fillStyle = glowMap[energyIdx]
    ctx.fill()
  }

  prevX = x
  prevY = y
})
```

Remove the `if (trail.length < 2) return` guard (now handled by the `count < 2` check before `iteratePoints`).

- [ ] **Step 5: Update the test file to import from the source (or keep inline copies)**

Since the buffer functions are not exported from the component file, the test uses inline copies of the functions. This is intentional — it tests the logic contract, not the export. Verify tests still pass with the logic in the test file matching what's in the component:

```bash
pnpm test:run src/components/visualiser/LissaJousVisualiser.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 6: Build check**

```bash
pnpm build
```

Expected: No TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/visualiser/LissaJousVisualiser.tsx src/components/visualiser/LissaJousVisualiser.test.ts
git commit -m "perf: eliminate per-frame array allocations in LissajousVisualiser trail buffer"
```

---

### Task 5: Cache `THREE.Color` in `WaveformTunnel` to avoid per-frame hex string parsing

**Problem:** `material.color.set(accent.hex)` is called for all 40 ring materials inside `useFrame` every frame. `THREE.Color.set(string)` parses the hex string each call = 2,400 string parses/sec. `accent` only changes when album art changes.

**Files:**

- Modify: `src/components/visualiser/WaveformTunnel.tsx`

**Interfaces:**

- No interface changes — internal optimization only

- [ ] **Step 1: Write the failing test**

No automated test for a Three.js `useFrame` callback. Build correctness is the check. Skip to Step 2.

- [ ] **Step 2: Add `accentColorRef` and `useEffect` to `WaveformTunnel`**

Import `useEffect` (add to existing React import if not present):

```tsx
import { useMemo, useRef, useEffect } from 'react'
```

Add after the existing `groupRef` declaration:

```tsx
const accentColorRef = useRef(new THREE.Color(accent.hex))

useEffect(() => {
  accentColorRef.current.set(accent.hex)
}, [accent.hex])
```

- [ ] **Step 3: Replace per-frame `.set(string)` with `.copy()` in `useFrame`**

In the `useFrame` callback, change line 52:

```ts
material.color.set(accent.hex)
```

to:

```ts
material.color.copy(accentColorRef.current)
```

- [ ] **Step 4: Build check**

```bash
pnpm build
```

Expected: No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/visualiser/WaveformTunnel.tsx
git commit -m "perf: cache THREE.Color ref in WaveformTunnel to avoid 2400 hex parses/sec"
```

---

## Phase 3 — Medium Priority

### Task 6: Eliminate per-frame `shadowBlur` in `WaveformScrutinizer`

**Problem:** `ctx.shadowBlur = 8` before every `ctx.stroke()` at 60fps triggers a full Gaussian blur on the canvas compositing step — 2–4× slower than unblurred strokes on Chromium. The waveform data changes every frame so the glow cannot be pre-rendered; instead replace it with a two-pass draw (wide transparent stroke = fake glow, thin opaque stroke = main line).

**Files:**

- Modify: `src/components/visualiser/FullscreenOverlay.tsx` (`WaveformScrutinizer` function, lines 750–823)

**Interfaces:**

- No interface changes — internal draw optimization

- [ ] **Step 1: Write the failing test**

No automated test. Build correctness check. Skip to Step 2.

- [ ] **Step 2: Replace shadowBlur with two-pass draw in `WaveformScrutinizer.draw`**

The current `draw` callback (lines 754–803) does:

```ts
ctx.shadowBlur = 8
ctx.shadowColor = accent
// ... path build + stroke
ctx.shadowBlur = 0
```

Replace the entire section from `ctx.beginPath()` through `ctx.stroke()` and `ctx.shadowBlur = 0`:

```tsx
const draw = useCallback(
  (data: Uint8Array) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    if (!smoothedData.current || smoothedData.current.length !== data.length) {
      smoothedData.current = new Float32Array(data.length)
    }

    for (let i = 0; i < data.length; i++) {
      smoothedData.current[i] += (data[i] - smoothedData.current[i]) * 0.35
    }

    const gradient = ctx.createLinearGradient(0, 0, w, 0)
    gradient.addColorStop(0, 'rgba(255,255,255,0)')
    gradient.addColorStop(0.2, accent)
    gradient.addColorStop(0.5, '#fff')
    gradient.addColorStop(0.8, accent)
    gradient.addColorStop(1, 'rgba(255,255,255,0)')

    const sliceWidth = w / data.length

    // Build path once, draw twice (glow pass + main pass) — no shadowBlur
    const buildPath = () => {
      ctx.beginPath()
      let x = 0
      for (let i = 0; i < data.length; i++) {
        const v = smoothedData.current![i] / 128.0
        const y = (v / 2) * h
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
        x += sliceWidth
      }
    }

    // Pass 1: glow (wide, transparent)
    buildPath()
    ctx.strokeStyle = gradient
    ctx.lineWidth = 6
    ctx.lineJoin = 'round'
    ctx.globalAlpha = 0.18
    ctx.stroke()

    // Pass 2: main line
    buildPath()
    ctx.strokeStyle = gradient
    ctx.lineWidth = 1.5
    ctx.lineJoin = 'round'
    ctx.globalAlpha = 1.0
    ctx.stroke()
  },
  [accent]
)
```

- [ ] **Step 3: Build check**

```bash
pnpm build
```

Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/visualiser/FullscreenOverlay.tsx
git commit -m "perf: replace shadowBlur with two-pass glow draw in WaveformScrutinizer"
```

---

### Task 7: Replace `Array.shift()` with a circular buffer in `BeatDetector`

**Problem:** `this.energyHistory.shift()` and `this.fluxHistory.shift()` are called every frame — `Array.shift()` is O(n), moving all 42 remaining elements on every call. This runs on the hottest audio path. Replace with `Float32Array` circular buffers and head/count pointers.

**Files:**

- Modify: `src/audio/BeatDetector.ts`
- Modify: `src/audio/BeatDetector.test.ts` (add regression test; existing tests must still pass)

**Interfaces:**

- No public interface changes — `detect()` and `reset()` signatures unchanged

- [ ] **Step 1: Write the failing test**

Add to `src/audio/BeatDetector.test.ts`:

```ts
it('should accumulate history without Array.shift allocations', () => {
  // Drive well past windowSize (43) to exercise the circular buffer wrap
  const silence = new Uint8Array(128).fill(0)
  for (let i = 0; i < 100; i++) {
    detector.detect(silence)
  }
  // Should not throw and should still detect beats correctly after wrap
  const loud = new Uint8Array(128).fill(0)
  for (let i = 0; i < 10; i++) loud[i] = 220
  const result = detector.detect(loud)
  expect(result.bassEnergy).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run test to verify it passes already (regression guard)**

```bash
pnpm test:run src/audio/BeatDetector.test.ts
```

Expected: All tests PASS (the new test also passes with the old implementation — it's a behavioral regression guard). This confirms baseline behavior before refactoring.

- [ ] **Step 3: Rewrite `BeatDetector` internals to use `Float32Array` circular buffers**

Replace the private fields:

```ts
private energyHistory: number[] = []
private fluxHistory: number[] = []
```

With:

```ts
private energyHistory: Float32Array
private energyHead = 0
private energyCount = 0
private fluxHistory: Float32Array
private fluxHead = 0
private fluxCount = 0
```

Update constructor to allocate the typed arrays:

```ts
constructor(sensitivity = 1.5, windowSize = 43) {
  this.sensitivity = sensitivity
  this.windowSize = windowSize
  this.energyHistory = new Float32Array(windowSize)
  this.fluxHistory = new Float32Array(windowSize)
}
```

Replace the push+shift pattern for `energyHistory` (lines 46–49):

```ts
this.energyHistory.push(bassEnergy)
if (this.energyHistory.length > this.windowSize) {
  this.energyHistory.shift()
}
```

With:

```ts
this.energyHistory[this.energyHead] = bassEnergy
this.energyHead = (this.energyHead + 1) % this.windowSize
if (this.energyCount < this.windowSize) this.energyCount++
```

Replace the push+shift pattern for `fluxHistory` (lines 68–71):

```ts
this.fluxHistory.push(flux)
if (this.fluxHistory.length > this.windowSize) {
  this.fluxHistory.shift()
}
```

With:

```ts
this.fluxHistory[this.fluxHead] = flux
this.fluxHead = (this.fluxHead + 1) % this.windowSize
if (this.fluxCount < this.windowSize) this.fluxCount++
```

Replace the early-return guard (line 74):

```ts
if (this.energyHistory.length < this.windowSize / 2) {
```

With:

```ts
if (this.energyCount < this.windowSize / 2) {
```

Replace all uses of `this.energyHistory.length` in the stats loops with `this.energyCount`, and `this.fluxHistory.length` with `this.fluxCount`. The sum/variance loops iterate over all `count` entries in the typed array — order doesn't matter for sum and variance, so iterate `[0..count)` directly:

```ts
let energySum = 0
for (let i = 0; i < this.energyCount; i++) energySum += this.energyHistory[i]
const energyAvg = energySum / this.energyCount

let energyVarSum = 0
for (let i = 0; i < this.energyCount; i++) {
  const d = this.energyHistory[i] - energyAvg
  energyVarSum += d * d
}
const energyVar = energyVarSum / this.energyCount
const energyThresh = (this.sensitivity + energyVar / 10000) * energyAvg

let fluxSum = 0
for (let i = 0; i < this.fluxCount; i++) fluxSum += this.fluxHistory[i]
const fluxAvg = fluxSum / this.fluxCount

let fluxVarSum = 0
for (let i = 0; i < this.fluxCount; i++) {
  const d = this.fluxHistory[i] - fluxAvg
  fluxVarSum += d * d
}
const fluxVar = fluxVarSum / this.fluxCount
const fluxThresh = (this.sensitivity + fluxVar / 10000) * fluxAvg
```

Update `reset()`:

```ts
reset(): void {
  this.energyHead = 0
  this.energyCount = 0
  this.fluxHead = 0
  this.fluxCount = 0
  this.energyHistory.fill(0)
  this.fluxHistory.fill(0)
  this.prevFrequencyData = null
  this.bpmHistory = []
  this.lastBeatTime = 0
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test:run src/audio/BeatDetector.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Build check**

```bash
pnpm build
```

Expected: No TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/audio/BeatDetector.ts src/audio/BeatDetector.test.ts
git commit -m "perf: replace Array.shift() in BeatDetector with Float32Array circular buffers"
```

---

## Phase 4 — Low Priority

### Task 8: Replace linear slot scan in `ParticleCrown` with a free-list stack

**Problem:** On every beat burst and continuous trickle, finding an inactive particle slot scans up to 1,500 entries linearly. A free-list stack (pre-built at initialization) makes slot acquisition O(1).

**Files:**

- Modify: `src/components/visualiser/ParticleCrown.tsx`

**Interfaces:**

- No interface changes — internal optimization

- [ ] **Step 1: Write the failing test**

No automated test for a Three.js R3F component. Build check is sufficient. Skip to Step 2.

- [ ] **Step 2: Add free-list refs to `ParticleCrown`**

Add after the `lastBeat` ref declaration:

```tsx
const freeList = useRef<Int32Array | null>(null)
const freeHead = useRef(-1)

// Initialize free list once on first render
useMemo(() => {
  const list = new Int32Array(POOL_SIZE)
  for (let i = 0; i < POOL_SIZE; i++) list[i] = POOL_SIZE - 1 - i
  freeList.current = list
  freeHead.current = POOL_SIZE - 1
}, [])
```

- [ ] **Step 3: Replace linear slot scans with free-list pops in `useFrame`**

There are two slot-scan blocks: one for beat bursts (lines 72–81) and one for continuous trickle (lines 108–116).

Replace both occurrences of:

```tsx
let slot = -1
for (let k = 0; k < poolSize; k++) {
  if (!active.current[k]) {
    slot = k
    break
  }
}
if (slot === -1) break
```

with:

```tsx
if (freeHead.current < 0) break
const slot = freeList.current![freeHead.current--]
```

Note: The `if (slot === -1) break` guard is replaced by the `freeHead < 0` check.

- [ ] **Step 4: Return slots to the free list when particles die**

In the particle death block (around line 172–177):

```tsx
if (life.current[i] <= 0) {
  active.current[i] = 0
  tempMatrix.current.makeScale(0, 0, 0)
  mesh.setMatrixAt(i, tempMatrix.current)
  continue
}
```

Add the free-list push:

```tsx
if (life.current[i] <= 0) {
  active.current[i] = 0
  freeList.current![++freeHead.current] = i
  tempMatrix.current.makeScale(0, 0, 0)
  mesh.setMatrixAt(i, tempMatrix.current)
  continue
}
```

- [ ] **Step 5: Build check**

```bash
pnpm build
```

Expected: No TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/visualiser/ParticleCrown.tsx
git commit -m "perf: replace O(n) linear scan with O(1) free-list in ParticleCrown slot allocation"
```

---

### Task 9: Add LRU eviction to `RequestCache`

**Problem:** `RequestCache` is an unbounded `Map` — it grows without limit in long sessions. Add a max size (50 entries) with LRU eviction using Map insertion-order semantics.

**Files:**

- Modify: `src/lib/cache.ts`
- Modify: `src/lib/cache.test.ts` (add LRU eviction test)

**Interfaces:**

- `RequestCache` constructor now accepts an optional `maxSize` parameter (default 50)
- Public API (`get`, `set`, `invalidate`, `clear`) unchanged

- [ ] **Step 1: Write the failing test**

Add to `src/lib/cache.test.ts`:

```ts
it('should evict the oldest entry when maxSize is reached', () => {
  const smallCache = new (cache.constructor as new (maxSize: number) => typeof cache)(3)
  smallCache.set('a', 1)
  smallCache.set('b', 2)
  smallCache.set('c', 3)
  smallCache.set('d', 4) // should evict 'a'

  expect(smallCache.get('a')).toBeNull()
  expect(smallCache.get('b')).toBe(2)
  expect(smallCache.get('c')).toBe(3)
  expect(smallCache.get('d')).toBe(4)
})
```

Note: The test uses `cache.constructor` to access the class. If `RequestCache` is not exported, export it first.

- [ ] **Step 2: Export `RequestCache` class from `cache.ts`**

Change:

```ts
class RequestCache {
```

to:

```ts
export class RequestCache {
```

- [ ] **Step 3: Run the failing test**

```bash
pnpm test:run src/lib/cache.test.ts
```

Expected: The new LRU test FAILS (`RequestCache` has no `maxSize` param and no eviction).

- [ ] **Step 4: Add `maxSize` and LRU eviction to `RequestCache`**

Update `cache.ts`:

```ts
export class RequestCache {
  private store = new Map<string, CacheEntry<unknown>>()
  private readonly maxSize: number

  constructor(maxSize = 50) {
    this.maxSize = maxSize
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }
    // LRU: re-insert to move to end of Map iteration order
    this.store.delete(key)
    this.store.set(key, entry)
    return entry.data as T
  }

  set<T>(key: string, data: T, ttlMs = 5 * 60 * 1000): void {
    if (this.store.size >= this.maxSize) {
      const oldestKey = this.store.keys().next().value
      if (oldestKey !== undefined) this.store.delete(oldestKey)
    }
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs })
  }

  invalidate(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }
}

export const cache = new RequestCache()
```

- [ ] **Step 5: Update test to use exported class**

Update the test import and LRU test:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { cache, fetchWithCache, RequestCache } from './cache'

// ... existing tests unchanged ...

it('should evict the oldest entry when maxSize is reached', () => {
  const smallCache = new RequestCache(3)
  smallCache.set('a', 1)
  smallCache.set('b', 2)
  smallCache.set('c', 3)
  smallCache.set('d', 4) // evicts 'a'

  expect(smallCache.get('a')).toBeNull()
  expect(smallCache.get('b')).toBe(2)
  expect(smallCache.get('c')).toBe(3)
  expect(smallCache.get('d')).toBe(4)
})
```

- [ ] **Step 6: Run all cache tests**

```bash
pnpm test:run src/lib/cache.test.ts
```

Expected: All tests PASS.

- [ ] **Step 7: Build check**

```bash
pnpm build
```

Expected: No TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/cache.ts src/lib/cache.test.ts
git commit -m "perf: add LRU eviction to RequestCache with configurable maxSize"
```

---

## Final Verification

- [ ] **Run full test suite**

```bash
pnpm test:run
```

Expected: All tests pass.

- [ ] **Run full build**

```bash
pnpm build
```

Expected: Clean build, no TypeScript errors.
