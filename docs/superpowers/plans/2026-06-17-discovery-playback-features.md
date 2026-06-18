# Discovery & Playback Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four features that deepen the music discovery experience and make the fullscreen visualiser feel like a finished product: genre auto-queue, a color history strip, fullscreen Now Playing toggle (N key), and a keyboard shortcut legend (? key).

**Architecture:** Genre auto-queue wires into the existing `playerStore` queue actions. The color history strip is a new component that reads `playerStore.queue` and derived accent colors — no new store. The fullscreen features add two boolean flags to `visualiserStore` and consume them in `FullscreenOverlay`.

**Tech Stack:** TypeScript, React, Framer Motion, Zustand, Vitest + React Testing Library

## Global Constraints

- Raw audio data (`Uint8Array`) must never enter React state or Zustand
- No `border-radius` above 4px; no hardcoded accent colors
- All opacity values for text ≥ 0.45 on `#0d0d0d`
- Use `pnpm`, not `npm` or `yarn`
- Run `pnpm build` after every task
- Keyboard shortcuts must not fire when focus is inside an `<input>` or `<textarea>`

---

### Task 1: Genre auto-queue

**Files:**

- Modify: `src/components/library/GenreForceGraph.tsx`
- Modify: `src/components/layout/GenrePanelQuadrant.tsx`

**Context:** When a user selects a genre node, the genre map filters the visible track list but playback is unaffected. Adding an auto-queue button on selected genre nodes lets users hear all tracks in a genre without manually clicking each one. The button appears as a small pill next to the selected node's label — "QUEUE ALL" — and calls `clearQueue` + `addToQueue` for each filtered track, then `setTrack` + `play` on the first.

**Interfaces:**

- Consumes: `playerStore` — `clearQueue`, `addToQueue`, `setTrack`, `play`
- Consumes: `GenrePanelQuadrant` `onFilteredTracksChange` callback (already passes filtered track IDs up)
- Produces: nothing consumed by other tasks

- [ ] **Step 1: Write the test**

Create `src/components/layout/GenrePanelQuadrant.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { GenrePanelQuadrant } from './GenrePanelQuadrant'
import type { AlbumColour } from '@/hooks/useAlbumColour'
import type { DeezerTrack } from '@/types/track'

const mockAccent: AlbumColour = {
  hex: '#7a8fa6',
  h: 210,
  s: 20,
  l: 56,
  palette: {
    background: '#0d0d0d',
    surface: '#111',
    primary: '#7a8fa6',
    secondary: '#5a6f86',
    accent: '#7a8fa6',
    text: '#e0e0e0',
    textDim: '#7a8fa6',
    border: '#1f1f1f',
  },
}

const mockTrack = (id: number): DeezerTrack => ({
  source: 'deezer',
  id,
  title: `Track ${id}`,
  artist: { id: 1, name: 'Artist', picture_medium: '', picture_big: '' },
  album: { id: 1, title: 'Album', cover_medium: '', cover_big: '' },
  preview: '',
  duration: 30,
  rank: 100000,
  explicit_lyrics: false,
})

vi.mock('@/stores/playerStore', () => ({
  usePlayerStore: vi.fn(selector =>
    selector({
      clearQueue: vi.fn(),
      addToQueue: vi.fn(),
      setTrack: vi.fn(),
      play: vi.fn(),
      queue: [],
      currentTrack: null,
      isPlaying: false,
    })
  ),
}))

describe('GenrePanelQuadrant auto-queue', () => {
  it('renders without crashing with tracks', () => {
    render(
      <GenrePanelQuadrant
        tracks={[mockTrack(1), mockTrack(2)]}
        onFilteredTracksChange={() => {}}
        accent={mockAccent}
      />
    )
    // Component renders the genre panel container
    expect(document.body).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it passes baseline**

```bash
pnpm test:run src/components/layout/GenrePanelQuadrant.test.tsx
```

Expected: PASS (baseline — confirms the component renders without crashing before we add the feature).

- [ ] **Step 3: Read GenrePanelQuadrant to understand its structure**

Read `src/components/layout/GenrePanelQuadrant.tsx` fully. Note how it passes `onSelect` / `onFilteredTracksChange` down to `GenrePanel` or `GenreForceGraph`, and what shape the filtered track IDs take.

- [ ] **Step 4: Add auto-queue callback prop to GenreForceGraph**

In `src/components/library/GenreForceGraph.tsx`, the component already has `onSelect: (genreId: string | null) => void`. Add a second optional callback:

```ts
interface GenreForceGraphProps {
  // ... existing props
  onQueueGenre?: (genreId: string) => void
}
```

In the D3 node click handler (where `onSelectRef.current` is called), detect a double-click or a dedicated button. The cleanest approach without DOM complexity: add a small "QUEUE ALL" text element that appears on the selected node.

In the D3 tick handler or the data update effect, after applying active node styles, add/update a "queue button" text element on the active node:

```ts
// After applying node stroke styles:
root
  .select('g.nodes')
  .selectAll<SVGCircleElement, GenreNode>('circle')
  .each(function (d) {
    const isActive = activeGenreRef.current === d.id
    // Manage a sibling <text class="queue-btn"> in the labels group
    const label = root
      .select('g.labels')
      .selectAll<SVGTextElement, GenreNode>(`text.queue-btn-${d.id}`)

    if (isActive && onQueueGenreRef.current) {
      if (label.empty()) {
        root
          .select('g.labels')
          .append('text')
          .attr('class', `queue-btn-${d.id}`)
          .style('cursor', 'pointer')
          .style('font-size', '8px')
          .style('font-weight', '700')
          .style('letter-spacing', '0.1em')
          .style('fill', '#000')
          .attr('text-anchor', 'middle')
          .text('QUEUE ALL')
          .on('click', event => {
            event.stopPropagation()
            onQueueGenreRef.current?.(d.id)
          })
      }
    } else {
      label.remove()
    }
  })
