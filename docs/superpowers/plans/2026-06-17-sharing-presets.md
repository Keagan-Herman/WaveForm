# Sharing & Scene Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users save named visual scene configurations and share their current track + scene state via a URL. Also add a pulsing recording indicator to replace the plain text-color change that currently marks recording state.

**Architecture:** Scene presets are persisted in `visualiserStore` (already uses `zustand/middleware/persist`). URL sharing is a pure utility hook — encode/decode a subset of store state to/from `URLSearchParams`. The recording indicator is a self-contained visual tweak inside `FullscreenOverlay`.

**Tech Stack:** TypeScript, React, Framer Motion, Zustand (with persist middleware), Vitest

## Global Constraints

- Raw audio data (`Uint8Array`) must never enter React state or Zustand
- No `border-radius` above 4px; no glassmorphism
- All opacity values for text ≥ 0.45 on `#0d0d0d`
- Use `pnpm`, not `npm` or `yarn`
- Run `pnpm build` after every task
- URL state must be opt-in (not written on every navigation) — only on explicit "Share" action

---

### Task 1: Scene presets — save and recall named visual configurations

**Files:**

- Modify: `src/stores/visualiserStore.ts`
- Create: `src/components/visualiser/PresetManager.tsx`
- Modify: `src/components/visualiser/VisualSettings.tsx`

**Context:** Users spend time tuning orbOpacity, bloomIntensity, particlesOpacity, etc. but lose those settings when they close the tab (despite persistence, they can only have one "current" configuration). Presets let them save named snapshots and switch between them — e.g., "ambient", "bass-heavy", "minimal".

A preset captures the current values of every visual intensity slider and FX toggle. The preset list is stored in `visualiserStore` and persisted alongside other settings. The UI is a compact panel inside `VisualSettings`.

**Interfaces:**

- Consumes: all existing visual intensity fields in `visualiserStore` (`orbOpacity`, `bloomIntensity`, `particlesOpacity`, `terrainOpacity`, `albumGravityOpacity`, `bloomEnabled`, `godRaysEnabled`, `chromaticAberrationEnabled`, `vignetteEnabled`, `filmGrainEnabled`, `dofEnabled`)
- Produces: `ScenePreset` type, `presets` array and `savePreset` / `loadPreset` / `deletePreset` actions in `visualiserStore`

- [ ] **Step 1: Define the ScenePreset type and write store tests**

In `src/stores/visualiserStore.test.ts`, add:

```ts
describe('scene presets', () => {
  beforeEach(() => {
    useVisualiserStore.setState({ presets: [] })
  })

  it('savePreset stores a named snapshot of current visual settings', () => {
    useVisualiserStore.setState({ orbOpacity: 0.8, bloomEnabled: true })
    useVisualiserStore.getState().savePreset('test-preset')
    const presets = useVisualiserStore.getState().presets
    expect(presets).toHaveLength(1)
    expect(presets[0].name).toBe('test-preset')
    expect(presets[0].settings.orbOpacity).toBe(0.8)
    expect(presets[0].settings.bloomEnabled).toBe(true)
  })

  it('loadPreset applies stored settings to the store', () => {
    useVisualiserStore.getState().savePreset('ambient')
    useVisualiserStore.setState({ orbOpacity: 0.1 })
    const id = useVisualiserStore.getState().presets[0].id
    useVisualiserStore.getState().loadPreset(id)
    expect(useVisualiserStore.getState().orbOpacity).toBe(0.8)
  })

  it('deletePreset removes the entry by id', () => {
    useVisualiserStore.getState().savePreset('to-delete')
    const id = useVisualiserStore.getState().presets[0].id
    useVisualiserStore.getState().deletePreset(id)
    expect(useVisualiserStore.getState().presets).toHaveLength(0)
  })

  it('caps presets at 8 (oldest dropped on save)', () => {
    for (let i = 0; i < 9; i++) {
      useVisualiserStore.getState().savePreset(`preset-${i}`)
    }
    expect(useVisualiserStore.getState().presets).toHaveLength(8)
    expect(useVisualiserStore.getState().presets.find(p => p.name === 'preset-0')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test:run src/stores/visualiserStore.test.ts
```

