# Performance Optimizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate three concrete frame-rate and memory issues: LissajousVisualiser GC churn from per-frame array spread, EffectComposer multisampling cost on Epic, and the idle overlay's GPU-expensive backdrop-filter (if not already done by quick-wins plan).

**Architecture:** Each fix is isolated to a single file. No new abstractions. No new files. All changes stay within the existing render loop model — rAF canvas or R3F useFrame.

**Tech Stack:** TypeScript, React, Three.js / React Three Fiber, @react-three/postprocessing, Vitest

## Global Constraints

- Raw audio data (`Uint8Array`) must never enter React state or Zustand
- `AudioEngine` is a singleton — never `new AudioEngine()`
- R3F `useFrame` reads store state imperatively via `getState()`, not React subscriptions
- No `border-radius` above 4px; no decorative `backdrop-filter`
- Use `pnpm`, not `npm` or `yarn`
- Run `pnpm build` after every task

---

### Task 1: LissajousVisualiser — replace trail spread with circular buffer

**Files:**

- Modify: `src/components/visualiser/LissaJousVisualiser.tsx`

**Context:** Line 115 builds the trail with:

```ts
trailRef.current = [...newPoints, ...trailRef.current].slice(0, maxTrail * newPoints.length)
```

`newPoints` is an array of `[number, number]` tuples produced each frame. At 60fps with `bassPower` near 1, `maxTrail` = 180 and `newPoints.length` ≈ 512, giving a trail of ~92k tuples. Spread-and-slice allocates a new array every frame — pure GC pressure. A circular buffer reuses the same memory.

**Interfaces:**

- Produces: nothing consumed by other tasks

- [ ] **Step 1: Add circular buffer types and helpers at the top of the file**

After the existing imports in `src/components/visualiser/LissaJousVisualiser.tsx`, add:

```ts
// Circular buffer for trail points — avoids per-frame array allocation
interface TrailBuffer {
  data: Float32Array // interleaved [x0, y0, x1, y1, ...]
  head: number // index of the next write slot (in point units)
  count: number // number of valid points currently stored
  capacity: number // max points the buffer can hold
}

function createTrailBuffer(capacity: number): TrailBuffer {
  return { data: new Float32Array(capacity * 2), head: 0, count: 0, capacity }
}

function writePoints(buf: TrailBuffer, points: Array<[number, number]>): void {
  for (const [x, y] of points) {
    buf.data[buf.head * 2] = x
    buf.data[buf.head * 2 + 1] = y
    buf.head = (buf.head + 1) % buf.capacity
    if (buf.count < buf.capacity) buf.count++
  }
}

// Returns points in order from oldest to newest
function readPoints(buf: TrailBuffer): Array<[number, number]> {
  const result: Array<[number, number]> = new Array(buf.count)
  const start = buf.count < buf.capacity ? 0 : buf.head
  for (let i = 0; i < buf.count; i++) {
    const idx = (start + i) % buf.capacity
    result[i] = [buf.data[idx * 2], buf.data[idx * 2 + 1]]
  }
  return result
}
```

- [ ] **Step 2: Replace trailRef with a TrailBuffer ref**

Find the existing trail ref declaration (near the top of the component, something like):

```ts
const trailRef = useRef<Array<[number, number]>>([])
```

Replace with:

```ts
const TRAIL_CAPACITY = 180 * 512 // maxTrail * max newPoints per frame
const trailBufRef = useRef<TrailBuffer>(createTrailBuffer(TRAIL_CAPACITY))
```

- [ ] **Step 3: Update the draw callback to use the buffer**

Find this block in the draw callback (around line 113–115):

```ts
const maxTrail = Math.floor(60 + bassPower * 120)
trailRef.current = [...newPoints, ...trailRef.current].slice(0, maxTrail * newPoints.length)
```

Replace with:

```ts
writePoints(trailBufRef.current, newPoints)
const trail = readPoints(trailBufRef.current)
```

Then wherever the code iterates `trailRef.current` for drawing (typically the loop starting `for (let i = 1; i < trail.length...)`), change `trailRef.current` to `trail` throughout the draw function.

