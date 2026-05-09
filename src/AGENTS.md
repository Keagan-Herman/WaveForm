# AGENTS.md — Waveform Project Context

Primary shared context for all AI agents (Claude, Google Jules, etc.).
Read this file before making any changes to the codebase.

---

## Project Overview

**Waveform** is a portfolio music visualiser web app. It is a browser-based music player and discovery interface built around the Deezer public API. The goal is a polished, production-ready project that demonstrates full-stack frontend capability across audio processing, 3D rendering, data visualisation, and UI/UX.

Users search for tracks, play 30-second previews, and watch the interface react in real time: frequency bars, oscilloscope lines, a 3D album gravity field, a D3 genre force graph, and a background that pulses and recolours with every beat.

This is a solo portfolio project — not a product. Decisions prioritise visual impact and technical depth over scalability or backend concerns.

---

## Tech Stack

| Concern              | Technology                              | Version    |
|----------------------|-----------------------------------------|------------|
| Framework            | React                                   | 18.3.1     |
| Language             | TypeScript                              | ~6.0.2     |
| Build tool           | Vite                                    | ^8.0.10    |
| State management     | Zustand                                 | ^4.5.7     |
| Animation            | Framer Motion                           | ^12.38.0   |
| 3D rendering         | React Three Fiber + Three.js            | ^8.17.10 / ^0.170.0 |
| 3D helpers           | @react-three/drei                       | 9.122.0    |
| Data visualisation   | D3.js                                   | ^7.9.0     |
| Gesture handling     | @use-gesture/react                      | ^10.3.1    |
| Colour extraction    | tinycolor2                              | ^1.6.0     |
| Audio                | Web Audio API (native browser)          | —          |
| Music API            | Deezer (no auth required)               | public     |
| Deployment           | Vercel                                  | —          |
| Linting              | ESLint + typescript-eslint              | ^10 / ^8   |
| Formatting           | Prettier                                | ^3.8.3     |
| Package manager      | pnpm                                    | —          |

**Note on package manager:** Use `pnpm`. Do not use `npm` or `yarn`. The lockfile is `pnpm-lock.yaml`.

---

## Folder Structure

```
waveform/
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── audio/                  # Web Audio API layer
│   │   ├── AudioContext.tsx    # React context provider — wraps AudioEngine
│   │   ├── AudioEngine.ts      # Singleton — owns AudioContext + AnalyserNode
│   │   └── BeatDetector.ts     # Beat/onset detection from frequency data
│   ├── components/
│   │   ├── library/            # Track library, genre graph, now-playing panel
│   │   │   ├── AlbumGravityField.tsx   # R3F scene — floating album covers
│   │   │   ├── AlbumMesh.tsx           # R3F mesh for a single album
│   │   │   ├── CoreOrb.tsx             # R3F central orb in gravity field
│   │   │   ├── GenreForceGraph.tsx     # D3 force-directed genre graph (D3 owns DOM)
│   │   │   ├── GenrePanel.tsx          # Wrapper/UI for genre graph
│   │   │   ├── NowPlaying.tsx          # Expanded track info panel
│   │   │   ├── ParticleField.tsx       # R3F particle system
│   │   │   └── TrackRow.tsx            # Single track in search results
│   │   ├── player/             # Audio playback controls
│   │   │   ├── PlayerBar.tsx           # Bottom player bar UI
│   │   │   └── PreviewPlayer.tsx       # Hidden <audio> element, wires to AudioEngine
│   │   ├── search/             # Search UI
│   │   │   ├── ArtistRipple.tsx        # Ripple animation on artist hover
│   │   │   └── SearchOverlay.tsx       # Search input + results list
│   │   └── visualiser/         # Canvas and R3F visualiser components
│   │       ├── BackgroundPulse.tsx     # Full-screen background beat reaction
│   │       ├── FluidBackground.tsx     # Animated background layer
│   │       ├── FrequencyBars.tsx       # Canvas FFT bar visualiser
│   │       ├── FullscreenOverlay.tsx   # Fullscreen visualiser mode
│   │       ├── LissaJousVisualiser.tsx # Lissajous curve visualiser
│   │       ├── RadialVisualiser.tsx    # Radial frequency visualiser
│   │       ├── Spectogram.tsx          # Scrolling spectrogram canvas
│   │       ├── WaveformLine.tsx        # Canvas oscilloscope line
│   │       └── WaveformTunnel.tsx      # Tunnel effect visualiser
│   ├── hooks/
│   │   ├── useAlbumColour.ts   # Extracts colour palette from album art URL
│   │   ├── useAudioAnalyser.ts # Shared rAF loop — fans out freq/wave data to subscribers
│   │   ├── useDeezerSearch.ts  # Debounced Deezer search hook
│   │   ├── useGenreGraph.ts    # Prepares graph data for GenreForceGraph
│   │   ├── useReducedMotion.ts # Reads prefers-reduced-motion media query
│   │   └── useResize.ts        # ResizeObserver hook
│   ├── lib/
│   │   ├── cache.ts            # In-memory request cache with TTL
│   │   ├── deezerApi.ts        # Deezer REST API wrapper + TypeScript types
│   │   └── genreGraph.ts       # Genre graph data utilities
│   ├── stores/
│   │   ├── playerStore.ts      # Zustand — playback state (track, queue, progress)
│   │   └── visualiserStore.ts  # Zustand — audio-reactive state (beat, bassPower, layer)
│   ├── App.tsx                 # Root component — layout grid, wires everything together
│   ├── App.css
│   ├── index.css               # Global CSS variables and reset
│   └── main.tsx                # Vite entry point
├── .eslintrc.json
├── .prettierrc
├── eslint.config.js
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
└── vercel.json                 # Deezer CORS proxy rewrite
```

