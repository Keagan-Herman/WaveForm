# Quick Wins & Code Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 high-value, low-risk issues — 1-liners through ~10 lines each — that improve correctness, accessibility, and visual quality with minimal risk of regression.

**Architecture:** Surgical edits to existing files only. No new files. Each task is independently deployable.

**Tech Stack:** TypeScript, React, D3, Framer Motion, Zustand, Vitest

## Global Constraints

- TypeScript strict mode — no `any`, no `@ts-ignore`
- No `border-radius` above 4px on any element
- No glassmorphism (`backdrop-filter`) as decoration on resting elements
- All Deezer API calls go through `deezerFetch` in `src/lib/deezerApi.ts`
- Use `pnpm`, not `npm` or `yarn`
- Run `pnpm build` after each task to confirm zero TS errors

---

### Task 1: Fix GenreForceGraph — alphaDecay, drag cursors, simulation restart throttle

**Files:**

- Modify: `src/components/library/GenreForceGraph.tsx`

**Interfaces:**

- Produces: nothing consumed by other tasks — self-contained

**Context:** Three fixes in one file.

1. `alphaDecay(0.03)` at line 114 makes the D3 simulation run for ~20 seconds per search. Raising it to `0.08` cuts that to ~8 seconds without visible quality loss.
2. Drag nodes have `cursor: pointer` (line 229) but no grab/grabbing feedback during drag.
3. Line 156 calls `simulation.alphaTarget(0.3).restart()` on every drag start — this is correct — but the data update effect (line 184) also calls `simulation.alpha(0.3).restart()` with no throttle, so rapid search queries thrash the simulation.

- [ ] **Step 1: Fix alphaDecay**

In `src/components/library/GenreForceGraph.tsx`, find line 114:

```ts
.alphaDecay(0.03) // slower decay = more time to settle
```

Change to:

```ts
.alphaDecay(0.08) // balanced: settles in ~8s without visible quality loss
```

- [ ] **Step 2: Add grab/grabbing cursor to drag behaviour**

Find the drag behaviour setup (around line 153). The `.on('start', ...)` handler sets `d.fx = d.x`. Add cursor updates:

```ts
const drag = d3
  .drag<SVGCircleElement, GenreNode>()
  .on('start', (event, d) => {
    if (!event.active) simulation.alphaTarget(0.3).restart()
    d.fx = d.x
    d.fy = d.y
    d3.select(event.sourceEvent.target as SVGCircleElement).style('cursor', 'grabbing')
  })
  .on('drag', (event, d) => {
    d.fx = event.x
    d.fy = event.y
  })
  .on('end', (event, d) => {
    if (!event.active) simulation.alphaTarget(0)
    d.fx = null
    d.fy = null
    d3.select(event.sourceEvent.target as SVGCircleElement).style('cursor', 'grab')
  })
```

Also change the `nodeEnter` cursor from `pointer` to `grab` at line 229:

```ts
.style('cursor', 'grab')
```

- [ ] **Step 3: Throttle data-effect simulation restart**

Find the top of the data update `useEffect` (around line 184). Add a throttle ref above the component's return (outside the effect, at component scope):

```ts
const lastSimRestartRef = useRef(0)
```

Then inside the data effect, find the existing `simulation.alpha(0.3).restart()` call (near the bottom of the effect). Replace it with:

```ts
const now = Date.now()
if (now - lastSimRestartRef.current > 100) {
  simulation.alpha(0.3).restart()
  lastSimRestartRef.current = now
}
```

- [ ] **Step 4: Verify build**

```bash
pnpm build
```

Expected: no TypeScript errors, no new warnings.

- [ ] **Step 5: Manual verification**
- Open the app with `vercel dev`
- Perform a search; watch the genre topology map — nodes should settle within ~8 seconds
- Drag a genre node — cursor should show `grab` at rest, `grabbing` while held
- Perform 3 rapid searches — simulation should not thrash

- [ ] **Step 6: Commit**

```bash
git add src/components/library/GenreForceGraph.tsx
git commit -m "perf: tune D3 simulation — alphaDecay, drag cursors, restart throttle"
```

---

### Task 2: Remove glassmorphism from VisualisersPanel idle overlay

**Files:**

- Modify: `src/components/layout/VisualisersPanel.tsx`

**Context:** `idleOverlay` has `backdropFilter: 'blur(20px)'` — this is GPU-expensive and violates the design system rule ("Glassmorphism as default — prohibited"). The previous impeccable pass removed it from `canvasBlock` but the overlay still has it. Replace with a tonal background fill.

- [ ] **Step 1: Replace backdropFilter with a tonal fill**

In `src/components/layout/VisualisersPanel.tsx`, find the `idleOverlay` style:

```ts
idleOverlay: {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backdropFilter: 'blur(20px)',
  pointerEvents: 'none',
  zIndex: 5,
},
```

Replace with:

```ts
idleOverlay: {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(13,13,13,0.85)',
  pointerEvents: 'none',
  zIndex: 5,
},
```

