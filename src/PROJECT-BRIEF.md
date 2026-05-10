# PROJECT-BRIEF.md — Waveform: Current State and Decisions

Last updated: May 2026

This file documents what has been built, what decisions were made and why, and what the known state of the codebase is. Read `AGENTS.md` for conventions and architecture rules.

---

## Build Status

All eight phases are complete. The app is deployed and functional on Vercel.

| Phase | Scope                                                                                                   | Status      |
| ----- | ------------------------------------------------------------------------------------------------------- | ----------- |
| 0     | Scaffold — Vite, tsconfig, ESLint, Prettier, folder structure                                           | ✅ Complete |
| 1     | AudioEngine singleton, BeatDetector, AudioContext provider, shared rAF loop via `useAudioAnalyser`      | ✅ Complete |
| 2     | FrequencyBars canvas, WaveformLine oscilloscope, BackgroundPulse with Zustand                           | ✅ Complete |
| 3     | Deezer API integration (`deezerApi.ts`, `useDeezerSearch`), Vercel rewrite proxy                        | ✅ Complete |
| 4     | `playerStore` (Zustand), `PreviewPlayer` hidden audio element, `PlayerBar` UI                           | ✅ Complete |
| 5     | `TrackRow`, `SearchOverlay`, `ArtistRipple`, `NowPlaying` panel, `useReducedMotion`, keyboard shortcuts | ✅ Complete |
| 6     | `AlbumMesh`, `AlbumGravityField` via React Three Fiber                                                  | ✅ Complete |
| 7     | D3 force-directed `GenreForceGraph`, `GenrePanel`, `useGenreGraph`, genre-based track filtering         | ✅ Complete |

---

## Critical Architectural Decision: Deezer, Not Spotify

**Why Deezer?**
Spotify was the original API choice. During Phase 3, we discovered that Spotify's Development Mode now requires Premium accounts to play audio. This broke the core feature of the app — 30-second preview playback.

Deezer was chosen as the replacement because:

- Free, public search endpoints — no API key or OAuth required
- Every track result includes a 30-second preview MP3 (`preview` field) — guaranteed, never null
- No serverless token proxy needed (Spotify required a `/api/spotify-token` function)
- CORS is handled by a single Vercel rewrite rule in `vercel.json` — no function, no secret

**The only infrastructure needed:**

```json
// vercel.json
{
  "rewrites": [
    {
      "source": "/deezer-api/:path*",
      "destination": "https://api.deezer.com/:path*"
    }
  ]
}
```

This is permanent. Do not reintroduce Spotify.

---

## TypeScript Config Fixes Applied

Several tsconfig issues were resolved during development. These are already fixed in the repo:

- Removed deprecated `baseUrl` from `tsconfig.json` — path aliases use Vite's `resolve.alias`
- Added `composite: true` to `tsconfig.node.json` — required for project references
- Added missing `React` imports for `React.CSSProperties` usages

---

## The Audio Pipeline

```
User clicks play
  → PreviewPlayer sets <audio>.src = track.preview
  → AudioEngine.init(audioElement) called once on first interaction
  → AudioContext created, AnalyserNode wired up

Per frame (rAF in useAudioAnalyser module):
  → audioEngine.getFrequencyData() → Uint8Array (128 bins)
  → audioEngine.getWaveformData()  → Uint8Array (256 samples)
  → BeatDetector.detect(freqData)  → { beat, confidence, bassEnergy }
  → useVisualiserStore.getState().setBeat(beat)      ← only this crosses into Zustand
  → useVisualiserStore.getState().setBassPower(...)
  → all canvas subscribers called with (freqData, waveData)

Canvas subscribers:
  → FrequencyBars draws bars directly to canvas
  → WaveformLine draws oscilloscope directly to canvas
  → Spectrogram scrolls and draws to canvas

R3F useFrame loop (independent):
  → reads useVisualiserStore.getState().beat (no subscription)
  → drives AlbumMesh scale pulses
  → drives CoreOrb shader uniforms
```

