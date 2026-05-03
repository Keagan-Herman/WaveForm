# Waveform

A music discovery interface where the audio **is** the UI. Every visual element reacts to what's actually playing — nothing is static when something is playing.


## What It Does

Waveform is a browser-based music player and visualiser built on the Deezer public API. Search for any artist or track, play 30-second previews, and watch the interface come alive:

- **Frequency spectrum** — real-time FFT bar visualiser driven by the Web Audio API
- **Waveform oscilloscope** — time-domain signal rendered to canvas at 60fps
- **Bass energy meter** — derived from low-frequency bin averages
- **Album gravity field** — React Three Fiber scene of floating album covers that pulse on every detected beat
- **Genre force graph** — D3 force-directed graph of genre relationships, click any node to filter the track list
- **Background pulse** — the entire background subtly shifts colour and brightness with the music

---

## Stack

| Concern | Technology |
|---|---|
| Framework | React 18 + TypeScript + Vite |
| State | Zustand |
| Animation | Framer Motion |
| 3D | React Three Fiber + Three.js |
| Data visualisation | D3.js |
| Audio | Web Audio API (native browser) |
| Music API | Deezer (no auth required) |
| Deployment | Vercel |

---

## Architecture Highlights

### Audio Pipeline

The `AudioEngine` is a singleton class that wraps the Web Audio API. It is initialised exactly once on first user interaction (required by browser autoplay policy) and never recreated. A single shared `requestAnimationFrame` loop reads frequency and waveform data from the analyser node and fans it out to all registered canvas callbacks — no React state involved at 60fps.

```
AudioEngine (singleton)
  └── AnalyserNode (fftSize: 256)
        ├── getFrequencyData() → FrequencyBars canvas
        ├── getWaveformData()  → WaveformLine canvas
        └── BeatDetector       → visualiserStore { beat, bassPower }
                                      ├── BackgroundPulse (React)
                                      └── AlbumGravityField (R3F useFrame)
```

### Three Render Loops

The app runs three independent render loops that never conflict:

1. **rAF canvas loop** — reads `AudioEngine`, writes to `<canvas>` imperatively
2. **R3F `useFrame` loop** — reads `visualiserStore.getState()` (imperative, no subscription)
3. **D3 simulation tick** — D3 manages its own internal timer, React owns only the `<svg>` container

Raw `Uint8Array` frequency data never enters Zustand. Only the derived `beat` boolean and `bassPower` float cross into the store, keeping re-renders minimal.

### D3 / React Boundary

`GenreForceGraph` is the strictest boundary in the project. React renders one thing: the `<svg>` container. D3 owns everything inside it — node creation, position updates, event handlers, and transitions. The simulation is initialised once in a `useRef` and updated via `simulation.nodes().alpha().restart()` when data changes, never recreated.

### CORS Proxy

Deezer's API blocks direct browser requests. A Vercel rewrite proxies all API calls through the app's own domain:

```
/deezer-api/* → https://api.deezer.com/*
```

No serverless function needed — the rewrite handles it at the edge. No API key, no auth, no rate limit concerns for a portfolio demo.

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Vercel CLI (`pnpm add -g vercel`)

### Installation

```bash
git clone https://github.com/yourusername/waveform.git
cd waveform
pnpm install
```

### Running Locally

```bash
vercel dev
```

> **Important:** Use `vercel dev`, not `pnpm dev`. The Deezer CORS proxy rewrite only activates under `vercel dev`. Plain `pnpm dev` will produce CORS errors on all API requests.

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

No environment variables are required. Deezer's search API is fully public.

If you add future integrations (Last.fm scrobbling, etc.), follow this convention in `.env.local`:

```bash
VITE_SOME_PUBLIC_KEY=abc123     # VITE_ prefix = bundled into client JS
SOME_PRIVATE_SERVER_KEY=xyz789  # No prefix = server-side only
```

---

## Project Structure