- [ ] **Step 2: Verify build**

```bash
pnpm build
```

- [ ] **Step 3: Manual verification**
- Without a track playing, the "Select a track to visualise" overlay should appear with an opaque dark tint rather than a blurred overlay. No perceptible quality loss.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/VisualisersPanel.tsx
git commit -m "fix: replace glassmorphism idle overlay with tonal fill"
```

---

### Task 3: Add Deezer API error type guard

**Files:**

- Modify: `src/lib/deezerApi.ts`
- Test: `src/lib/deezerApi.test.ts` (create)

**Context:** `deezerFetch` at line 86 accesses `data.error.code` and `data.error.message` without validating the shape. If Deezer returns `{ error: "string" }` or `{ error: { message_only: true } }`, this throws an opaque error.

- [ ] **Step 1: Write the failing test**

Create `src/lib/deezerApi.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// We test the error parsing logic by extracting the type guard
function isDeezerErrorBody(obj: unknown): obj is { error: { code: number; message: string } } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'error' in obj &&
    typeof (obj as Record<string, unknown>).error === 'object' &&
    (obj as Record<string, unknown>).error !== null &&
    'code' in ((obj as Record<string, unknown>).error as object) &&
    'message' in ((obj as Record<string, unknown>).error as object)
  )
}

describe('isDeezerErrorBody', () => {
  it('returns true for a valid Deezer error body', () => {
    expect(isDeezerErrorBody({ error: { code: 800, message: 'No data' } })).toBe(true)
  })

  it('returns false when error is a string', () => {
    expect(isDeezerErrorBody({ error: 'something went wrong' })).toBe(false)
  })

  it('returns false when error lacks code', () => {
    expect(isDeezerErrorBody({ error: { message: 'No data' } })).toBe(false)
  })

  it('returns false when error is null', () => {
    expect(isDeezerErrorBody({ error: null })).toBe(false)
  })

  it('returns false when there is no error key', () => {
    expect(isDeezerErrorBody({ data: [] })).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails (function not exported yet)**

```bash
pnpm test:run src/lib/deezerApi.test.ts
```

Expected: FAIL — `isDeezerErrorBody` is not importable from the module.

- [ ] **Step 3: Add the type guard to deezerApi.ts and use it**

In `src/lib/deezerApi.ts`, add above `deezerFetch`:

```ts
function isDeezerErrorBody(obj: unknown): obj is { error: { code: number; message: string } } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'error' in obj &&
    typeof (obj as Record<string, unknown>).error === 'object' &&
    (obj as Record<string, unknown>).error !== null &&
    'code' in ((obj as Record<string, unknown>).error as object) &&
    'message' in ((obj as Record<string, unknown>).error as object)
  )
}
```

Replace the existing error check in `deezerFetch`:

```ts
// Before:
if (data.error) {
  throw new Error(`Deezer error ${data.error.code}: ${data.error.message}`)
}
// After:
if (isDeezerErrorBody(data)) {
  throw new Error(`Deezer error ${data.error.code}: ${data.error.message}`)
} else if (data.error) {
  throw new Error(`Deezer error: ${String(data.error)}`)
}
```

Update the test to import from the actual module — OR export the guard for testing. The simplest approach: export it:

```ts
export function isDeezerErrorBody(obj: unknown): obj is { error: { code: number; message: string } } {
```

Update the test import:

```ts
import { isDeezerErrorBody } from './deezerApi'
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test:run src/lib/deezerApi.test.ts
```

Expected: 5 passing tests.

- [ ] **Step 5: Verify build**

```bash
pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/deezerApi.ts src/lib/deezerApi.test.ts
git commit -m "fix: add type guard for Deezer API error body shape"
```

---

### Task 4: Fix ParticleField quality reactivity

**Files:**

- Modify: `src/components/library/ParticleField.tsx`

**Context:** Line 100 reads `quality` from `useVisualiserStore.getState()` — a one-time read at render time, not a reactive subscription. If quality changes after the component mounts, `actualCount` never updates and the particle count stays stale. Fix: subscribe to `quality` via the Zustand hook.

- [ ] **Step 1: Make quality reactive**

In `src/components/library/ParticleField.tsx`, find line 100:

```ts
const { quality } = useVisualiserStore.getState()
```

Replace with:

```ts
const quality = useVisualiserStore(state => state.quality)
```

This is a component-level hook call (legal — it's at the top of the component body). `actualCount` in the `useMemo` below already depends on `quality`, so it will recalculate correctly when quality changes.

- [ ] **Step 2: Verify build**

```bash
pnpm build
```

- [ ] **Step 3: Manual verification**
- Open fullscreen mode
- Toggle between Low/Medium/Epic quality in Visual Settings
- Particle density should visibly change immediately

- [ ] **Step 4: Commit**

```bash
git add src/components/library/ParticleField.tsx
git commit -m "fix: make ParticleField quality reactive via Zustand hook"
```
