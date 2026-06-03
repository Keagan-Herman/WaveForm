# TODO.md — Waveform: Future Roadmap

This project is currently in a "Complete" state for its initial portfolio goals. All Tier 1-3 features from the original plan have been implemented.

---

## Completed Features

### Tier 1 — Stop-Scrolling Moments ✅
- **GLSL Audio-Reactive Orb**: Custom shader sphere with Perlin noise and frequency displacement.
- **Butterchurn Integration**: GPU-accelerated MilkDrop visualizer presets.
- **Reactive Audio Terrain**: 3D ocean of music rendered in R3F.
- **Album Art Transition**: Full-screen takeover on track change via Framer Motion.
- **Waveform Scrubber**: Interactive oscilloscope progress bar.

### Tier 2 — Genuine Polish ✅
- **BPM Detection**: Real-time estimation and display.
- **Mirrored Visualisers**: Symmetrical frequency bar modes.
- **Artist Pages**: Blurred hero backgrounds and top tracks.
- **Intro Animations**: Staggered grid entrance on load.
- **Keyboard Navigation**: Full search result and player control via shortcuts.

### Tier 3 — Technical Hygiene ✅
- **Responsive Layout**: Grid collapse and UI adjustment for tablet/mobile.
- **Error Boundaries**: Quadrant-level failure isolation.
- **Low Quality Mode**: Adaptive resolution and particle reduction.
- **Multi-Source Audio**: Local file drag-and-drop support with client-side metadata/waveform extraction.

---

## Future Aspirations (Tier 4)

If this project were to evolve further, these are the directions it could take:

### 4.1 · Microphone Input
Extend the `AudioEngine` to support real-time microphone input for the visualisers.

### 4.2 · Shared Listening Rooms
Use WebRTC or Socket.io to allow multiple users to sync their visualisers to the same playback stream.

### 4.3 · Visualiser Preset Editor
A UI to adjust shader uniforms (noise scale, speed, color mapping) and save them as custom user presets.

### 4.4 · Persistent History
Local-storage based history of searched artists and played tracks.
