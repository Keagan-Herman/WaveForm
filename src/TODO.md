# TODO.md — Waveform: What's Next

Prioritised by wow-factor-per-effort. Tier 1 items are the ones that make someone stop scrolling. Tier 2 items are genuine polish. Tier 3 are quality-of-life fixes that matter but won't impress anyone on first glance.

See `TODO-APPROACH.md` for implementation notes on each item.

---

## Tier 1 — Stop-Scrolling Moments

These are the features that separate a portfolio project from a demo. Each one requires real architectural thinking, which is part of the point.

### 1.1 · GLSL Audio-Reactive Orb (Shader Sphere)
A subdivided Three.js `IcosahedronGeometry` with a custom `ShaderMaterial`. On each frame, vertex positions are displaced using a combination of Perlin noise and the live frequency data — low frequencies pull the mesh outward, high frequencies create surface ripple. On beat, the whole thing spikes and rebounds like a struck drum. The mesh is the star of the fullscreen mode.

This is the most technically impressive thing you can add. No one else has it in a React/TypeScript portfolio. The Codrops "anomaly detector" piece from 2025 is proof the visual language lands.

**Why it's in Tier 1:** Custom GLSL shader + Web Audio API + Three.js, all working together. It's the kind of thing that makes a senior engineer open the source.

---

### 1.2 · Butterchurn Integration (MilkDrop Presets)
`butterchurn` is an npm package — a WebGL2 implementation of the Winamp MilkDrop visualizer. It takes your `AudioContext` and a `<canvas>` and renders GPU-accelerated shader presets that morph and evolve with the music. There are hundreds of presets. The visuals are genuinely unlike anything else on the web.

Slot it in as a fourth visual layer option ("Presets") in `visualiserStore`. The user cycles to it with `V`, and the fullscreen mode becomes a proper music visualizer experience.

**Why it's in Tier 1:** The output is visually extraordinary and it integrates cleanly with the existing audio pipeline. The implementation effort is low (the library does the hard work) but the result looks like you built a GPU shader engine from scratch.

---

### 1.3 · Reactive Audio Terrain (R3F)
A `PlaneGeometry` with high subdivision (64×64 or 128×128 segments) rendered in React Three Fiber. On each `useFrame`, a vertex shader displaces y-positions based on a 2D Perlin noise field that's scrolled and scaled by the frequency data. Bass drives the amplitude of the whole surface. Treble frequencies create high-frequency ripple. The camera slowly orbits above it.

Think: a living ocean that breathes with the music. Swap the `AlbumGravityField` for this when a track is playing, or put it in the fullscreen layer.

**Why it's in Tier 1:** Vertex shaders + audio reactivity is a combination most frontend developers have never attempted. It requires understanding both the audio pipeline and how GPU geometry works.

---

### 1.4 · Album Art Transition — Full-Screen Takeover on Track Change
When the track changes, the new album art expands from the album thumbnail position to fill the entire screen using Framer Motion's `layoutId` shared element transition. The cover holds for ~1.5 seconds with the track name appearing over it, then the grid reassembles underneath. The visualisers fade back in.

This is the kind of transition Apple Music does in native apps but barely anyone has pulled off in a web app. It's the moment that makes a product feel intentional rather than assembled.

**Why it's in Tier 1:** Shared element transitions across layout boundaries are hard to get right. When they work, they feel like magic.

---

### 1.5 · Waveform-as-Progress-Bar in the Player
Replace the thin progress bar in `PlayerBar` with an actual rendered waveform — the oscilloscope data from `getWaveformData()` rendered as a mini canvas. A playhead scrubs through it. The waveform colours match the `AlbumColour` accent. Clicking anywhere on it seeks to that position.

This is a well-known UX pattern (SoundCloud does it) but almost no portfolio implementations actually wire up the scrub interaction correctly. Doing it right means you understand the relationship between `currentTime`, `duration`, and the audio buffer.

**Why it's in Tier 1:** Functional and beautiful — two things most portfolio "waveform" visualisers are not simultaneously.

---

## Tier 2 — Genuine Polish

Features that make the app feel finished and thoughtful, not just technically impressive.

### 2.1 · BPM Detection and Display
Extend `BeatDetector` to estimate BPM from the interval between detected beats. Display it as a live readout in the header or `NowPlaying` panel. Animate a subtle pulse indicator (a small dot or underline) on every beat. The BPM readout updates as the music evolves.