```

Position the queue-btn text in the tick handler alongside the label text — above the node at `y = node.y - nodeRadius(d) - 12`.

Add `onQueueGenreRef` alongside the other refs at the top of the component:

```ts
const onQueueGenreRef = useRef(onQueueGenre)
useEffect(() => {
  onQueueGenreRef.current = onQueueGenre
}, [onQueueGenre])
```

- [ ] **Step 5: Wire auto-queue in GenrePanelQuadrant**

In `src/components/layout/GenrePanelQuadrant.tsx`, read the player store actions and the full track list (passed as prop):

```ts
const clearQueue = usePlayerStore(s => s.clearQueue)
const addToQueue = usePlayerStore(s => s.addToQueue)
const setTrack = usePlayerStore(s => s.setTrack)
const play = usePlayerStore(s => s.play)
```

Add a handler:

```ts
const handleQueueGenre = useCallback(
  (genreId: string) => {
    const genreTracks = tracks.filter(
      t =>
        // Match tracks whose genre matches — use the same genre-detection logic
        // already used to build the graph nodes. Read the GenrePanel/GenreForceGraph
        // data building code to find the exact genre field name (likely t.artist.name
        // or a derived genre cluster id).
        String(t.id) === genreId || filteredTrackIds?.includes(String(t.id))
    )
    if (genreTracks.length === 0) return
    clearQueue()
    genreTracks.forEach(t => addToQueue(t))
    setTrack(genreTracks[0])
    play()
  },
  [tracks, filteredTrackIds, clearQueue, addToQueue, setTrack, play]
)
```

Pass `onQueueGenre={handleQueueGenre}` down to the genre graph component.

**Note:** The genre-to-track mapping logic depends on how `GenreForceGraph` builds its nodes. Read that data-building code carefully before implementing `handleQueueGenre` — the genre ID format must match exactly.

- [ ] **Step 6: Verify build**

```bash
pnpm build
```

- [ ] **Step 7: Manual verification**
- Search for tracks, wait for genre map to populate
- Click a genre node to select it — "QUEUE ALL" text should appear above it
- Click "QUEUE ALL" — the queue should populate with tracks from that genre and playback should start
- The filter indicator in the header should appear ("X results filtered")

- [ ] **Step 8: Commit**

```bash
git add src/components/library/GenreForceGraph.tsx src/components/layout/GenrePanelQuadrant.tsx src/components/layout/GenrePanelQuadrant.test.tsx
git commit -m "feat: genre auto-queue — click QUEUE ALL on selected genre node"
```

---

### Task 2: Color history strip

**Files:**

- Create: `src/components/player/ColorHistoryStrip.tsx`
- Modify: `src/components/player/PlayerBar.tsx`
- Modify: `src/stores/playerStore.ts`

**Context:** Each track that plays produces a dominant accent color via `useAlbumColour`. There's no visual memory of this journey. A thin horizontal strip of color swatches at the very bottom of the player bar shows the last 20 tracks' extracted colors — a timeline of the session's palette. Clicking a swatch replays that track.

**Interfaces:**

- Consumes: new `colorHistory: Array<{ trackId: string | number; hex: string; title: string }>` in `playerStore`
- Consumes: new `pushColorHistory` action in `playerStore`
- Produces: `ColorHistoryStrip` component

- [ ] **Step 1: Write the store test**

In `src/stores/playerStore.test.ts`, add:

```ts
describe('colorHistory', () => {
  beforeEach(() => {
    usePlayerStore.setState({
      colorHistory: [],
    })
  })

  it('starts empty', () => {
    expect(usePlayerStore.getState().colorHistory).toHaveLength(0)
  })

  it('pushColorHistory adds an entry', () => {
    usePlayerStore.getState().pushColorHistory({ trackId: 1, hex: '#ff0000', title: 'Track A' })
    expect(usePlayerStore.getState().colorHistory).toHaveLength(1)
    expect(usePlayerStore.getState().colorHistory[0].hex).toBe('#ff0000')
  })

  it('caps colorHistory at 20 entries (oldest dropped)', () => {
    for (let i = 0; i < 25; i++) {
      usePlayerStore
        .getState()
        .pushColorHistory({
          trackId: i,
          hex: `#${i.toString().padStart(6, '0')}`,
          title: `Track ${i}`,
        })
    }
    expect(usePlayerStore.getState().colorHistory).toHaveLength(20)
    // oldest (id=0) should be gone
    expect(usePlayerStore.getState().colorHistory.find(e => e.trackId === 0)).toBeUndefined()
  })

  it('does not add duplicate consecutive entry for the same track', () => {
    usePlayerStore.getState().pushColorHistory({ trackId: 1, hex: '#ff0000', title: 'Track A' })
    usePlayerStore.getState().pushColorHistory({ trackId: 1, hex: '#ff0000', title: 'Track A' })
    expect(usePlayerStore.getState().colorHistory).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test:run src/stores/playerStore.test.ts
```

Expected: FAIL — `colorHistory` and `pushColorHistory` do not exist.

- [ ] **Step 3: Add colorHistory to playerStore**

In `src/stores/playerStore.ts`:

Add to the interface:

```ts
colorHistory: Array<{ trackId: string | number; hex: string; title: string }>
pushColorHistory: (entry: { trackId: string | number; hex: string; title: string }) => void
```

Add to the `create(...)` implementation:

```ts
colorHistory: [],

pushColorHistory: (entry) =>
  set(s => {
    const last = s.colorHistory[s.colorHistory.length - 1]
    if (last?.trackId === entry.trackId) return s  // no duplicate consecutive
    const next = [...s.colorHistory, entry]
    return { colorHistory: next.length > 20 ? next.slice(-20) : next }
  }),
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test:run src/stores/playerStore.test.ts
```

Expected: all passing.

- [ ] **Step 5: Write the ColorHistoryStrip component test**

Create `src/components/player/ColorHistoryStrip.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ColorHistoryStrip } from './ColorHistoryStrip'

vi.mock('@/stores/playerStore', () => ({
  usePlayerStore: vi.fn(selector =>
    selector({
      colorHistory: [
        { trackId: 1, hex: '#ff0000', title: 'Track A' },
        { trackId: 2, hex: '#00ff00', title: 'Track B' },
      ],
      queue: [],
      setTrack: vi.fn(),
      play: vi.fn(),
    })
  ),
}))

describe('ColorHistoryStrip', () => {
  it('renders one swatch per history entry', () => {
    const { container } = render(<ColorHistoryStrip />)
    const swatches = container.querySelectorAll('[data-testid="color-swatch"]')
    expect(swatches).toHaveLength(2)
  })

  it('applies the hex color to each swatch', () => {
    const { container } = render(<ColorHistoryStrip />)
    const first = container.querySelector('[data-testid="color-swatch"]') as HTMLElement
    expect(first.style.backgroundColor).toContain('255') // #ff0000 → rgb(255,0,0)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

```bash
pnpm test:run src/components/player/ColorHistoryStrip.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 7: Create ColorHistoryStrip component**

Create `src/components/player/ColorHistoryStrip.tsx`:

```tsx
import React from 'react'
import { motion } from 'framer-motion'
import { usePlayerStore } from '@/stores/playerStore'

export function ColorHistoryStrip() {
  const colorHistory = usePlayerStore(s => s.colorHistory)
  const queue = usePlayerStore(s => s.queue)
  const setTrack = usePlayerStore(s => s.setTrack)
  const play = usePlayerStore(s => s.play)

  if (colorHistory.length === 0) return null

  const handleSwatchClick = (trackId: string | number) => {
    const track = queue.find(t => t.id === trackId)
    if (track) {
      setTrack(track)
      play()
    }
  }

  return (
    <div style={styles.strip} role="list" aria-label="Color history">
      {colorHistory.map((entry, i) => (
        <motion.button
          key={`${entry.trackId}-${i}`}
          data-testid="color-swatch"
          role="listitem"
          whileHover={{ scaleY: 1.6, zIndex: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          onClick={() => handleSwatchClick(entry.trackId)}
          aria-label={`Replay ${entry.title}`}
          style={{
            ...styles.swatch,
            backgroundColor: entry.hex,
          }}
        />
      ))}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  strip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '3px',
    display: 'flex',
    overflow: 'hidden',
  },
  swatch: {
    flex: 1,
    height: '100%',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    opacity: 0.7,
    transformOrigin: 'bottom',
    transition: 'opacity 0.15s ease',
  },
}
```

- [ ] **Step 8: Run test to verify it passes**

```bash
pnpm test:run src/components/player/ColorHistoryStrip.test.tsx
```

Expected: 2 passing.

- [ ] **Step 9: Mount ColorHistoryStrip in PlayerBar**

In `src/components/player/PlayerBar.tsx`, import and add:

```tsx
import { ColorHistoryStrip } from './ColorHistoryStrip'
```

The `<motion.footer>` already has `position: 'fixed'`. Add `ColorHistoryStrip` as the last child inside the footer (it positions itself at `bottom: 0` absolutely):

```tsx
<motion.footer style={{ ...styles.footer, ... }}>
  {/* existing content */}
  <ColorHistoryStrip />
</motion.footer>
```

- [ ] **Step 10: Push to colorHistory when track changes**

In `src/App.tsx`, inside the `Waveform` component, find the `useEffect` that updates the document title on track change. After the title update, push to history:

```ts
useEffect(() => {
  if (!currentTrack) {
    document.title = 'Waveform'
    return
  }
  const status = isPlaying ? '▶' : '⏸'
  document.title = `${status} ${currentTrack.title} · ${currentTrack.artist.name} | Waveform`
  // Push to color history when track becomes active and accent is available
  if (accent.hex && accent.hex !== '#7a8fa6') {
    usePlayerStore.getState().pushColorHistory({
      trackId: currentTrack.id,
      hex: accent.hex,
      title: currentTrack.title,
    })
  }
}, [currentTrack, isPlaying, accent.hex])
```

- [ ] **Step 11: Verify build**

```bash
pnpm build
```

- [ ] **Step 12: Manual verification**
- Play several tracks — a thin strip of color swatches should appear at the very bottom of the player bar
- Hover a swatch — it should expand vertically with a spring animation
- Click a swatch — that track should resume if it's still in the queue

- [ ] **Step 13: Commit**

```bash
git add src/stores/playerStore.ts src/stores/playerStore.test.ts src/components/player/ColorHistoryStrip.tsx src/components/player/ColorHistoryStrip.test.tsx src/components/player/PlayerBar.tsx src/App.tsx
git commit -m "feat: color history strip — timeline of session palette swatches in player bar"
```

---

### Task 3: Fullscreen Now Playing toggle (N key) and keyboard legend (? key)

**Files:**

- Modify: `src/stores/visualiserStore.ts`
- Modify: `src/components/visualiser/FullscreenOverlay.tsx`
- Modify: `src/App.tsx` (KeyboardShortcuts component)

**Context:** In fullscreen mode, the Now Playing card permanently occludes the visualiser. The N key should toggle its visibility. The ? key should show a modal listing all keyboard shortcuts — currently undiscoverable by new users.

**Interfaces:**

- Consumes: `visualiserStore` — new `showNowPlaying: boolean` and `showShortcutsLegend: boolean` flags
- Produces: both flags in `visualiserStore`; UI in `FullscreenOverlay`

- [ ] **Step 1: Write the store tests**

In `src/stores/visualiserStore.test.ts`, add:

```ts
describe('fullscreen UI toggles', () => {
  it('showNowPlaying defaults to true', () => {
    expect(useVisualiserStore.getState().showNowPlaying).toBe(true)
  })

  it('toggleNowPlaying flips the flag', () => {
    useVisualiserStore.getState().toggleNowPlaying()
    expect(useVisualiserStore.getState().showNowPlaying).toBe(false)
    useVisualiserStore.getState().toggleNowPlaying()
    expect(useVisualiserStore.getState().showNowPlaying).toBe(true)
  })

  it('showShortcutsLegend defaults to false', () => {
    expect(useVisualiserStore.getState().showShortcutsLegend).toBe(false)
  })

  it('toggleShortcutsLegend flips the flag', () => {
    useVisualiserStore.getState().toggleShortcutsLegend()
    expect(useVisualiserStore.getState().showShortcutsLegend).toBe(true)
    useVisualiserStore.getState().toggleShortcutsLegend()
    expect(useVisualiserStore.getState().showShortcutsLegend).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test:run src/stores/visualiserStore.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Add flags and actions to visualiserStore**

In `src/stores/visualiserStore.ts`, add to the interface:

```ts
showNowPlaying: boolean
toggleNowPlaying: () => void
showShortcutsLegend: boolean
toggleShortcutsLegend: () => void
```

Add to the `create(...)` implementation:

```ts
showNowPlaying: true,
toggleNowPlaying: () => set(s => ({ showNowPlaying: !s.showNowPlaying })),
showShortcutsLegend: false,
toggleShortcutsLegend: () => set(s => ({ showShortcutsLegend: !s.showShortcutsLegend })),
```

These do not need to be persisted — they reset each session.

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test:run src/stores/visualiserStore.test.ts
```

Expected: all passing.

- [ ] **Step 5: Wire N key in KeyboardShortcuts**

In `src/App.tsx`, inside `KeyboardShortcuts`, add:

```ts
const toggleNowPlaying = useVisualiserStore(state => state.toggleNowPlaying)
const toggleShortcutsLegend = useVisualiserStore(state => state.toggleShortcutsLegend)
const isFullscreen = useVisualiserStore(state => state.isFullscreen)
```

Add cases to the `handleKeyDown` switch:

```ts
case 'n':
  if (isFullscreen) {
    e.preventDefault()
    toggleNowPlaying()
  }
  break
case '?':
  e.preventDefault()
  toggleShortcutsLegend()
  break
```

- [ ] **Step 6: Conditionally render Now Playing card in FullscreenOverlay**

In `src/components/visualiser/FullscreenOverlay.tsx`, read the new flag:

```ts
const showNowPlaying = useVisualiserStore(s => s.showNowPlaying)
```

Find the now-playing card render (the `<motion.div>` wrapping the now-playing content in the overlay, around line 400–451). Wrap it with `AnimatePresence` and add exit animation:

```tsx
<AnimatePresence>
  {showNowPlaying && (
    <motion.div
      key="now-playing-card"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      style={/* existing style */}
    >
      {/* existing now-playing content */}
    </motion.div>
  )}
</AnimatePresence>
```

Also add a small "N" hint when the card is hidden — a thin tab on the right edge so users can discover it:

```tsx
<AnimatePresence>
  {!showNowPlaying && (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.4 }}
      exit={{ opacity: 0 }}
      onClick={toggleNowPlaying}
      style={{
        position: 'absolute',
        right: 0,
        top: '50%',
        transform: 'translateY(-50%)',
        writingMode: 'vertical-rl',
        fontSize: '0.55rem',
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        padding: '0.75rem 0.35rem',
        border: '1px solid var(--border-color)',
        borderRight: 'none',
        borderRadius: '2px 0 0 2px',
        background: 'rgba(255,255,255,0.03)',
        cursor: 'pointer',
      }}
    >
      Now Playing
    </motion.button>
  )}
</AnimatePresence>
```

- [ ] **Step 7: Build the shortcuts legend modal**

In `src/components/visualiser/FullscreenOverlay.tsx`, read the legend flag:

```ts
const showShortcutsLegend = useVisualiserStore(s => s.showShortcutsLegend)
const toggleShortcutsLegend = useVisualiserStore(s => s.toggleShortcutsLegend)
```

Add the legend as an `AnimatePresence` child inside the fullscreen root:

```tsx
<AnimatePresence>
  {showShortcutsLegend && (
    <motion.div
      key="shortcuts-legend"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'rgba(13,13,13,0.96)',
        border: '1px solid var(--border-color)',
        borderRadius: '4px',
        padding: '2rem',
        zIndex: 500,
        minWidth: '280px',
      }}
      onClick={e => e.stopPropagation()}
    >
      <div
        style={{
          fontSize: '0.6rem',
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          fontWeight: 700,
          opacity: 0.45,
          marginBottom: '1.5rem',
        }}
      >
        Keyboard Shortcuts
      </div>
      {[
        ['Space', 'Play / Pause'],
        ['←  →', 'Prev / Next track'],
        ['F', 'Enter / Exit fullscreen'],
        ['V', 'Cycle visual layer'],
        ['N', 'Toggle Now Playing'],
        ['?', 'Show / Hide this legend'],
      ].map(([key, action]) => (
        <div
          key={key}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '3rem',
            marginBottom: '0.75rem',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              background: 'rgba(255,255,255,0.06)',
              padding: '0.1rem 0.5rem',
              borderRadius: '2px',
              border: '1px solid var(--border-color)',
            }}
          >
            {key}
          </span>
          <span
            style={{
              fontSize: '0.6rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              opacity: 0.55,
            }}
          >
            {action}
          </span>
        </div>
      ))}
      <button
        onClick={toggleShortcutsLegend}
        style={{
          marginTop: '1rem',
          width: '100%',
          padding: '0.4rem',
          fontSize: '0.6rem',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          border: '1px solid var(--border-color)',
          borderRadius: '2px',
          background: 'rgba(255,255,255,0.03)',
          cursor: 'pointer',
          opacity: 0.55,
        }}
      >
        Close
      </button>
    </motion.div>
  )}
</AnimatePresence>
```

Also wire Escape to close the legend — in the existing `useEffect` keyboard handler inside `FullscreenOverlay` (if one exists) or the global `KeyboardShortcuts` component:

```ts
case 'escape':
  if (showShortcutsLegend) { e.preventDefault(); toggleShortcutsLegend() }
  break
```

- [ ] **Step 8: Verify build**

```bash
pnpm build
```

- [ ] **Step 9: Manual verification**
- Enter fullscreen mode (F key)
- Press N — Now Playing card should slide out to the right; a vertical "Now Playing" tab should appear on the right edge
- Press N again — card should slide back in
- Press ? — the shortcuts legend modal should appear centered
- Press Escape — modal should dismiss
- All other shortcuts (Space, arrows, F, V) should still work correctly

- [ ] **Step 10: Commit**

```bash
git add src/stores/visualiserStore.ts src/stores/visualiserStore.test.ts src/components/visualiser/FullscreenOverlay.tsx src/App.tsx
git commit -m "feat: fullscreen N-key Now Playing toggle and ? keyboard shortcuts legend"
```