Expected: FAIL — `presets`, `savePreset`, `loadPreset`, `deletePreset` do not exist.

- [ ] **Step 3: Add ScenePreset type and actions to visualiserStore**

In `src/stores/visualiserStore.ts`, add the type above the store interface:

```ts
export interface ScenePresetSettings {
  orbOpacity: number
  bloomIntensity: number
  particlesOpacity: number
  terrainOpacity: number
  albumGravityOpacity: number
  bloomEnabled: boolean
  godRaysEnabled: boolean
  chromaticAberrationEnabled: boolean
  vignetteEnabled: boolean
  filmGrainEnabled: boolean
  dofEnabled: boolean
}

export interface ScenePreset {
  id: string
  name: string
  settings: ScenePresetSettings
  createdAt: number
}
```

Add to the store interface:

```ts
presets: ScenePreset[]
savePreset: (name: string) => void
loadPreset: (id: string) => void
deletePreset: (id: string) => void
```

Add to the `create(...)` implementation (read the current visual fields from state):

```ts
presets: [],

savePreset: (name) =>
  set(s => {
    const settings: ScenePresetSettings = {
      orbOpacity: s.orbOpacity,
      bloomIntensity: s.bloomIntensity,
      particlesOpacity: s.particlesOpacity,
      terrainOpacity: s.terrainOpacity,
      albumGravityOpacity: s.albumGravityOpacity,
      bloomEnabled: s.bloomEnabled,
      godRaysEnabled: s.godRaysEnabled,
      chromaticAberrationEnabled: s.chromaticAberrationEnabled,
      vignetteEnabled: s.vignetteEnabled,
      filmGrainEnabled: s.filmGrainEnabled,
      dofEnabled: s.dofEnabled,
    }
    const entry: ScenePreset = {
      id: crypto.randomUUID(),
      name,
      settings,
      createdAt: Date.now(),
    }
    const next = [...s.presets, entry]
    return { presets: next.length > 8 ? next.slice(-8) : next }
  }),

loadPreset: (id) =>
  set(s => {
    const preset = s.presets.find(p => p.id === id)
    if (!preset) return s
    return { ...s, ...preset.settings }
  }),

deletePreset: (id) =>
  set(s => ({ presets: s.presets.filter(p => p.id !== id) })),
```

Add `'presets'` to the `partialize` keys list so presets persist across sessions.

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test:run src/stores/visualiserStore.test.ts
```

Expected: all passing.

- [ ] **Step 5: Create the PresetManager component**

Create `src/components/visualiser/PresetManager.tsx`:

```tsx
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useVisualiserStore } from '@/stores/visualiserStore'

interface PresetManagerProps {
  accentColor: string
}