- [ ] **Step 4: Verify build**

```bash
pnpm build
```

Expected: zero TypeScript errors.

- [ ] **Step 5: Manual verification**
- Open app with `vercel dev`, play a track, open fullscreen, switch to Lissajous visualiser
- Trail should render identically to before — no visual regression
- Chrome DevTools Memory tab: take heap snapshot before and after 10 seconds of playback. GC pauses in the Performance tab should be reduced (fewer short-lived arrays in the minor GC).

- [ ] **Step 6: Commit**

```bash
git add src/components/visualiser/LissaJousVisualiser.tsx
git commit -m "perf: replace LissajousVisualiser trail spread with circular buffer"
```

---

### Task 2: EffectComposer — reduce Epic multisampling and gate on user toggle

**Files:**

- Modify: `src/components/visualiser/FullscreenOverlay.tsx`
- Modify: `src/stores/visualiserStore.ts`

**Context:** `EffectComposer` at line 126 uses `multisampling={quality === 'Epic' ? 8 : 0}`. On a 1440p display, MSAA×8 samples 16M pixels per frame just for the compositor pass. The existing `bloomEnabled`, `godRaysEnabled` etc. flags already let users opt in to expensive effects — multisampling should follow the same pattern. Lower the Epic ceiling to 4 and expose it as a toggle in the store (default off for new users).

**Interfaces:**

- Consumes: `visualiserStore` — existing `quality` field
- Produces: `multisamplingEnabled: boolean` in `visualiserStore`, consumed by Task 3 (VisualSettings UI)

- [ ] **Step 1: Write a store test for the new toggle**

Open `src/stores/visualiserStore.test.ts` and add:

```ts
it('multisamplingEnabled defaults to false', () => {
  const state = useVisualiserStore.getState()
  expect(state.multisamplingEnabled).toBe(false)
})

it('setMultisamplingEnabled toggles the flag', () => {
  useVisualiserStore.getState().setMultisamplingEnabled(true)
  expect(useVisualiserStore.getState().multisamplingEnabled).toBe(true)
  useVisualiserStore.getState().setMultisamplingEnabled(false)
  expect(useVisualiserStore.getState().multisamplingEnabled).toBe(false)
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test:run src/stores/visualiserStore.test.ts
```

Expected: FAIL — `multisamplingEnabled` does not exist on state.

- [ ] **Step 3: Add multisamplingEnabled to visualiserStore**

Open `src/stores/visualiserStore.ts`. Find the interface definition and add:

```ts
multisamplingEnabled: boolean
setMultisamplingEnabled: (enabled: boolean) => void
```

Find the `create(...)` call and add the initial value and setter:

```ts
multisamplingEnabled: false,
setMultisamplingEnabled: (enabled) => set({ multisamplingEnabled: enabled }),
```

Find the `persist` options (the keys array passed to `partialize` or the storage config) and add `'multisamplingEnabled'` so it persists across sessions. It will be alongside the other visual settings like `bloomEnabled`.

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test:run src/stores/visualiserStore.test.ts
```

Expected: all passing.

- [ ] **Step 5: Update EffectComposer in FullscreenOverlay**

In `src/components/visualiser/FullscreenOverlay.tsx`, find where `multisamplingEnabled` (or other store flags) are destructured from the store. Add:

```ts
const multisamplingEnabled = useVisualiserStore(state => state.multisamplingEnabled)
```

Find the `EffectComposer` JSX (around line 126):

```tsx
<EffectComposer
  multisampling={quality === 'Epic' ? 8 : 0}
  frameBufferType={THREE.HalfFloatType}
>
```

Replace with:

```tsx
<EffectComposer
  multisampling={multisamplingEnabled && quality === 'Epic' ? 4 : 0}
  frameBufferType={THREE.HalfFloatType}
>
```

- [ ] **Step 6: Expose the toggle in VisualSettings**

In `src/components/visualiser/VisualSettings.tsx`, find the section that renders `bloomEnabled` checkbox/toggle. Add an identical control below it for `multisamplingEnabled`:

```tsx
<SettingRow label="MSAA (Epic only)" sublabel="4× anti-aliasing — GPU intensive">
  <SettingToggle
    value={multisamplingEnabled}
    onChange={setMultisamplingEnabled}
    accentColor={accentColor}
  />
