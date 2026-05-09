# Waveform

A music discovery interface where the audio **is** the UI. Every visual element reacts to what's actually playing — nothing is static when something is playing.

Live: [Deploy your own on Vercel](#deployment)  
Repo: https://github.com/Keagan-Herman/WaveForm

---

## What It Does

Waveform is a browser-based music player and visualiser built on the Deezer public API. Search for any artist or track, play 30-second previews, and watch the interface come alive:

- **Frequency spectrum** — real-time FFT bar visualiser driven by the Web Audio API
- **Waveform oscilloscope** — time-domain signal rendered to canvas at 60fps
- **Spectrogram** — scrolling frequency-over-time display
- **Radial visualiser** — circular frequency display
- **Album gravity field** — React Three Fiber scene of floating album covers that pulse on every detected beat
- **Genre force graph** — D3 force-directed graph of genre relationships; click any node to filter the track list
- **Background pulse** — the entire background shifts colour and brightness with the music
- **Album-reactive theming** — the entire UI recolours from the playing track's album art

---

## Stack

| Concern              | Technology                    |
|----------------------|-------------------------------|
| Framework            | React 18 + TypeScript + Vite  |
| State                | Zustand                       |
| Animation            | Framer Motion                 |
| 3D                   | React Three Fiber + Three.js  |
| Data visualisation   | D3.js                         |
| Audio                | Web Audio API (native browser)|
| Music API            | Deezer (no auth required)     |
| Deployment           | Vercel                        |

---

## Getting Started

### Prerequisites

- **Node.js 18+**
- **pnpm** — this project uses pnpm, not npm or yarn

```bash
npm install -g pnpm
```

- **Vercel CLI** — required for the Deezer CORS proxy to work in development

```bash
npm install -g vercel
```

### Install

```bash
git clone https://github.com/Keagan-Herman/WaveForm.git
cd WaveForm
pnpm install
```

### Run in development

```bash
vercel dev
```

**Why `vercel dev` and not `pnpm dev`?**  
Deezer's API blocks direct browser requests (CORS). The app proxies all API calls through Vercel's rewrite system (`/deezer-api/*` → `https://api.deezer.com/*`). This proxy only works when running through Vercel's dev server. Plain `vite dev` will work for everything except API calls.

If you don't want to install the Vercel CLI, you can mock the API responses or set up a local proxy manually — but `vercel dev` is the easiest path.

### Build

```bash
pnpm build
```

Runs `tsc -b` then `vite build`. Type errors will fail the build.

### Lint

```bash
pnpm lint
```

---

## Deployment

The app is configured for zero-config Vercel deployment.

1. Push to GitHub
2. Import the repo in [vercel.com](https://vercel.com)
3. Deploy — no environment variables required

The `vercel.json` rewrite handles the Deezer CORS proxy automatically. No API keys, no secrets, no serverless functions.

---

## Keyboard Shortcuts

| Key     | Action                       |
|---------|------------------------------|
| `Space` | Play / Pause                 |
| `←`     | Previous track               |
| `→`     | Next track                   |
| `F`     | Toggle fullscreen visualiser |
| `V`     | Cycle visual layer           |
| `/`     | Open search                  |

---

## Architecture Overview

### Audio Pipeline

The `AudioEngine` is a singleton class that wraps the Web Audio API. It is initialised exactly once on first user interaction (required by browser autoplay policy) and never recreated.

A single shared `requestAnimationFrame` loop reads frequency and waveform data from the analyser node and fans it out to all registered canvas callbacks — no React state involved at 60fps.

```
AudioEngine (singleton)
  └── AnalyserNode (fftSize: 256)
        ├── getFrequencyData() → FrequencyBars canvas
        ├── getWaveformData()  → WaveformLine canvas
        └── BeatDetector       → visualiserStore { beat, bassPower }
                                      ├── BackgroundPulse (React)
                                      └── AlbumGravityField (R3F useFrame)
```

### Three Independent Render Loops

The app runs three loops that never conflict:

1. **rAF canvas loop** — reads `AudioEngine`, writes to `<canvas>` imperatively
2. **R3F `useFrame` loop** — reads `visualiserStore.getState()` (imperative, no subscription), drives Three.js objects
3. **D3 simulation tick** — D3 manages its own internal timer, React owns only the `<svg>` container

Raw `Uint8Array` frequency data never enters Zustand. Only the derived `beat` boolean and `bassPower` float cross into the store, keeping React re-renders minimal.

### D3 / React Boundary

`GenreForceGraph` enforces a strict boundary. React renders one thing: the `<svg>` container. D3 owns everything inside it — node creation, position updates, event handlers, and transitions. The simulation lives in a `useRef` and is never recreated on re-renders.

### CORS Proxy

Deezer's API blocks direct browser requests. A Vercel rewrite proxies all API calls through the app's own domain — no serverless function or API key needed.

```
/deezer-api/* → https://api.deezer.com/*
```

---

## Contributing / AI Agent Context

If you're using an AI agent (Claude, Jules, etc.) to work on this codebase, point it at:

- **`AGENTS.md`** — primary context file: architecture, conventions, things to avoid
- **`CLAUDE.md`** — Claude-specific instructions
- **`PROJECT-BRIEF.md`** — current build state, decisions, and known issues