```
waveform/
├── api/                          # Vercel serverless functions (none currently)
├── src/
│   ├── audio/
│   │   ├── AudioEngine.ts        # Web Audio API singleton
│   │   ├── BeatDetector.ts       # Sliding window onset detector
│   │   └── AudioContext.tsx      # React context provider
│   ├── components/
│   │   ├── visualiser/
│   │   │   ├── FrequencyBars.tsx  # Canvas FFT bar visualiser
│   │   │   ├── WaveformLine.tsx   # Canvas oscilloscope
│   │   │   └── BackgroundPulse.tsx
│   │   ├── library/
│   │   │   ├── AlbumGravityField.tsx  # R3F floating album art
│   │   │   ├── AlbumMesh.tsx          # Individual R3F album card
│   │   │   ├── GenreForceGraph.tsx    # D3 force-directed graph
│   │   │   ├── GenrePanel.tsx         # Graph + filter wrapper
│   │   │   ├── NowPlaying.tsx         # Right panel detail view
│   │   │   └── TrackRow.tsx           # Search result row
│   │   ├── player/
│   │   │   ├── PlayerBar.tsx      # Fixed bottom player controls
│   │   │   └── PreviewPlayer.tsx  # Hidden <audio> element
│   │   └── search/
│   │       ├── SearchOverlay.tsx  # Left panel search + results
│   │       └── ArtistRipple.tsx   # Hover ripple effect
│   ├── hooks/
│   │   ├── useAudioAnalyser.ts   # Shared rAF loop with subscriber registry
│   │   ├── useDeezerSearch.ts    # Debounced search hook
│   │   ├── useGenreGraph.ts      # Fetches album genres, builds graph data
│   │   └── useReducedMotion.ts   # prefers-reduced-motion hook
│   ├── lib/
│   │   ├── deezerApi.ts          # Deezer API wrapper
│   │   ├── genreGraph.ts         # D3 graph data builder
│   │   └── cache.ts              # In-memory request cache with TTL
│   ├── stores/
│   │   ├── playerStore.ts        # Track, playback state, queue
│   │   └── visualiserStore.ts    # beat, bassPower (derived audio state)
└── vercel.json                   # Deezer CORS proxy rewrite
```

---

## Known Limitations

**Beat detection** — the `BeatDetector` uses a sliding window average on bass energy. It works well on music with hard transient kicks (electronic, hip-hop, rock) but will produce false positives on tracks with sustained bass (jazz, classical) and may miss beats on heavily compressed pop. This is a heuristic detector, not a ground-truth onset detector.

**Genre graph** — Deezer's genre data comes from album metadata, not artist tags. Genres are broader categories (Rock, Pop, Electronic) rather than micro-genres. The graph clusters at a higher level than a Spotify artist-genre approach would.

**Preview length** — all playback uses Deezer's 30-second preview clips. Full track playback is not available without the Deezer Connect SDK.

**Desktop only** — the canvas + R3F combination is desktop-first. Mobile layout is not optimised.

**Canvas dimensions** — frequency bars and waveform use fixed pixel widths rather than a `ResizeObserver`. They will not adapt if the browser window is resized mid-session.

---

## Deployment

```bash
vercel --prod
```

No environment variables need to be set in the Vercel dashboard for the current build.

---

## Development Notes

### Why Deezer instead of Spotify?

Spotify introduced significant restrictions to their developer platform in February 2026, requiring Spotify Premium for all Development Mode app owners and limiting new integrations. Deezer provides equivalent functionality — track search, album art, 30-second preview MP3s — with no authentication required, making it a better fit for an open portfolio project.

### Why not `pnpm dev`?

Vite's dev server does not process `vercel.json` rewrites. The Deezer proxy rewrite (`/deezer-api/*`) only activates under `vercel dev`, which runs both the Vite dev server and Vercel's edge network locally. Without it, all Deezer API calls will be blocked by CORS.

### Why React 18 instead of React 19?

`@react-three/fiber` and `@react-three/drei` have incompatible peer dependencies
with React 19 at the time of writing — specifically around `react-reconciler`
and `use-sync-external-store`. React 18.3.1 is the latest stable version with
full R3F ecosystem support. No React 19-specific features are used in this
project, so the downgrade has zero functional impact.

---

## License

MIT