---

## Build, Run, Test, Lint Commands

```bash
# Install dependencies
pnpm install

# Development server (with Vercel dev for CORS proxy)
pnpm dev
# NOTE: `vite` alone won't proxy Deezer. Use `vercel dev` in production parity:
vercel dev

# Type-check
pnpm build           # runs tsc -b then vite build

# Lint
pnpm lint

# Format (run Prettier)
npx prettier --write src/

# Preview production build
pnpm preview
```

**Important:** The Deezer API proxy only works when running through Vercel's dev server (`vercel dev`) or deployed to Vercel. Raw `pnpm dev` (plain Vite) will hit CORS errors on API calls. All requests to `/deezer-api/*` are rewritten to `https://api.deezer.com/*` by `vercel.json`.

---

## Architectural Principles

### 1. AudioEngine is a singleton — never recreate it
`AudioEngine.ts` exports a single instance (`audioEngine`). Import this instance everywhere. Never call `new AudioEngine()`. The `AudioContext` is a limited browser resource — creating multiples causes glitches and errors.

### 2. Frequency data never enters React state
The rAF loop in `useAudioAnalyser.ts` runs at 60fps. Raw `Uint8Array` frequency/waveform data is written directly to canvas via imperative callbacks. Only two derived values cross into Zustand: `beat` (boolean) and `bassPower` (float). This keeps React re-renders minimal.

### 3. Three render loops coexist — keep them separate
- **rAF canvas loop** — `useAudioAnalyser` module-level loop, writes to `<canvas>` imperatively
- **R3F `useFrame` loop** — reads from `useVisualiserStore.getState()` (not a subscription), drives Three.js objects
- **D3 simulation tick** — D3's internal timer, touches only D3-managed DOM nodes

These loops must never interfere with each other. Do not put Three.js objects into React state. Do not put D3 nodes under React control.

### 4. D3 owns its DOM — React owns only the container
In `GenreForceGraph.tsx`, React renders one `<svg>` element and passes a ref to D3. D3 creates all nodes, links, labels, and handles all events inside that SVG. React does not touch D3-managed elements. The simulation is stored in a `useRef`, never recreated on re-renders — only `.nodes()`, `.alpha()`, and `.restart()` are called when data changes.

### 5. Deezer API shape — key differences from Spotify
When working with track data, remember:
- `artist` is a single object, not an array
- `preview` is the 30s MP3 URL (not `preview_url`)
- `duration` is in **seconds** (not milliseconds)
- `rank` is the popularity proxy (not `popularity`)
- Every track has a `preview` URL — no filtering for null previews needed
- Genre data comes from `getAlbumGenres(albumId)` — a separate fetch, not on the track object

### 6. CORS proxy — all Deezer calls go through `/deezer-api/*`
Do not construct `https://api.deezer.com/...` URLs directly. Use the `deezerFetch` helper in `deezerApi.ts`, which prefixes `/deezer-api`. Vercel rewrites these to the real API server-side, bypassing CORS. This works in `vercel dev` and production — not in plain `vite dev`.