**Why `useVisualiserStore.getState()` inside `useFrame`?**
Calling `useVisualiserStore(state => state.beat)` inside `useFrame` would subscribe R3F to Zustand, causing React re-renders on every beat. `getState()` reads the value imperatively without subscribing — the Three.js objects update without touching React at all.

---

## The D3 / React Boundary in GenreForceGraph

This is the strictest boundary in the codebase. The rule is:

> React renders one `<svg>` element. D3 owns everything inside it.

Implementation:

- `GenreForceGraph.tsx` takes `width`, `height`, `nodes`, `links`, and a callback prop
- It renders `<svg ref={svgRef}>` only
- Inside a `useEffect`, D3 selects `svgRef.current` and creates all elements imperatively
- The simulation is stored in `simulationRef` (a `useRef`) — never recreated
- When graph data changes, the effect updates `simulation.nodes(newNodes)` and calls `.alpha(0.3).restart()`
- D3 event handlers (click, hover) are attached by D3, not React

Do not refactor this to use React for node rendering. The force simulation requires D3 to own position updates, and React's reconciliation would fight it.

---

## The AlbumColour System

`useAlbumColour(imageUrl)` is the global theming hook. It:

1. Fetches the album art image via `fetch`
2. Draws it to an off-screen canvas
3. Samples pixel colours to derive a palette
4. Returns an `AlbumColour` object with:
   - `hex` — primary accent colour
   - `palette` — full set: `background`, `surface`, `primary`, `secondary`, `accent`, `text`, `textDim`, `border`
   - `hue`, `saturation`, `lightness`

The palette is injected as CSS custom properties on `:root` in `App.tsx`:

```ts
root.style.setProperty('--bg-color', palette.background)
// ... etc
```

All components that need colour receive `accent: AlbumColour` as a prop. No component fetches its own colour — it always comes from the top.

---

## Render Loop Coexistence — Confirmed Working

Three independent loops run simultaneously without conflict:

1. `useAudioAnalyser` module-level rAF — canvas writes only
2. R3F `useFrame` — Three.js object mutations only
3. D3 force simulation tick — SVG DOM mutations only

This was validated during Phase 6. Key insight: they only conflict if they share mutable React state. Since all three write imperatively to their own output (canvas / Three.js scene / SVG), they coexist cleanly.

---

## Keyboard Shortcuts

Implemented in `KeyboardShortcuts` component inside `App.tsx`:

| Key     | Action                       |
| ------- | ---------------------------- |
| `Space` | Play / Pause                 |
| `←`     | Previous track in queue      |
| `→`     | Next track in queue          |
| `F`     | Toggle fullscreen visualiser |
| `V`     | Cycle visual layer           |
| `/`     | Open search (displayed only) |

Shortcuts are disabled when focus is on `INPUT` or `TEXTAREA`.

---

## Visual Layers

`visualiserStore.ts` tracks `visualLayer: 'Ambient' | 'Energy' | 'Minimal'`. This is cycled with `V`. Components read this to adjust their rendering intensity. Currently used by `FullscreenOverlay` and `BackgroundPulse`.

---

## Known Issues / Future Work

- The `Spectrogram` filename typo has been fixed.
- Genre data from Deezer requires a second API fetch per album (`getAlbumGenres`). This is intentional — the search endpoint doesn't include genres. Results are cached via `fetchWithCache`.
- `useAlbumColour` does its own canvas-based colour sampling (tinycolor2). If performance is ever a concern, this could be debounced more aggressively or moved to a web worker.
- The HQ/Low Quality toggle (`isLowQuality` in `visualiserStore`) exists but its effect on individual components is partial — not all visualisers respond to it yet.
- There is no test suite. This is a portfolio project — tests were deprioritised in favour of visual polish.

---

## GitHub Repository

https://github.com/Keagan-Herman/WaveForm
