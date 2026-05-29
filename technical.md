# Waveform Technical Documentation

This document provides a deep technical dive into the architecture, systems, and performance strategies of Waveform. It is intended for AI coding agents and developers who need to make informed technical decisions, implement complex features, or optimize the existing codebase.

---

## 1. Core Architecture & Philosophy

Waveform is built on a "Boundary Architecture" that strictly separates high-frequency data (audio) and simulation logic from React's reconciliation cycle.

### The Singleton Audio Engine
- **File:** `src/audio/AudioEngine.ts`
- **Pattern:** Singleton.
- **Role:** Manages the Web Audio `AudioContext` and `AnalyserNode`.
- **Constraint:** Must be initialized via a user gesture (`audioEngine.init(audioElement)`).
- **Optimization:** Pre-allocates `Uint8Array` buffers for frequency and waveform data to avoid per-frame garbage collection.

### React / R3F / D3 Boundaries
The project enforces strict ownership of the DOM/Scene graph to prevent performance degradation:
1. **React**: Owns the high-level layout, state-driven UI (Search, Player Bar, Overlays), and lifecycle management.
2. **Three.js (R3F)**: Owns the 3D scene. Mutations happen inside `useFrame` loops, pulling state imperatively from Zustand via `getState()`.
3. **D3.js**: Owns the internal DOM of the Genre Map. React renders only the `<svg>` container. D3 handles all node/link enters, updates, and exits.
4. **Canvas**: Managed imperatively. `useAudioAnalyser` calls back directly with raw buffers for immediate pixel manipulation.

---

## 2. High-Performance Audio Pipeline

Waveform achieves a locked 60fps by ensuring that raw audio data **never enters React state**.

### The Shared rAF Loop
- **File:** `src/hooks/useAudioAnalyser.ts`
- **Mechanism:** A module-level `requestAnimationFrame` loop that runs independently of any single component.
- **Subscribers**: Components register callbacks via the `useAudioAnalyser` hook.
- **Zero-Allocation**: `AudioEngine` returns shared references to its internal `Uint8Array` buffers. Subscribers are instructed to treat these as read-only to avoid cloning overhead.

### State Synchronization
While raw buffers stay out of state, **derived scalars** (beat detection, bass power) are pushed to the `visualiserStore`.
- **Transient Updates**: R3F components subscribe to these values via `useFrame` + `getState()` to avoid React re-renders.
- **Reactive UI**: CSS variables (e.g., `--reactive-border`) are updated directly on `document.documentElement` for low-latency visual feedback.

---

## 3. Systems Deep Dive

### 3.1. Hybrid Beat Detection
- **File:** `src/audio/BeatDetector.ts`
- **Math & Logic**:
    1. **Bass Energy Variance**: Calculates the average energy of the first 10 frequency bins ($E$). It maintains a history window (default 43 frames). A beat is detected if $E > C \cdot \text{avg}(E_{history})$, where $C$ is a dynamic threshold based on the variance of the history window ($C = \text{sensitivity} + \text{variance} / 10000$).
    2. **Spectral Flux**: Measures the "rectified" difference between the current power spectrum and the previous frame. $Flux = \sum \max(0, X_i[t] - X_i[t-1])$. This detects the start of new sounds (onsets) across all frequencies.
- **BPM Estimation**: Uses the interval between high-confidence beats to calculate an "instant BPM," which is then smoothed using a rolling average of the last 8 detections.
- **Confidence Scoring**: Calculated as the ratio of the signal's overshoot relative to its threshold, capped at 1.0.

### 3.2. GPU-Accelerated Visualizers (GLSL)
- **Files:** `AudioOrb.tsx`, `AudioTerrain.tsx`, `utils/shaders.ts`
- **Shared Utilities**: Core GLSL logic like `SIMPLEX_NOISE_3D` is centralized in `utils/shaders.ts` and injected into component-specific shaders.
- **Vertex Displacement**:
    - **AudioOrb**: Uses a subdivided icosahedron. Displaces vertices along their normals using noise + $uBass$. Features "organic breathing" independent of audio.
    - **AudioTerrain**: Displaces a plane based on noise and a `uFreq` DataTexture. UV-based masking is used to focus frequency reactivity towards the center.
