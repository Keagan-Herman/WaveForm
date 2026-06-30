# Ponytail Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove ~109 lines of dead code, duplicate types, redundant abstractions, and copy-pasted utilities identified in the ponytail audit.

**Architecture:** Four independent cleanup tasks — dead audio context chain, dead hooks/functions, duplicate type consolidation, and formatTime deduplication. No task depends on another; all can be verified with `pnpm build && pnpm test:run`.

**Tech Stack:** TypeScript, React, Vite, Vitest

## Global Constraints

- No semicolons, single quotes, 2-space indent, 100-char print width, trailing commas (Prettier config)
- `pnpm build` must pass (strict TypeScript, `noUnusedLocals`, `noUnusedParameters`)
- `pnpm test:run` must pass
- Use `pnpm`, not `npm` or `yarn`
- Path alias `@/` → `src/`

---

### Task 1: Remove dead audio context chain

`useAudioContext` is never called. `AudioEngineContext` and `AudioProvider` wrap a singleton that every consumer could import directly — and no consumer actually calls them through the context. The entire three-file chain is dead.

**Files:**

- Delete: `src/audio/useAudioContext.ts`
- Delete: `src/audio/AudioEngineContext.ts`
- Delete: `src/audio/AudioContext.tsx`
- Modify: `src/App.tsx` — remove `AudioProvider` import and wrapper

- [ ] **Step 1: Delete the three dead files**

```bash
rm src/audio/useAudioContext.ts src/audio/AudioEngineContext.ts src/audio/AudioContext.tsx
```

- [ ] **Step 2: Remove AudioProvider from App.tsx**

In `src/App.tsx`, remove line 7:

```ts
import { AudioProvider } from '@/audio/AudioContext'
```

Find the JSX wrapper (around line 515):

```tsx
<AudioProvider>{/* ... */}</AudioProvider>
```

Replace with just the children (remove the `<AudioProvider>` open and close tags, keep children).

- [ ] **Step 3: Verify**

```bash
pnpm build
```

Expected: no TypeScript errors, no "module not found" errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "delete: remove dead AudioEngineContext/AudioProvider/useAudioContext chain"
```

---

### Task 2: Remove dead hooks and dead export

`src/hooks/useReducedMotion.ts` is never imported — all callers use `useReducedMotion` from `framer-motion`. `getAlbumArt` in `deezerApi.ts` is never imported (only mentioned in a comment in AlbumGravityField.tsx).

**Files:**

- Delete: `src/hooks/useReducedMotion.ts`
- Modify: `src/lib/deezerApi.ts` — remove `getAlbumArt` (lines 199–211)

- [ ] **Step 1: Delete useReducedMotion**

```bash
rm src/hooks/useReducedMotion.ts
```

- [ ] **Step 2: Remove getAlbumArt from deezerApi.ts**

In `src/lib/deezerApi.ts`, delete the entire `getAlbumArt` function and its JSDoc:

```ts
// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Get the best available album art URL.
 */
export function getAlbumArt(
  track: DeezerTrack,
  size: 'small' | 'medium' | 'large' = 'medium'
): string {
  switch (size) {
    case 'small':
      return track.album.cover_medium // 250x250
    case 'medium':
      return track.album.cover_medium // 250x250
    case 'large':
      return track.album.cover_big // 500x500
  }
}
```

The `// ─── Helpers ──────────────────────────────────────────────────────────────` section divider can be removed too since `formatDuration` (Task 4) will be the only remaining helper.

- [ ] **Step 3: Verify**

