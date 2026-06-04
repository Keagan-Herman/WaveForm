# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Read `src/AGENTS.md` and `src/CLAUDE.md` before making any changes.** They contain the authoritative architectural rules, Deezer API shape, coding conventions, and list of things to avoid. This file covers commands and top-level orientation only.

---

## Commands

```bash
# Development — must use vercel dev for the Deezer CORS proxy
vercel dev

# Build (type-check + bundle)
pnpm build

# Lint
pnpm lint

# Format
npx prettier --write src/

# Tests (watch mode)
pnpm test

# Tests (CI / single run)
pnpm test:run

# Preview production build
pnpm preview
```

**Critical:** `pnpm dev` (plain Vite) hits CORS errors on all Deezer API calls. Always use `vercel dev` for local development. The `vercel.json` rewrite maps `/deezer-api/*` → `https://api.deezer.com/*` server-side.

---

## What This Project Is

**Waveform** is a browser-based music discovery and visualisation interface backed by the Deezer public API (no auth required). Users search for tracks, play 30-second previews, and watch the UI react in real time via beat detection, frequency analysis, and album-art-reactive theming.

It is a solo portfolio project — decisions prioritise visual impact and technical depth over scalability.

---

## Architecture at a Glance

Three independent render loops share the screen and must never interfere:

| Loop | Location | Feeds |
|------|----------|-------|
| rAF canvas | `useAudioAnalyser.ts` (module-level) | Canvas visualisers (imperative draw) |
| R3F `useFrame` | inside R3F components | Three.js objects via `useVisualiserStore.getState()` |
| D3 simulation | `GenreForceGraph.tsx` | D3-owned SVG nodes only |

**Audio pipeline:** `AudioEngine.ts` (singleton) → `useAudioAnalyser.ts` (60fps rAF broker) → canvas callbacks. Raw `Uint8Array` data **never** enters React state or Zustand. Only `beat: boolean` and `bassPower: number` cross into Zustand.

**State:** Three Zustand stores — `playerStore` (playback), `visualiserStore` (audio-reactive + UI modes), `uiStore` (lightweight UI). R3F components read stores imperatively inside `useFrame`, not via subscriptions.

**Theming:** `useAlbumColour(imageUrl)` extracts a full palette from album art. The resulting `AlbumColour` object is passed as `accent` to all components. No hardcoded colours in visualiser components.

**API:** All Deezer calls go through `deezerFetch` in `src/lib/deezerApi.ts`, which prefixes `/deezer-api`. Never construct `https://api.deezer.com` URLs directly.

---

## TypeScript Config

- Strict mode, `noUnusedLocals`, `noUnusedParameters` enforced — prefix unused params with `_`
- `erasableSyntaxOnly: true` — no `const enum`, no `namespace`
- Path alias: `@/` → `src/`
- Target: ES2023

---

## Key Rules (enforced always, not just when asked)

1. Raw audio data (`Uint8Array`) never enters React state or Zustand.
2. `AudioEngine` is a singleton — import `audioEngine`, never `new AudioEngine()`.
3. D3 owns its DOM; React owns only the `<svg>` container ref.
4. R3F `useFrame` reads store state imperatively — never subscribes via React.
5. All Deezer API calls go through `deezerFetch`.
6. Use `pnpm`, not `npm` or `yarn`.