</SettingRow>
```

Match the exact component names and prop shapes used by the other toggles in that file — read the existing bloom toggle implementation and replicate its structure exactly.

- [ ] **Step 7: Verify build**

```bash
pnpm build
```

- [ ] **Step 8: Manual verification**
- Open fullscreen, open Visual Settings
- MSAA toggle should appear, default off
- Enabling it on Epic quality: the scene should look slightly smoother on aliased edges

- [ ] **Step 9: Commit**

```bash
git add src/stores/visualiserStore.ts src/stores/visualiserStore.test.ts src/components/visualiser/FullscreenOverlay.tsx src/components/visualiser/VisualSettings.tsx
git commit -m "perf: gate EffectComposer MSAA behind user toggle, reduce Epic ceiling 8→4"
```

---

### Task 3: Album art preload on track change

**Files:**

- Create: `src/hooks/usePreloadImage.ts`
- Modify: `src/components/library/NowPlaying.tsx`

**Context:** When a track changes, the album art `<img>` element requests the image reactively, causing a visible white-flash before the image loads. Preloading via `new Image()` primes the browser cache so the `<img>` render hits cache immediately.

**Interfaces:**

- Produces: `usePreloadImage(url: string | null): void` — consumed by `NowPlaying`

- [ ] **Step 1: Write the hook test**

Create `src/hooks/usePreloadImage.test.ts`:

```ts
import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePreloadImage } from './usePreloadImage'

describe('usePreloadImage', () => {
  let imgInstances: { src: string }[]

  beforeEach(() => {
    imgInstances = []
    vi.spyOn(globalThis, 'Image').mockImplementation(() => {
      const img = { src: '' } as HTMLImageElement
      imgInstances.push(img)
      return img
    })
  })

  it('sets src on the Image instance when url is provided', () => {
    renderHook(() => usePreloadImage('https://example.com/cover.jpg'))
    expect(imgInstances[0]?.src).toBe('https://example.com/cover.jpg')
  })

  it('does not create an Image instance when url is null', () => {
    renderHook(() => usePreloadImage(null))
    expect(imgInstances).toHaveLength(0)
  })

  it('updates src when url changes', () => {
    const { rerender } = renderHook(({ url }) => usePreloadImage(url), {
      initialProps: { url: 'https://example.com/a.jpg' as string | null },
    })
    rerender({ url: 'https://example.com/b.jpg' })
    expect(imgInstances[1]?.src).toBe('https://example.com/b.jpg')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test:run src/hooks/usePreloadImage.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

Create `src/hooks/usePreloadImage.ts`:

```ts
import { useEffect } from 'react'

export function usePreloadImage(url: string | null): void {
  useEffect(() => {
    if (!url) return
    const img = new Image()
    img.src = url
  }, [url])
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test:run src/hooks/usePreloadImage.test.ts
```

Expected: 3 passing.

- [ ] **Step 5: Wire into NowPlaying**

In `src/components/library/NowPlaying.tsx`, add the import:

```ts
import { usePreloadImage } from '@/hooks/usePreloadImage'
```

Inside `NowPlaying`, before the early return for the empty state, read the next track from the queue and preload its cover:

```ts
const queue = usePlayerStore(s => s.queue)
const currentTrack = usePlayerStore(state => state.currentTrack)
const currentIdx = currentTrack ? queue.findIndex(t => t.id === currentTrack.id) : -1
const nextTrack = currentIdx >= 0 ? (queue[currentIdx + 1] ?? null) : null
usePreloadImage(nextTrack ? getTrackCover(nextTrack) : null)
```

- [ ] **Step 6: Verify build**

```bash
pnpm build
```

- [ ] **Step 7: Commit**

```bash
git add src/hooks/usePreloadImage.ts src/hooks/usePreloadImage.test.ts src/components/library/NowPlaying.tsx
git commit -m "perf: preload next track album art to eliminate cover flash on track change"
```