```bash
pnpm build
```

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "delete: remove dead useReducedMotion hook and getAlbumArt export"
```

---

### Task 3: Consolidate duplicate type definitions

`DeezerArtist`, `DeezerAlbum`, and `DeezerTrack` are defined identically in both `src/lib/deezerApi.ts` and `src/types/track.ts`. The canonical home per architecture is `src/types/track.ts`. Remove the duplicates from `deezerApi.ts` and import from `track.ts`. Update all callers that currently import these types from `deezerApi`.

`DeezerGenre`, `DeezerFullTrack`, and `TrackSearchResult` are only in `deezerApi.ts` and stay there.

**Files:**

- Modify: `src/lib/deezerApi.ts` — remove 3 interface definitions, add import from `@/types/track`
- Modify: `src/lib/genreGraph.ts` — update import source
- Modify: `src/components/library/AlbumGravityField.tsx` — update import source
- Modify: `src/components/visualiser/FullscreenOverlay.tsx` — merge duplicate imports
- Modify: `src/components/library/GenrePanel.tsx` — update import source
- Modify: `src/hooks/useDeezerSearch.ts` — update import source
- Modify: `src/hooks/useGenreGraph.ts` — update import source
- Modify: `src/components/library/TrackRow.test.tsx` — update import source
- Modify: `src/components/search/ArtistPanel.tsx` — update import source (`DeezerArtist`)

- [ ] **Step 1: Remove duplicates from deezerApi.ts and import from track.ts**

In `src/lib/deezerApi.ts`, replace the `// ─── Types ───` block (lines 26–63):

```ts
// ─── Types ────────────────────────────────────────────────────────────────

export interface DeezerArtist {
  id: number
  name: string
  picture_medium: string
  picture_big: string
  nb_fan?: number
}

export interface DeezerAlbum {
  id: number
  title: string
  cover_medium: string
  cover_big: string
  release_date?: string
}

export interface DeezerGenre {
  id: number
  name: string
}

export interface DeezerTrack {
  source: 'deezer'
  id: number
  title: string
  duration: number // seconds
  preview: string // 30s MP3 URL — always present
  artist: DeezerArtist
  album: DeezerAlbum
  rank: number // popularity proxy (0–1,000,000)
  explicit_lyrics: boolean
}

export interface DeezerFullTrack extends DeezerTrack {
  genres?: { data: DeezerGenre[] }
}

export interface TrackSearchResult {
  tracks: DeezerTrack[]
  total: number
  hasMore: boolean
  nextIndex: number
}
```

With:

```ts
// ─── Types ────────────────────────────────────────────────────────────────

export type { DeezerArtist, DeezerAlbum, DeezerTrack } from '@/types/track'

export interface DeezerGenre {
  id: number
  name: string
}

export interface DeezerFullTrack extends DeezerTrack {
  genres?: { data: DeezerGenre[] }
}

export interface TrackSearchResult {
  tracks: DeezerTrack[]
  total: number
  hasMore: boolean
  nextIndex: number
}
```

Note: the `export type { … } from` re-export keeps backward-compat for any caller still importing from `deezerApi` while also sourcing truth from `track.ts`. However we immediately fix all callers in subsequent steps so the re-export is just insurance during the refactor.

- [ ] **Step 2: Update genreGraph.ts**

`src/lib/genreGraph.ts` line 16:

```ts
import type { DeezerTrack } from '@/lib/deezerApi'
```

Change to:

```ts
import type { DeezerTrack } from '@/types/track'
```

- [ ] **Step 3: Update AlbumGravityField.tsx**

`src/components/library/AlbumGravityField.tsx` line 47:

```ts
import type { DeezerTrack } from '@/lib/deezerApi'
```

Change to:

```ts
import type { DeezerTrack } from '@/types/track'
```

- [ ] **Step 4: Update FullscreenOverlay.tsx**

`src/components/visualiser/FullscreenOverlay.tsx` has two separate imports from these modules:

```ts
import type { DeezerTrack } from '@/lib/deezerApi'
import { getTrackCover, getTrackArtist, isDeezerTrack } from '@/types/track'
```

Merge into one:

```ts
import { getTrackCover, getTrackArtist, isDeezerTrack } from '@/types/track'
import type { DeezerTrack } from '@/types/track'
```

(Or consolidate into a single import statement if TS version allows mixing type and value imports.)

- [ ] **Step 5: Update GenrePanel.tsx**

`src/components/library/GenrePanel.tsx`:

```ts
import type { DeezerTrack } from '@/lib/deezerApi'
```

Change to:

```ts
import type { DeezerTrack } from '@/types/track'
```

- [ ] **Step 6: Update useDeezerSearch.ts**

`src/hooks/useDeezerSearch.ts`:

```ts
import { searchTracks, type DeezerTrack } from '@/lib/deezerApi'
```

Change to:

```ts
import { searchTracks } from '@/lib/deezerApi'
import type { DeezerTrack } from '@/types/track'
```