- **DataTextures**: The `AudioTerrain` passes 128 bins of frequency data into the shader using a `THREE.DataTexture`. This allows the vertex shader to sample specific bins based on UV coordinates: `texture2D(uFreq, vec2(uv.x, 0.5)).r`.
- **Quality Scaling (LOD)**:
    - **Epic**: High-poly geometry (128x128 segments), multi-octave FBM (Fractal Brownian Motion) noise in shaders, advanced post-processing (GodRays, Bokeh DOF).
    - **Low**: Low-poly (32x32), simple sine-wave displacement, post-processing disabled.

### 3.3. D3 Genre Map Integration
- **File:** `src/components/library/GenreForceGraph.tsx`
- **Pattern**: The "Manual Lifecycle" pattern.
- **Constraint**: The D3 simulation must be stopped on unmount to prevent memory leaks and background CPU usage.
- **Update Strategy**: When data changes, the simulation is updated in-place via `.nodes()` and `.restart()`. This preserves existing node positions and prevents the "violent reshuffle" typical of naive D3-React implementations.

### 3.4. Butterchurn (MilkDrop) Integration
- **Files:** `ButterchurnVisualiser.tsx`, `ButterchurnTexture.tsx`
- **Mechanism**: Renders the Butterchurn visualizer to an offscreen canvas.
- **R3F Integration**: The offscreen canvas is used as a `THREE.CanvasTexture` on a plane positioned behind the main 3D scene. This allows Butterchurn to benefit from the global Three.js post-processing stack (Bloom, etc.).
- **Data Flow**: Butterchurn connects directly to the `analyserNode` from the `AudioEngine`.

### 3.5. State Management & Persistence
- **Stores**: Powered by **Zustand**.
    - `playerStore.ts`: Manages playback state, queue, and local media.
    - `visualiserStore.ts`: High-frequency audio state and visual settings.
- **Persistence**: Selected UI settings (like `godRaysEnabled`) are persisted via `localStorage` using the `persist` middleware.
- **Local Media**: Supports playback of local files. `playerStore` maintains a `urlRegistry` (Map) for `blob:` URLs to ensure they are revoked on removal, preventing memory leaks.

### 3.6. Keyboard Interactivity & Shortcuts
- **Global Listener**: `App.tsx` hosts the global keyboard listener.
- **Shortcut Guard**: Shortcuts are automatically disabled when the active element is an `INPUT` or `TEXTAREA` to prevent accidental triggers during search.
- **Key Mappings**:
    - `Space`: Toggle Play/Pause.
    - `F`: Toggle Fullscreen.
    - `V`: Cycle Visual Layers.
    - `R`: Toggle Video Recording (requires `preserveDrawingBuffer`).
    - `S`: Toggle FX Settings panel.
    - `/`: Focus Search.

### 3.7. API Integration (Deezer & Vercel)
- **CORS Solution**: Deezer API is proxied via Vercel Rewrites (`vercel.json`). All requests should be made to `/deezer-api/*`.
- **Data Fetching**: Centralized in `src/lib/deezerApi.ts`. Use `deezerFetch` helper to ensure correct proxy prefixing and error handling.
- **Data Shape**: Deezer's schema differs from Spotify. Key fields to watch:
    - `track.artist`: Single object (not an array).
    - `track.preview`: 30s MP3 URL (not `preview_url`).
    - `track.duration`: Seconds (not milliseconds).
    - `track.rank`: Popularity proxy (0-1M).
- **Caching**: `src/lib/cache.ts` provides a simple TTL-based in-memory cache for API responses to reduce redundant network calls.

---

## 4. Testing Strategy

