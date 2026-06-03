# TODO-APPROACH.md — Implementation Notes

Companion to `TODO.md`. One section per item. Not full code — just enough to derisk the approach before you start.

---

## 1.1 · GLSL Audio-Reactive Orb

**Location:** New file `src/components/visualiser/AudioOrb.tsx`

**Approach:**
Use a `THREE.IcosahedronGeometry` with `detail: 5` (5120 triangles — enough for smooth displacement). The key is a custom `ShaderMaterial` with a vertex shader that reads a uniform array of frequency data.

The challenge: you can't pass a `Uint8Array` directly as a GLSL uniform. You need to encode the audio data into a `THREE.DataTexture` (1D texture of 128 floats) and sample it in the shader.

```
Per frame (useFrame):
  1. freqData = audioEngine.getFrequencyData()           // Uint8Array[128]
  2. freqTexture.image.data.set(freqData)                // copy into DataTexture
  3. freqTexture.needsUpdate = true                      // flag GPU upload
  4. uniforms.uTime.value = clock.elapsedTime
  5. uniforms.uBass.value = bassPower                    // from visualiserStore.getState()
```

The vertex shader displaces each vertex along its normal direction using:

- `fbm()` (fractal Brownian motion — layered Perlin noise) for the base organic shape
- The sampled frequency value at a bin corresponding to the vertex's angular position for local reactivity
- A `uBass` scale factor that pulses the entire mesh outward on beat

**Uniforms needed:** `uTime: float`, `uBass: float`, `uFreq: sampler2D`, `uColor: vec3`

**Where to put it:** Swap into the Hero Scene panel in `App.tsx` when `isPlaying` is true, replacing or layering over `AlbumGravityField`. Or make it the Fullscreen mode's background.

**Key dependency:** No new packages. Everything needed is in Three.js 0.170 already.

**Risk:** GLSL debugging in the browser is painful. Test the shader in a minimal `<Canvas>` in isolation before integrating. The Codrops "3D Audio Visualizer" article (May 2025) has working GLSL reference code for this exact pattern.

---

## 1.2 · Butterchurn Integration

**Location:** New file `src/components/visualiser/ButterchurnVisualiser.tsx`

**Install:**

```bash
pnpm add butterchurn butterchurn-presets
```

**Approach:** Butterchurn takes a `canvas` element and your existing `AudioContext`'s `AnalyserNode`. It does not need `getFrequencyData()` — it connects directly to the analyser. The integration is:

```ts
import butterchurn from 'butterchurn'
import butterchurnPresets from 'butterchurn-presets'

// Inside useEffect, after AudioEngine is initialised:
const visualizer = butterchurn.createVisualizer(audioContext, canvasRef.current, {
  width: canvas.width,
  height: canvas.height,
})
visualizer.connectAudio(analyserNode)

// Load a preset
const presets = butterchurnPresets.getPresets()
const presetKeys = Object.keys(presets)
visualizer.loadPreset(presets[presetKeys[0]], 0.0)

// In rAF loop:
visualizer.render()
```

**Problem:** `AudioEngine` currently does not expose the raw `AnalyserNode` or `AudioContext` — only the data methods. You will need to add two new getters:

```ts
get analyserNode(): AnalyserNode | null { return this.analyser }
get audioContext(): AudioContext | null { return this.context }
```

**Preset cycling:** Store the current preset index in `visualiserStore`. Let the user cycle presets with `P`. Butterchurn's `loadPreset(preset, blendTime)` transitions smoothly between presets — use `blendTime: 2.0` for a 2-second crossfade.

**Where to slot it:** Add `'Presets'` as a fourth `VisualLayer` option in `visualiserStore`. When `visualLayer === 'Presets'`, the fullscreen overlay renders the Butterchurn canvas instead of the current visualisers.

**Risk:** Butterchurn uses its own internal rAF loop by default. You may need to call `visualizer.render()` manually each frame to stay in sync with your existing loop. Check whether `setRendererSize` needs to be called on window resize.