- [ ] **Step 7: Update useGenreGraph.ts**

`src/hooks/useGenreGraph.ts` imports `DeezerTrack` from `@/lib/deezerApi` on line 23:

```ts
import type { DeezerTrack } from '@/lib/deezerApi'
```

Change to:

```ts
import type { DeezerTrack } from '@/types/track'
```

- [ ] **Step 8: Update TrackRow.test.tsx**

`src/components/library/TrackRow.test.tsx`:

```ts
import { DeezerTrack } from '@/lib/deezerApi'
```

Change to:

```ts
import type { DeezerTrack } from '@/types/track'
```

- [ ] **Step 9: Update ArtistPanel.tsx**

`src/components/search/ArtistPanel.tsx` line 3:

```ts
import { getArtist, getArtistTopTracks, type DeezerArtist } from '@/lib/deezerApi'
```

Change to:

```ts
import { getArtist, getArtistTopTracks } from '@/lib/deezerApi'
import type { DeezerArtist } from '@/types/track'
```

- [ ] **Step 10: Verify**

```bash
pnpm build && pnpm test:run
```

Expected: clean build, all tests pass.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "refactor: consolidate DeezerArtist/Album/Track types into track.ts"
```

---

### Task 4: Consolidate formatTime / formatDuration

`formatTime` is copy-pasted verbatim in `PlayerBar.tsx` and `WaveformLine.tsx`. `formatDuration` in `deezerApi.ts` is the same logic but lacks a guard for invalid inputs and uses no leading zero on minutes. Unify: update `formatDuration` to match the robust component implementation, update its tests, and remove the local copies.

**Files:**

- Modify: `src/lib/deezerApi.ts` — update `formatDuration` implementation
- Modify: `src/lib/deezerApi.test.ts` — update test expectations
- Modify: `src/components/player/PlayerBar.tsx` — delete local `formatTime`, import `formatDuration`
- Modify: `src/components/visualiser/WaveformLine.tsx` — delete local `formatTime`, import `formatDuration`

- [ ] **Step 1: Update formatDuration in deezerApi.ts**

Replace the current implementation:

```ts
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
```

With the robust version (matching what the components had):

```ts
export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}
```

- [ ] **Step 2: Update deezerApi.test.ts expectations**

`src/lib/deezerApi.test.ts` currently tests:

```ts
expect(formatDuration(0)).toBe('0:00')
expect(formatDuration(60)).toBe('1:00')
expect(formatDuration(65)).toBe('1:05')
expect(formatDuration(3601)).toBe('60:01')
```

Update to match new format (leading zeros on minutes) and add guard cases:

```ts
expect(formatDuration(0)).toBe('00:00')
expect(formatDuration(60)).toBe('01:00')
expect(formatDuration(65)).toBe('01:05')
expect(formatDuration(3601)).toBe('60:01')
expect(formatDuration(-1)).toBe('00:00')
expect(formatDuration(Infinity)).toBe('00:00')
```

- [ ] **Step 3: Run tests to confirm the new implementation matches**

```bash
pnpm test:run src/lib/deezerApi.test.ts
```

Expected: all tests in that file pass.

- [ ] **Step 4: Update PlayerBar.tsx**

In `src/components/player/PlayerBar.tsx`, add import at top (group with other `@/lib` imports):

```ts
import { formatDuration } from '@/lib/deezerApi'
```

Delete the local function (lines 50–55):

```ts
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}
```

Replace the two call sites from `formatTime(…)` to `formatDuration(…)`:

- `formatTime(currentTime)` → `formatDuration(currentTime)`
- `formatTime(duration)` → `formatDuration(duration)`

- [ ] **Step 5: Update WaveformLine.tsx**

In `src/components/visualiser/WaveformLine.tsx`, add import:

```ts
import { formatDuration } from '@/lib/deezerApi'
```

Delete the local function (lines 14–19):

```ts
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}
```

Replace call site: `formatTime(fraction * currentTrack.duration)` → `formatDuration(fraction * currentTrack.duration)`

- [ ] **Step 6: Verify**

```bash
pnpm build && pnpm test:run
```

Expected: clean build, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: consolidate formatTime copies into formatDuration in deezerApi"
```