Waveform uses **Vitest** in **Browser Mode** (via Playwright/Chromium) to ensure compatibility with real-world Web Audio and Canvas implementations.

- **No Mocks**: Prefers testing against the real `AudioEngine` and `deezerApi`.
- **Component Tests**: Uses React Testing Library within the browser environment.
- **Visual Verification**: Playwright is used for automated screenshots and video capture of WebGL content (requires `preserveDrawingBuffer: true` on the Three.js canvas).

---

## 5. Theming Engine

- **Hook:** `src/hooks/useAlbumColour.ts`
- **Logic**: Uses `tinycolor2` to analyze album artwork.
- **Output**: Generates a harmonized `AlbumColour` object containing primary, secondary, accent, and background hues.
- **Propagation**:
    - **React**: Passed as props to components.
    - **CSS**: Injected as `--bg-color`, `--accent-color`, etc., into the `:root` element.
    - **Shaders**: Passed as `uniform vec3` to maintain visual consistency across WebGL layers.

---

## 6. Performance & LOD Strategy

| Target | Strategy |
| :--- | :--- |
| **Mobile** | Auto-detected and forced to `Low` quality. Disables Post-processing and High-poly meshes. |
| **GPU Particles** | `ParticleField.tsx` uses a custom `ShaderMaterial` to handle 50k+ particles. Positions are updated in the vertex shader to avoid CPU bottlenecks. |
| **Post-Processing** | Centralized in `FullscreenOverlay.tsx`. `GodRays` is the most expensive effect and is disabled by default (opt-in). |
| **Garbage Collection** | Avoids object spreading (`...`) and array methods like `filter`/`map` inside the rAF loop and `useFrame`. |

---

## 7. How-To Decision Trees

### Adding a New Visualizer
1. **Canvas or 3D?**
    - **Canvas**: Create in `src/components/visualiser/`, use `useAudioAnalyser` callbacks for imperative drawing.
    - **3D**: Use R3F, place in `FullscreenOverlay`, pull scalars from `visualiserStore.getState()` inside `useFrame`.
2. **Frequency Access**: Use `audioEngine.getFrequencyData()` if you need raw bins.
3. **Theming**: Always accept an `accent: AlbumColour` prop or use `var(--accent-color)`.

### Extending the Audio Engine
1. **New Analysis Logic**: Add to `BeatDetector.ts` or create a new analyzer class in `src/audio/`.
2. **Data Flow**: Push derived results to `visualiserStore.ts` via the `setAudioData` action.
3. **Avoid**: Never add new `AudioContext` instances.

---

## 8. Technical Debt & Known Bottlenecks

1. **D3 Simulation Overhead**: In the `GenreForceGraph`, the D3 tick handler runs on the CPU. While isolated, a very large number of nodes (>100) will begin to impact the main thread's frame budget.
2. **Post-Processing Pass Count**: Each effect in `EffectComposer` (Bloom, GodRays, etc.) adds a render pass. Cumulative passes can exceed the bandwidth of integrated GPUs.
3. **Deezer Preview Limitations**: The 30s limit is hardcoded by the API. Any logic relying on full track duration must handle the `audio.duration` being significantly shorter than the metadata duration.
4. **Zustand `partialize`**: Currently only `godRaysEnabled` is persisted. More granular persistence for user FX settings is needed.

---

## 9. Improvement Suggestions

1. **Web Workers for D3**: Move the `forceSimulation` into a Web Worker to move physics calculations off the main thread.
2. **Instanced Rendering for Album Gravity**: Use `THREE.InstancedMesh` for `AlbumGravityField` if the number of floating albums exceeds 50.
3. **Adaptive Quality**: Implement a frame-time monitor that automatically drops `quality` if the FPS falls below 55 for a sustained period.
4. **Shader Optimization**: Centralize common GLSL functions (Noise, PBR lighting) into a custom shader chunk system to reduce duplicate code in `AudioOrb` and `AudioTerrain`.
