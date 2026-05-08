# Waveform

A cinematic music discovery interface where the audio **is** the UI. Every visual element reacts to what's actually playing — transforming search results into a responsive, 3D experience.


## What It Does

Waveform is a browser-based music player and visualiser built on the Deezer public API. It goes beyond simple bars to create an immersive environment:

- **Dynamic Theme Engine** — Extracts dominant hues from album art to generate a harmonious 8-color palette, skinning the entire UI (backgrounds, borders, accents) in real-time.
- **Advanced 3D Scene** — A floating field of album covers with a central reactive "Core Orb" and particle fields, enhanced with Bloom, Chromatic Aberration, and Vignette post-processing.
- **Hybrid Beat Detection** — Combines bass energy variance with a Spectral Flux algorithm to track beats with high confidence across genres.
- **Multi-Layer Visualisers** — Toggable visual layers (Ambient, Energy, Minimal) that combine GLSL shader backgrounds, 3D Waveform Tunnels, and Radial Frequency rings.
- **Fullscreen Mode** — Press 'F' for a distraction-free, immersive listening experience that prioritizes audio-reactive elements.
- **Genre Force Graph** — Reactive D3 force-directed graph where nodes "breathe" and edges pulse with the music.

---

## Stack

| Concern | Technology |
|---|---|
| Framework | React 18 + TypeScript + Vite |
| State | Zustand |
| Animation | Framer Motion |
| 3D & Shaders | R3F + Three.js (v0.170) + GLSL |
| Post-Processing | @react-three/postprocessing |
| Color Logic | tinycolor2 |
| Data visualisation | D3.js |
| Audio | Web Audio API (native browser) |

---

## Architecture Highlights

### Audio Pipeline & Hybrid Detection

The `AudioEngine` singleton wraps the Web Audio API. Frequency and waveform data are fanned out to canvas callbacks at 60fps. Beat detection uses two parallel strategies:
1. **Bass Energy**: Monitors threshold-breaking transients in the 0-170Hz range.
2. **Spectral Flux**: Measures the positive rate of change in the entire power spectrum, catching onsets that energy alone might miss.

```
AudioEngine (singleton)
  └── AnalyserNode (fftSize: 256)
        ├── getFrequencyData() → Visualisers
        └── Hybrid Beat Detector → visualiserStore { beat, confidence, bassPower }
                                      ├── Global CSS Variables (Theming)
                                      ├── Post-Processing Effects
                                      └── Scene Animations (R3F/D3)
```

### Dynamic Skinning

The `useAlbumColour` hook implements a custom color extraction algorithm. It samples pixel data, filters out desaturated noise, and uses `tinycolor2` to generate a palette of background, surface, primary, and secondary colors. These are injected as CSS variables (`--bg-color`, `--accent-color`, etc.) to provide instant global UI updates without React re-renders.

### Responsive Visualisers

All canvas and Three.js components utilize a custom `useResize` hook powered by `ResizeObserver`. This ensures that visualizers adapt seamlessly to layout changes and window resizing, maintaining immersion and pixel-perfect rendering.

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Vercel CLI (`pnpm add -g vercel`)

### Installation

```bash
pnpm install
```

### Running Locally

```bash
vercel dev
```

> **Important:** Use `vercel dev`, not `pnpm dev`. The Deezer CORS proxy rewrite only activates under `vercel dev`. Plain `pnpm dev` will produce CORS errors on all API requests.

Open [http://localhost:3000](http://localhost:3000).

---

## Interaction Shortcuts

| Key | Action |
|---|---|
| `/` | Focus search input |
| `Space` | Play / Pause |
| `←` / `→` | Navigate track list |
| `F` | Toggle Fullscreen Visualiser |
| `V` | Cycle Visual Layers (Ambient / Energy / Minimal) |

---

## License

MIT