export function PresetManager({ accentColor }: PresetManagerProps) {
  const presets = useVisualiserStore(s => s.presets)
  const savePreset = useVisualiserStore(s => s.savePreset)
  const loadPreset = useVisualiserStore(s => s.loadPreset)
  const deletePreset = useVisualiserStore(s => s.deletePreset)
  const [nameInput, setNameInput] = useState('')

  const handleSave = () => {
    const name = nameInput.trim() || `Scene ${presets.length + 1}`
    savePreset(name)
    setNameInput('')
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <span style={styles.label}>Presets</span>
      </div>

      <div style={styles.saveRow}>
        <input
          style={styles.input}
          type="text"
          placeholder="Scene name…"
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSave()
          }}
          maxLength={24}
        />
        <button
          onClick={handleSave}
          style={{ ...styles.saveBtn, borderColor: accentColor, color: accentColor }}
        >
          Save
        </button>
      </div>

      <AnimatePresence initial={false}>
        {presets.length === 0 ? (
          <div style={styles.empty}>No presets saved</div>
        ) : (
          presets.map(preset => (
            <motion.div
              key={preset.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              style={styles.presetRow}
            >
              <button style={styles.presetName} onClick={() => loadPreset(preset.id)}>
                {preset.name}
              </button>
              <button
                style={styles.deleteBtn}
                onClick={() => deletePreset(preset.id)}
                aria-label={`Delete preset ${preset.name}`}
              >
                ✕
              </button>
            </motion.div>
          ))
        )}
      </AnimatePresence>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  label: {
    fontSize: '0.6rem',
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    fontWeight: 700,
    opacity: 0.45,
  },
  saveRow: { display: 'flex', gap: '0.5rem' },
  input: {
    flex: 1,
    fontSize: '0.7rem',
    padding: '0.3rem 0.5rem',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border-color)',
    borderRadius: '2px',
    color: 'inherit',
    fontFamily: 'inherit',
    outline: 'none',
  },
  saveBtn: {
    fontSize: '0.6rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    padding: '0.3rem 0.75rem',
    border: '1px solid',
    borderRadius: '2px',
    background: 'transparent',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: 700,
  },
  presetRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  presetName: {
    flex: 1,
    textAlign: 'left',
    fontSize: '0.7rem',
    padding: '0.35rem 0.5rem',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border-color)',
    borderRadius: '2px',
    cursor: 'pointer',
    color: 'inherit',
    fontFamily: 'inherit',
    transition: 'background-color 0.15s ease',
  },
  deleteBtn: {
    fontSize: '0.6rem',
    padding: '0.35rem 0.5rem',
    marginLeft: '0.25rem',
    background: 'transparent',
    border: '1px solid var(--border-color)',
    borderRadius: '2px',
    cursor: 'pointer',
    color: 'inherit',
    opacity: 0.45,
    fontFamily: 'inherit',
  },
  empty: {
    fontSize: '0.6rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    opacity: 0.3,
    textAlign: 'center',
    padding: '0.75rem 0',
  },
}
```

- [ ] **Step 6: Add PresetManager to VisualSettings**

In `src/components/visualiser/VisualSettings.tsx`, import and place `PresetManager` in the settings panel. Read the file first to find where the FX toggles section ends, then add below it:

```tsx
import { PresetManager } from './PresetManager'

// Inside the settings panel JSX, after the last FX section:
;<div style={styles.section}>
  <PresetManager accentColor={accentColor} />
</div>
```

Match the `styles.section` wrapper used by other settings groups in that file.

- [ ] **Step 7: Verify build**

```bash
pnpm build
```

- [ ] **Step 8: Manual verification**
- Enter fullscreen, open Visual Settings
- Tune some opacity sliders, type a name in the preset input, press Save
- Change the sliders to different values
- Click the saved preset name — sliders should snap back to saved values
- Click ✕ — preset row should collapse and disappear

- [ ] **Step 9: Commit**

```bash
git add src/stores/visualiserStore.ts src/stores/visualiserStore.test.ts src/components/visualiser/PresetManager.tsx src/components/visualiser/VisualSettings.tsx
git commit -m "feat: scene presets — save, load, and delete named visual configurations"
```

---

### Task 2: Shareable URL

**Files:**

- Create: `src/hooks/useShareableURL.ts`
- Create: `src/hooks/useShareableURL.test.ts`
- Modify: `src/components/visualiser/FullscreenOverlay.tsx`
- Modify: `src/App.tsx`

**Context:** Users can't share their current scene + track with others. Encoding the visual layer, quality, and current track ID into a URL lets users copy a link that restores their exact state. The URL is only written on explicit "Share" button click — not on every state change (to avoid polluting the browser history).

On page load, the app reads URL params and restores state before first render.

**Interfaces:**

- Consumes: `visualiserStore` — `visualLayer`, `quality`
- Consumes: `playerStore` — `currentTrack.id`, `queue`
- Produces: `useShareableURL(): { buildShareURL: () => string; restoreFromURL: () => void }`

- [ ] **Step 1: Write the hook tests**

Create `src/hooks/useShareableURL.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { encodeShareParams, decodeShareParams } from './useShareableURL'