**TypeScript:** `butterchurn` and `butterchurn-presets` have no official type definitions. Create a `src/types/butterchurn.d.ts` with minimal declarations. You only need: `createVisualizer`, `loadPreset`, `connectAudio`, `render`, `setRendererSize`.

---

## 1.3 · Reactive Audio Terrain

**Location:** New file `src/components/visualiser/AudioTerrain.tsx`

**Approach:**
A `THREE.PlaneGeometry(20, 20, 64, 64)` rotated flat (`-Math.PI / 2` on x) with a custom `ShaderMaterial`. Same `DataTexture` pattern as the Orb (see 1.1).

The vertex shader scrolls a 2D Perlin noise function across the plane over time. `uTime` drives the scroll speed. The y-displacement of each vertex is:

```glsl
float noise = fbm(vec2(uv.x * 3.0 + uTime * 0.1, uv.y * 3.0));
float freq  = texture2D(uFreq, vec2(uv.x, 0.5)).r;
float y     = noise * uBass * 2.0 + freq * 0.5;
gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, y, position.z, 1.0);
```

Add a `GridHelper` or wireframe material on top for a technical grid aesthetic that fits the Waveform UI language.

Camera: position it at `[0, 6, 10]`, looking at `[0, 0, 0]`, slowly orbiting on `clock.elapsedTime * 0.1`.

**Where to put it:** Replace `AlbumGravityField` in the Hero Scene, or use it as the fullscreen Ambient layer background. The flat horizon line reads as abstract landscape — fits the dark aesthetic.

**Risk:** `PlaneGeometry` at 64×64 = 4096 vertices. This is fine at 60fps. Don't go above 128×128 without testing on a low-end machine. The fragment shader needs proper lighting — add a `DirectionalLight` or compute per-vertex normals and use them for diffuse shading (the terrain looks flat otherwise).

---

## 1.4 · Album Art Transition on Track Change

**Approach:**
Framer Motion's `layoutId` creates a shared element transition between two different DOM positions. The source is the album thumbnail wherever it appears (search result row, PlayerBar). The destination is a full-screen overlay.

```tsx
// In TrackRow or PlayerBar:
<motion.img layoutId={`album-${track.id}`} src={track.album.cover_medium} />

// In a new TrackTransitionOverlay component:
<AnimatePresence>
  {isTransitioning && (
    <motion.div style={fullScreenOverlayStyle}>
      <motion.img
        layoutId={`album-${currentTrack.id}`}
        src={currentTrack.album.cover_medium}
        style={{ width: '100vw', height: '100vh', objectFit: 'cover' }}
      />
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.4 } }}>
        <h1>{currentTrack.title}</h1>
        <p>{currentTrack.artist.name}</p>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
```

**State management:**
Add `isTransitioning: boolean` and `transitionTrack: DeezerTrack | null` to `playerStore`. When `setTrack` is called, set `isTransitioning: true`. After 1800ms, set it back to `false`. The transition overlay is shown during this window.

**Key constraint:** The `layoutId` must be the same string in both locations. This means the source element (thumbnail) needs to use the track's ID, not a generic string. This works as long as only one track thumbnail with that ID is mounted at a time.

**Risk:** If multiple `TrackRow` components for the same track are mounted simultaneously, `layoutId` will conflict. Guard against this — it's unlikely in practice since the search results are a filtered list.

---

## 1.5 · Waveform-as-Progress-Bar

**Location:** Modify `src/components/player/PlayerBar.tsx`, extract new `WaveformScrubber.tsx`

**Approach:**
The `getWaveformData()` from `AudioEngine` gives you the current time-domain signal, not the full track shape. For the scrubber visual, you have two options:

**Option A (Simpler):** Use the live waveform data, but draw it as a circular/repeating pattern that fills the bar proportional to `progress`. The "waveform" isn't the actual track shape — it's the real-time oscilloscope data reflected across the bar. This is visually appealing and technically correct (it shows the current audio signal), even if it doesn't match the track's overall shape.

