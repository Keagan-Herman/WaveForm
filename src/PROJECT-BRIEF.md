# PROJECT-BRIEF.md — Waveform: Current State and Decisions

Last updated: May 2026

This file documents what has been built, what decisions were made and why, and what the known state of the codebase is. Read `AGENTS.md` for conventions and architecture rules.

---

## Build Status

All primary phases and advanced visual tiers are complete. The app is a high-performance music discovery interface with advanced audio-reactive visualisers.

| Phase | Scope                                                                                                   | Status      |
| ----- | ------------------------------------------------------------------------------------------------------- | ----------- |
| 0-7   | Core Architecture: AudioEngine, D3 Genre Map, R3F Album Field, Deezer Integration                       | ✅ Complete |
| 8     | **Audio Orb**: Custom GLSL shader with Perlin noise & frequency displacement                            | ✅ Complete |
| 9     | **Butterchurn**: Integration of MilkDrop WebGL2 presets                                                | ✅ Complete |
| 10    | **Audio Terrain**: R3F plane with vertex displacement driven by bass & frequency                       | ✅ Complete |
| 11    | **Transitions**: Shared element transitions (Framer Motion `layoutId`) for album art                   | ✅ Complete |
| 12    | **UX Polish**: Keyboard navigation for search, artist panels, and responsive grid                      | ✅ Complete |

---

## Critical Architectural Decisions

### 1. High-Frequency State Management
Raw audio data (Uint8Array) is **never** put into React state or Zustand. Instead:
- `useAudioAnalyser` runs a module-level `requestAnimationFrame` loop.
- Canvas components register imperative callbacks to receive raw buffers.
- R3F components use `useFrame` to pull only derived scalar values (`beat`, `bassPower`) from Zustand via `getState()` (bypassing subscriptions).
- This ensures 60fps performance without React reconciliation overhead.

### 2. The Deezer / Vercel Stack
- **Deezer API**: Chosen for its public accessibility and guaranteed 30s MP3 previews.
- **Vercel Rewrites**: Solves CORS by proxying `/deezer-api/*` to `api.deezer.com` server-side. No serverless functions or API keys required.

### 3. Strict Boundary Architecture
- **D3 (Genre Map)**: React owns the `<svg>` container; D3 owns the internal DOM and simulation logic.
- **Three.js (Album Field/Orb)**: R3F manages the lifecycle, but state updates are imperative inside `useFrame`.
- **Canvas (Spectrogram/Bars)**: Fully imperative drawing based on `AudioEngine` events.

---

## Technical Achievements

### Hybrid Beat Detection
The `BeatDetector` uses a dual-engine approach:
1. **Bass Energy Variance**: Detects onsets in the low-frequency range relative to a rolling window of history.
2. **Spectral Flux**: Measures the positive change in the power spectrum across all bins to detect percussive hits across the frequency range.
3. **BPM Estimation**: Calculates real-time BPM based on the interval between high-confidence onsets.

### GPU-Accelerated Shaders
Components like `AudioOrb` and `AudioTerrain` use `THREE.DataTexture` to pass 128 bins of frequency data directly into GLSL vertex shaders. This allows for complex geometry morphing (displacement mapping) that is calculated entirely on the GPU.

### Album-Reactive Theming
The `useAlbumColour` system extracts a full palette from album art and injects it as global CSS variables. Visualisers adapt their gradients and shader uniforms dynamically to maintain visual harmony with the music.

---

## Keyboard Shortcuts

| Key     | Action                       |
| ------- | ---------------------------- |
| `Space` | Play / Pause                 |
| `←` / `→` | Previous / Next track      |
| `F`     | Toggle fullscreen visualiser |
| `V`     | Cycle visual layer (Ambient, Energy, Minimal, Presets) |
| `/`     | Focus search input           |
| `J` / `K` | Navigate search results    |
| `Enter` | Play selected search result |
| `P`     | Cycle Butterchurn presets    |

---

## Deployment
Configured for zero-config Vercel deployment via `vercel.json`. Local development requires `vercel dev` for API parity.