This makes the beat detection visible, which makes the technical work legible to non-developers looking at the portfolio.

---

### 2.2 · Mirrored / Reflected Frequency Bars
Add a `reflectionMode` prop to `FrequencyBars`. When active, the bars render symmetrically from the centre outward — half the bars on each side, highest frequencies at the outside, bass in the middle. Optionally add a faint reflection below (bars reflected downward, fading to transparent). This is a single-flag change with a dramatic visual effect.

---

### 2.3 · Artist Page with Blurred Hero Background
When a user clicks an artist name in the search results, slide open a panel (Framer Motion `AnimatePresence`) showing the artist's name, fan count, and their top Deezer tracks. The panel background is the artist's photo blurred behind frosted glass. The track list inside plays into the queue. This is a pattern every streaming app has — not having it makes Waveform feel incomplete.

---

### 2.4 · Intro / First Load Animation
On first mount, the four quadrants of the grid slide in from their respective corners with a stagger. The logo letterspace-expands into view. The whole entrance takes about 800ms and runs once. Subsequent navigations don't replay it.

Without this, the app snaps into existence. With it, it feels like a product opening.

---

### 2.5 · Genre Node Click → Animated Track Filter
Currently the genre graph filters tracks when a node is clicked. The visual feedback is weak. On click: the selected node pulses outward, unrelated nodes fade to near-invisible, and the track list in the Library quadrant animates — filtered tracks remain, the rest slide out using `AnimatePresence`. The filter state is indicated with a dismissable pill in the Library quadrant header.

---

### 2.6 · Keyboard-Navigable Search Results
Arrow keys should move focus through track results. Enter should play the focused track. Escape should close the overlay. Currently the keyboard shortcuts only cover global actions. This is a real accessibility gap and also makes the UX feel much faster.

---

### 2.7 · "Now Playing" Ambient Mode
A dedicated low-distraction view: full viewport, slow-moving background gradient animated from the album palette, album art centred and large, track info below. The frequency bars appear as a thin strip at the very bottom. Think Apple TV screensaver energy. Triggered by pressing `A` or via a button in `NowPlaying`.

---

## Tier 3 — Technical Hygiene

Fixes and completions that matter but don't produce visible wow.

### 3.1 · Fix `Spectogram.tsx` filename typo
The file is named `Spectogram.tsx` (missing an 'r'). It should be `Spectrogram.tsx`. Rename the file, update the import in `App.tsx`. Low risk, permanently irritating if left.

### 3.2 · HQ/Low Quality toggle should actually affect all visualisers
`isLowQuality` exists in `visualiserStore` but most components don't read it. When LQ is on: reduce canvas resolution (draw at 0.5× devicePixelRatio), reduce particle count in R3F scenes, reduce D3 force simulation iterations. When HQ is on: full resolution, full particle count.

### 3.3 · Error boundaries around each quadrant
A single broken visualiser (WebGL context lost, D3 data error) should not crash the whole app. Wrap each quadrant's content in an `ErrorBoundary` component that shows a minimal fallback and logs the error.

### 3.4 · Responsive layout (tablet breakpoint)
The 2×2 grid collapses to a single column below ~900px. The PlayerBar becomes fixed. The genre graph is hidden behind a toggle. This won't be fully mobile-friendly but it'll stop the app being completely broken on a recruiter's laptop.

### 3.5 · Loading skeleton states
`SearchOverlay` currently shows nothing while results load. Add skeleton track rows (animated shimmer using CSS) during the loading state. Same for `NowPlaying` when no track is selected.

### 3.6 · Cache the Deezer album genre fetches more aggressively
`getAlbumGenres` is called per album when building the genre graph and results aren't persisted across searches. Move to a module-level `Map` cache (not just the TTL cache in `cache.ts`) so re-searching the same query doesn't refetch genre data.

---

## Cut List (Things That Sound Good But Aren't Worth It)

- **Microphone input mode** — impressive in theory, but Waveform is about music discovery, not audio analysis. It muddies the concept.
- **Export visualisation as video** — requires `MediaRecorder` + canvas capture, lots of edge cases, no real portfolio value.
- **Playlist creation / save state** — pushes the app toward being a product, not a portfolio piece. The scope creep risk is high.
- **Last.fm scrobbling** — adds a backend dependency for a feature no interviewer will care about.