**Option B (Harder, more correct):** Use the Web Audio API's `OfflineAudioContext` to decode the audio buffer and pre-compute the RMS amplitude across the track in segments. This gives you the actual track envelope. The problem: Deezer preview URLs are cross-origin MP3s and hit CORS restrictions.

**Current Implementation:** A hybrid approach. Local files use **Option B** (pre-computed in `computeWaveform.ts`), while Deezer tracks use **Option A** (real-time oscilloscope) to bypass CORS limitations.

**Scrub interaction:**

```ts
const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
  const rect = canvasRef.current!.getBoundingClientRect()
  const fraction = (e.clientX - rect.left) / rect.width
  const audioEl = document.getElementById('preview-audio') as HTMLAudioElement
  audioEl.currentTime = fraction * audioEl.duration
  usePlayerStore.getState().setProgress(fraction * audioEl.duration)
}
```

---

## 2.1 · BPM Detection and Display

**Location:** Modify `src/audio/BeatDetector.ts` and `src/stores/visualiserStore.ts`

**Approach:**
The existing `BeatDetector` returns `{ beat, confidence, bassEnergy }`. Add beat timing:

```ts
private lastBeatTime: number = 0
private bpmHistory: number[] = []

// Inside detect(), when a beat is detected:
const now = performance.now()
const interval = now - this.lastBeatTime
if (interval > 300 && interval < 2000) { // 30–200 BPM range
  const instantBPM = 60000 / interval
  this.bpmHistory.push(instantBPM)
  if (this.bpmHistory.length > 8) this.bpmHistory.shift()
}
this.lastBeatTime = now

// Return smoothed BPM:
const bpm = this.bpmHistory.length > 2
  ? this.bpmHistory.reduce((a, b) => a + b) / this.bpmHistory.length
  : 0
```

Add `bpm: number` to `visualiserStore`. Display it in `NowPlaying` alongside the other track metadata. A small animated dot that flashes on each beat (reads `beat` from the store) makes the BPM readout legible.

---

## 2.2 · Mirrored Frequency Bars

**Location:** Modify `src/components/visualiser/FrequencyBars.tsx`

**Approach:**
`FrequencyBars` already accepts a `mirrorMode` prop. If it's not fully implemented, the change is:

```ts
// Instead of iterating left-to-right:
// Split the data into bass half (left) and treble half (right)
const half = Math.floor(freqData.length / 2)
const leftHalf = freqData.slice(0, half).reverse() // bass on outside-left
const rightHalf = freqData.slice(0, half) // bass on outside-right
const combined = [...leftHalf, ...rightHalf]
```

For reflection: after drawing the bars upward, use `ctx.scale(1, -1)` and redraw with `globalAlpha = 0.2` for a mirror image pointing downward. This is a 5-line addition to the existing draw loop.

---

## 2.3 · Artist Page Panel

**Location:** New file `src/components/search/ArtistPanel.tsx`

**Data:** `getArtist(artistId)` already exists in `deezerApi.ts`. The artist endpoint returns `name`, `picture_medium/big`, `nb_fan`. A separate call to `searchTracks(artistName)` gets their popular tracks.

**Approach:** Slide in from the right using Framer Motion (`x: '100%'` → `x: 0`). Background is `artist.picture_big` with `filter: blur(24px) brightness(0.3)`. Content overlaid with a frosted glass panel (`backdrop-filter: blur(16px)`). Close button top-right. Track list inside uses existing `TrackRow` component.

**State:** Add `selectedArtistId: number | null` to a new `uiStore.ts` (or extend `playerStore`). `TrackRow` calls `setSelectedArtistId` on artist name click.

---

## 2.4 · Intro Animation

**Location:** Modify `src/App.tsx`

**Approach:**
Wrap the four grid quadrants in individual `motion.div` elements with `initial` and `animate` props:

```tsx
const quadrantVariants = {
  hidden: (custom: number) => ({
    opacity: 0,
    x: custom === 'left' ? -40 : 40,
    y: custom === 'top' ? -40 : 40,
  }),
  visible: { opacity: 1, x: 0, y: 0 },
}
```

Use a single `useEffect` with a `useState(false)` → `useState(true)` flip after mount to trigger `animate="visible"`. Add `staggerChildren` on the parent container. Total animation time: ~800ms.

Gate it: store a `hasIntroPlayed` flag in `sessionStorage`. Don't replay the intro on navigating back to the app within the same tab.

---

## 2.5 · Genre Filter Animation

**Location:** Modify `src/components/library/GenrePanel.tsx` and `src/components/search/SearchOverlay.tsx`

**On node click in GenreForceGraph:** The D3 simulation already has event handlers. On click, call back up to `GenrePanel` via the existing `onFilteredTracksChange` prop. In the D3 event handler, reduce opacity of non-selected nodes to 0.15 using D3's transition: `d3.selectAll('.node').transition().duration(300).attr('opacity', d => isSelected(d) ? 1 : 0.15)`.

**In SearchOverlay:** Wrap each `TrackRow` in `motion.div` with `AnimatePresence`. When the filter changes, tracks exit with `{ opacity: 0, height: 0 }` and enter with `{ opacity: 1, height: 'auto' }`. The stagger makes it clear which tracks are being filtered in/out.

**Dismissable filter pill:** Add a `×` pill to the Library quadrant label showing the active genre. Click it to clear `filteredTrackIds`. One `useState` in `App.tsx` controls this — it's already half-wired via `handleFilteredTracksChange`.

---

## 2.6 · Keyboard-Navigable Search

**Location:** Modify `src/components/search/SearchOverlay.tsx`

**Approach:**
Add a `focusedIndex: number` state. `ArrowDown`/`ArrowUp` increment/decrement it (clamped to `[0, tracks.length - 1]`). `Enter` plays the focused track. Apply a highlight style to the focused `TrackRow` via a prop.

Use a `listRef` and `scrollIntoView` on the focused element. Standard pattern, no libraries needed.

Guard: only activate arrow key behaviour when the search overlay is open and the input is focused. The global keyboard handler in `App.tsx` must not intercept arrow keys when the overlay is open.

---

## 3.1 · Fix Spectogram.tsx Typo

```bash
git mv src/components/visualiser/Spectogram.tsx src/components/visualiser/Spectrogram.tsx
```

Update the import in `App.tsx`:

```ts
// Before:
import { Spectrogram } from './components/visualiser/Spectogram'
// After:
import { Spectrogram } from './components/visualiser/Spectrogram'
```

That's it.

---

## 3.3 · Error Boundaries

**Location:** New file `src/components/ui/QuadrantErrorBoundary.tsx`

```tsx
class QuadrantErrorBoundary extends React.Component<
  { label: string; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error(`[${this.props.label}] visualiser error:`, error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ opacity: 0.2, padding: '2rem', fontFamily: 'monospace', fontSize: '0.7rem' }}>
          {this.props.label} — render error
        </div>
      )
    }
    return this.props.children
  }
}
```

Wrap each quadrant's content in `App.tsx`. Class components are required for error boundaries — hooks cannot replace `componentDidCatch`.

---

## 3.4 · Responsive Layout

**Approach:** Add a `useResize` call in `App.tsx` to get the current window width. Below 900px:

- `gridTemplateColumns: '1fr'` (stack vertically)
- `gridTemplateRows: 'repeat(4, auto)'`
- Hide `GenrePanel` behind a toggle button
- `PlayerBar` stays fixed at the bottom

This is intentionally minimal — Waveform is a desktop-first experience. Don't try to make it a proper mobile app. Just stop it being completely broken.

Use a CSS custom property approach rather than duplicating style objects:

```ts
root.style.setProperty('--grid-columns', width < 900 ? '1fr' : '1fr 1fr')
```

Then use `var(--grid-columns)` in the grid style.