describe('encodeShareParams / decodeShareParams', () => {
  it('round-trips visual layer and quality', () => {
    const params = encodeShareParams({
      visualLayer: 'AudioOrb',
      quality: 'Epic',
      trackId: null,
    })
    const decoded = decodeShareParams(new URLSearchParams(params))
    expect(decoded.visualLayer).toBe('AudioOrb')
    expect(decoded.quality).toBe('Epic')
  })

  it('round-trips a numeric track id', () => {
    const params = encodeShareParams({ visualLayer: 'Tunnel', quality: 'Medium', trackId: 42 })
    const decoded = decodeShareParams(new URLSearchParams(params))
    expect(decoded.trackId).toBe(42)
  })

  it('returns null trackId when not present', () => {
    const decoded = decodeShareParams(new URLSearchParams(''))
    expect(decoded.trackId).toBeNull()
  })

  it('returns null for unknown quality value', () => {
    const decoded = decodeShareParams(new URLSearchParams('q=Unknown'))
    expect(decoded.quality).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test:run src/hooks/useShareableURL.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useShareableURL.ts`:

```ts
import { useCallback } from 'react'
import { usePlayerStore } from '@/stores/playerStore'
import { useVisualiserStore } from '@/stores/visualiserStore'

const VALID_QUALITIES = ['Low', 'Medium', 'Epic'] as const
type Quality = (typeof VALID_QUALITIES)[number]

interface ShareParams {
  visualLayer: string
  quality: string
  trackId: number | string | null
}

interface DecodedShareParams {
  visualLayer: string | null
  quality: Quality | null
  trackId: number | null
}

// Pure functions — exported for unit testing
export function encodeShareParams(params: ShareParams): string {
  const p = new URLSearchParams()
  if (params.visualLayer) p.set('v', params.visualLayer)
  if (params.quality) p.set('q', params.quality)
  if (params.trackId !== null) p.set('t', String(params.trackId))
  return p.toString()
}

export function decodeShareParams(params: URLSearchParams): DecodedShareParams {
  const quality = params.get('q')
  return {
    visualLayer: params.get('v'),
    quality: VALID_QUALITIES.includes(quality as Quality) ? (quality as Quality) : null,
    trackId: params.get('t') ? Number(params.get('t')) : null,
  }
}

export function useShareableURL() {
  const buildShareURL = useCallback(() => {
    const { visualLayer, quality } = useVisualiserStore.getState()
    const { currentTrack } = usePlayerStore.getState()
    const qs = encodeShareParams({
      visualLayer,
      quality,
      trackId: currentTrack?.id ?? null,
    })
    return `${window.location.origin}${window.location.pathname}?${qs}`
  }, [])

  const restoreFromURL = useCallback(() => {
    const params = new URLSearchParams(window.location.search)
    const decoded = decodeShareParams(params)
    if (decoded.visualLayer) {
      useVisualiserStore.getState().setVisualLayer(decoded.visualLayer)
    }
    if (decoded.quality) {
      useVisualiserStore.getState().setQuality(decoded.quality)
    }
    // trackId restoration is best-effort: only works if the track is already in the queue.
    // Full restoration (re-searching Deezer for the track) is out of scope.
    if (decoded.trackId !== null) {
      const { queue, setTrack } = usePlayerStore.getState()
      const track = queue.find(t => t.id === decoded.trackId)
      if (track) setTrack(track)
    }
  }, [])

  return { buildShareURL, restoreFromURL }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test:run src/hooks/useShareableURL.test.ts
```

Expected: 4 passing.

- [ ] **Step 5: Add Share button to FullscreenOverlay**

In `src/components/visualiser/FullscreenOverlay.tsx`, import and use the hook:

```ts
import { useShareableURL } from '@/hooks/useShareableURL'
```

Inside the component:

```ts
const { buildShareURL } = useShareableURL()
const [copied, setCopied] = useState(false)

const handleShare = async () => {
  const url = buildShareURL()
  await navigator.clipboard.writeText(url)
  setCopied(true)
  setTimeout(() => setCopied(false), 2000)
}
```

Add the Share button in the overlay's control bar (find where the recording stop button and settings button live — place Share nearby):

```tsx
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  onClick={handleShare}
  style={{
    ...styles.controlBtn,
    color: copied ? accentColor : 'inherit',
    borderColor: copied ? accentColor : 'var(--border-color)',
  }}
  aria-label="Copy share link"
>
  {copied ? 'Copied' : 'Share'}
</motion.button>
```

Match `styles.controlBtn` to the existing button style shape in that file (read the existing buttons first).

- [ ] **Step 6: Restore state from URL on app load**

In `src/App.tsx`, inside the `Waveform` component, call `restoreFromURL` once on mount:

```ts
import { useShareableURL } from '@/hooks/useShareableURL'

// Inside Waveform():
const { restoreFromURL } = useShareableURL()
useEffect(() => {
  restoreFromURL()
  // Clear the URL params so sharing the current page later reflects live state
  if (window.location.search) {
    window.history.replaceState({}, '', window.location.pathname)
  }
}, [restoreFromURL])
```

- [ ] **Step 7: Verify build**

```bash
pnpm build
```

- [ ] **Step 8: Manual verification**
- Enter fullscreen, set quality to Epic, switch to a non-default visual layer
- Click Share — the address bar URL should briefly show `?v=...&q=...` then clear, and "Copied" should flash on the button
- Paste the URL in a new tab — the app should restore to the same visual layer and quality
- With a track playing: the share URL includes `&t=<trackId>` — opening it while that track is in the queue resumes it

- [ ] **Step 9: Commit**

```bash
git add src/hooks/useShareableURL.ts src/hooks/useShareableURL.test.ts src/components/visualiser/FullscreenOverlay.tsx src/App.tsx
git commit -m "feat: shareable URL — copy link to restore current scene and track"
```

---

### Task 3: Recording indicator pulsing dot

**Files:**

- Modify: `src/components/visualiser/FullscreenOverlay.tsx`

**Context:** When screen recording is active, the stop-recording button text turns red. This is subtle — a small pulsing dot beside the button makes the recording state unmissable and feels more intentional.

**Interfaces:**

- Produces: nothing consumed by other tasks

- [ ] **Step 1: Find the recording button in FullscreenOverlay**

Read `src/components/visualiser/FullscreenOverlay.tsx` and find the `isRecording` state and the recording stop button (search for `isRecording` or `STOP_RECORDING` or similar). Note its exact JSX structure.

- [ ] **Step 2: Add the pulsing dot**

Inside the recording button (or immediately before it), add the dot:

```tsx
{
  isRecording && (
    <motion.span
      animate={{ opacity: [1, 0.2, 1] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        display: 'inline-block',
        width: '6px',
        height: '6px',
        borderRadius: '1px',
        backgroundColor: '#ff4444',
        marginRight: '0.5rem',
        flexShrink: 0,
        verticalAlign: 'middle',
      }}
      aria-hidden="true"
    />
  )
}
```

Place this inside the button's label span so it flows inline with the text. The `borderRadius: '1px'` gives the instrument-aesthetic square-with-slightly-rounded-corners look rather than a circle.

- [ ] **Step 3: Verify build**

```bash
pnpm build
```

- [ ] **Step 4: Manual verification**
- Enter fullscreen mode, start a screen recording
- A small pulsing red square should appear to the left of the stop button label
- When recording stops, the dot disappears

- [ ] **Step 5: Commit**

```bash
git add src/components/visualiser/FullscreenOverlay.tsx
git commit -m "feat: pulsing recording indicator dot in fullscreen overlay"
```