### 7. AlbumColour propagation
The `useAlbumColour` hook extracts a full palette from the current track's album art and returns an `AlbumColour` object. This object is passed as `accent` to all components that need theming. CSS variables on `:root` are also updated. Do not hardcode colours in visualiser components — use the `accent` prop or CSS variables.

### 8. AudioContext must be created inside a user gesture
Browser autoplay policy blocks `new AudioContext()` until the user has interacted with the page. `AudioEngine.init()` must be called from a click or keydown handler. It is idempotent — calling it twice is safe.

---

## Coding Style and Conventions

### TypeScript
- Strict mode is on. No `any` without a comment explaining why.
- Use `type` imports: `import type { Foo } from '...'`
- All component props have named interfaces (e.g. `interface FrequencyBarsProps`)
- `noUnusedLocals` and `noUnusedParameters` are enforced — prefix unused params with `_`
- `erasableSyntaxOnly: true` — no `const enum`, no `namespace`

### Formatting (Prettier)
```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "arrowParens": "avoid"
}
```

### Imports
- Path alias `@/` maps to `src/` — always use it for internal imports
- External imports first, then internal, then types

### Component structure
1. Interface definitions
2. Hook calls (no conditional hooks)
3. Imperative setup (refs, effects)
4. Return JSX
5. Inline styles at the bottom if using `React.CSSProperties` style objects

### Canvas components
- Canvas `ref` is always a `useRef<HTMLCanvasElement>`
- Never put canvas pixels or frequency arrays in React state
- Clear and redraw imperatively inside rAF callbacks

### Naming
- Components: `PascalCase`
- Hooks: `useCamelCase`
- Stores: `useCamelCaseStore`
- Types/interfaces: `PascalCase`
- Files: match their default export name exactly

---

## Things to Avoid

- **Do not add a backend or serverless functions.** The Vercel rewrite handles CORS. No token proxy is needed — Deezer is public.
- **Do not use Spotify.** The project switched to Deezer because Spotify requires Premium for Development Mode. Do not reintroduce Spotify dependencies.
- **Do not put raw audio data (Uint8Array) in Zustand or React state.** This causes 60fps re-renders of the entire tree.
- **Do not create new AudioContext instances.** Use the singleton.
- **Do not recreate D3 simulations on data changes.** Update existing ones via `.nodes()` and `.restart()`.
- **Do not use `npm` or `yarn`.** This project uses `pnpm`.
- **Do not add `baseUrl` to `tsconfig.json`** — it's deprecated; path aliases are configured in Vite via `resolve.alias`.
- **Do not hardcode colour values** in visualiser components. Use the `accent: AlbumColour` prop or CSS variables.
- **Do not use `const enum` or TypeScript namespaces** — `erasableSyntaxOnly: true` is enforced.

---

## How to Structure New Features

### New visualiser component
1. Create `src/components/visualiser/MyVisualiser.tsx`
2. Accept `accent: AlbumColour` and `width`/`height` props
3. Use `useAudioAnalyser({ onFrequencyData, onWaveformData })` for audio data
4. Call `start()` in a `useEffect` tied to playback state
5. Write to a canvas ref imperatively — never to state
6. Export and wire up in `App.tsx`

### New Deezer API call
1. Add the function to `src/lib/deezerApi.ts` using `deezerFetch`
2. Add the TypeScript return type in the same file
3. Wrap with `fetchWithCache` in any hook that calls it

### New hook
1. Create in `src/hooks/`
2. If it encapsulates state, consider whether the state belongs in a Zustand store instead
3. Return a stable interface — don't expose internals

### New Zustand store
1. Create in `src/stores/`
2. Define the interface above the `create` call
3. Keep actions colocated with state
4. Only store derived/UI state — not raw audio data

---

## External API Reference

**Deezer API** (via `/deezer-api` proxy):
- `GET /search?q={query}&limit=25&index=0` — track search
- `GET /search/artist?q={query}&limit=10` — artist search
- `GET /track/{id}` — full track details
- `GET /artist/{id}` — artist details
- `GET /album/{id}` — album details including genres
- No API key required. No rate limits documented (be reasonable).
- Preview URLs are always 30-second MP3s, always present on search results.