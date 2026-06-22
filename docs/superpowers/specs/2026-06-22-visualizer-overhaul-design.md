# Visualizer Overhaul Design

**Date:** 2026-06-22  
**Status:** Approved  
**Scope:** Ambient layer upgrade, new ParticleCrown component, Presets UX fix, quick-hit app-wide improvements

---

## Problem

The current Ambient visualizer reacts almost entirely to bass power and a boolean beat signal. Mid-range frequencies (voice, melody, harmony) and treble (hi-hats, cymbals) are present in the FFT data but never isolated or used. The result is a visualizer that pulses on the kick drum but is otherwise static — it doesn't differentiate between a vocal passage and an instrumental one, or a busy hi-hat pattern and silence.

The Presets layer (Butterchurn MilkDrop) is also confusing: there is no indication of what it is, what it's doing, or how to interact with it.

---

## Goals

- Ambient mode feels explosive on the beat, organic and alive between beats, and hypnotic over longer listening sessions
- Different frequency bands drive visually distinct elements so the whole frequency spectrum is represented
- Presets layer is immediately legible: users understand what they're looking at and how to control it
- No regressions in performance — existing quality downgrade path continues to work

---

## Out of Scope

- Replacing the Ambient layer architecture (no decomposition into Core/Crown/Atmosphere settings)
- Changes to the Minimal or Energy layer core visuals (only minor color wiring additions)
- Stereo/phase analysis or cepstral analysis
- BPM-locked animation beyond the orb breathing cycle

---

## Section 1 — Audio Pipeline: Multi-band Signals

### What changes

`BeatDetector.ts` already reads all 128 FFT bins but discards everything except the first 10 (bass). Three new normalized band signals are computed each frame and written into `visualiserStore`:

| Signal        | Bins   | Approx. frequency range | Tracks                    |
| ------------- | ------ | ----------------------- | ------------------------- |
| `bassPower`   | 0–10   | 20–200 Hz               | Kick, sub-bass (existing) |
| `midPower`    | 20–60  | 400–2,400 Hz            | Voice, melody, chords     |
| `treblePower` | 70–110 | 2,800–8,500 Hz          | Hi-hats, cymbals, air     |

Each is a normalized 0–1 float computed as the average of its bin range divided by 255, then smoothed with a one-pole low-pass filter (same `smoothingTimeConstant` already applied by the Web Audio `AnalyserNode`).

`spectralFlux` — already calculated inside `BeatDetector.detect()` for beat decisions — is exposed as a continuous 0–1 signal instead of being discarded after the beat threshold check.

### Store changes

Three new fields added to `visualiserStore`:

```ts
midPower: number // 0–1, voice/melody band
treblePower: number // 0–1, hi-hat/cymbal band
spectralFlux: number // 0–1, frame-to-frame energy change
```

(`bassPower` already exists — no change.)

### Architectural constraints

- Raw `Uint8Array` bin data still never enters React state or Zustand — only the four derived scalars cross the boundary
- `BeatDetector` computes all bands in the same frame pass as beat detection — no second FFT read, no new audio node

---

## Section 2 — AudioOrb: Multi-band Shader Upgrade

`AudioOrb.tsx` gains three new GLSL uniforms and uses them across vertex and fragment shaders.

### New uniforms

```glsl
uniform float uMid;          // midPower from store
uniform float uTreble;       // treblePower from store
uniform float uSpectralFlux; // spectralFlux from store
```

### Vertex shader changes

- `uTreble` adds a second simplex noise octave at higher spatial frequency than the existing bass-driven displacement. The amplitude is `uTreble * 0.08`. On Low quality this octave is skipped (same branch that already skips Simplex 3D).
- Result: surface texture becomes more complex during busy treble passages (hi-hats, cymbals) and smooths out during bass-only drops.

### Fragment shader changes

- **Color temperature** (`uMid`): The existing base color mix between `uColor1` and `uColor2` is shifted by `mix(0.0, 0.15, uMid)` toward a warmer hue offset. When `midPower` is high (vocalist present), the orb visibly warms. When instrumental/bass-only, it stays at its album-palette base.
- **Sparkle pass** (`uTreble`): A third simplex noise evaluation at very high frequency (scale ×12) is thresholded against `uTreble`. Pixels above threshold get a brightness boost of `uTreble * 1.5`. This produces scattered bright flecks that intensify on cymbal hits.
- **Rim/filament glow** (`uSpectralFlux`): The existing rim lighting multiplier gains `+ uSpectralFlux * 0.4`, so continuous musical energy (not just beat impacts) keeps the glow from going flat between beats.

### useFrame changes

Three additional `setUniform` calls added alongside the existing `uBass` and `uTime` writes. No new subscriptions — all reads from `useVisualiserStore.getState()` imperatively.

---

## Section 3 — ParticleCrown: New Component

A new R3F component `src/components/visualiser/ParticleCrown.tsx` added to the Ambient layer composition in `FullscreenOverlay.tsx`.

### Particle pool

- Pool size: 1,500 particles (400 on Low quality)
- Backed by a single `THREE.InstancedMesh` with `THREE.PlaneGeometry(0.04, 0.04)` and additive `MeshBasicMaterial`
- Matrix buffer: pre-allocated `Float32Array(1500 * 16)` — written in `useFrame`, never reallocated
- Color buffer: `THREE.InstancedBufferAttribute` (Float32, 3 components) — updated in `useFrame`

### Particle data (CPU-side, typed arrays)

Per particle (stored in parallel typed arrays, no object allocation):

```
position:   Float32Array[1500 * 3]
velocity:   Float32Array[1500 * 3]
life:       Float32Array[1500]      // remaining life in seconds
maxLife:    Float32Array[1500]      // assigned at spawn, 1.5–3.5s
active:     Uint8Array[1500]        // 0 or 1
```

### Spawn rules

- **Beat burst:** On each `beat` rising edge, emit `40 + beatConfidence * 40` particles (clamped to pool space) from random points on the orb surface (unit sphere × orb radius ≈ 1.2). Initial velocity: outward normal × `(0.8 + bassPower * 1.2)`.
- **Continuous trickle:** 2–4 particles per frame always spawn, emitting from the orb's top and bottom poles with low initial velocity. Keeps the crown alive between beats on low-energy tracks.
- Low quality: burst size ×0.35, no trickle.

### Motion per frame

1. Apply curl-noise field displacement: sample a pre-computed 16×16×16 noise grid (built once on mount, `Float32Array[16*16*16*3]`) at particle world position, scale by `0.015 + midPower * 0.025`
2. Apply radial push: `velocity += normalize(position) * bassPower * 0.008`
3. Integrate: `position += velocity * deltaTime`
4. Dampen: `velocity *= 0.97`
5. Age: `life -= deltaTime`; deactivate when `life <= 0`

### Color per frame

- Base color: lerp between `accent.palette[0]` (near orb, warm) and `accent.palette[2]` (far out, cool) by normalized distance from origin (0–6 units range)
- Brightness multiplier: `0.6 + treblePower * 1.4` — treble makes the entire crown flash bright
- Alpha: `life / maxLife` in final 20% of life, else 1.0 (fade out only)
- Mid-power warm shift: add `midPower * 0.12` to the red channel

### Integration

Added to the Ambient layer in `FullscreenOverlay.tsx` between `<AudioOrb />` and `<FluidBackground />` in render order. Controlled by `particlesOpacity` from the store (already exists).

---

## Section 4 — Presets UX Fix

### Problem

Entering the Presets layer gives no indication of what it is (MilkDrop GPU presets), what preset is active, how long until it changes, or how to interact with it.

### Persistent info strip

A `PresetInfoStrip` component renders as an absolutely-positioned overlay at the bottom of the Presets canvas. Contains:

- Label: "MilkDrop Preset" (static, small, dimmed)
- Current preset name (from `butterchurnVisualizer.getPresetName()`, updated on each cycle)
- Auto-cycle progress bar: thin 2px line spanning full width that drains over 20s; resets on cycle
- Prev / Next chevron buttons (icon buttons, same style as existing UI chrome)
- Shuffle toggle icon (shows current shuffle state, toggleable)

**Visibility behavior:** Fades to 15% opacity after 3s of no mouse movement over the Presets canvas. Returns to 100% on `mousemove`. No keyboard shortcut changes — 'P' continues to work.

### Layer switcher subtitle

In the layer tab bar (wherever the Ambient / Energy / Minimal / Presets tabs render), the active Presets tab shows the current preset name as a one-line subtitle in a smaller weight beneath "Presets". Updated on the same cycle event that updates the strip.

### Butterchurn API surface used

- `visualizer.getPresetName()` — already available on the Butterchurn instance
- `visualizer.setPreset(preset, 0)` — for prev/next navigation (instant switch, no blend, since the user explicitly requested it)
- No changes to the 20s auto-cycle timer or the 5.7s blend transition

---

## Section 5 — App-wide Quick Hits

These are additive improvements requiring minimal code, enabled by the multi-band pipeline from Section 1.

### 5a. FrequencyBars band coloring

`FrequencyBars.tsx` currently samples a single gradient palette for all 128 bars. Replace with a three-zone gradient: bars 0–10 use a warm (amber/red) gradient, bars 11–69 use a mid (green/teal) gradient, bars 70–127 use a cool (blue/violet) gradient. The color boundaries are soft (5-bin crossfade). No logic change — only the pre-calculated color LUT changes.

### 5b. AudioTerrain mid-power hue shift

`AudioTerrain.tsx` adds `uMid` uniform. In the fragment shader, the elevation color mix gains a hue rotation of `uMid * 0.08` (in HSL space via a vec3 conversion helper already present in the shader). Voice passages shift the terrain from its base palette hue toward a complementary hue.

### 5c. BPM-synced orb breathing

The orb's breathing animation currently uses `sin(uTime * 0.8)` (arbitrary frequency). Replace with `sin(uTime * bpmToRadPerSec)` where `bpmToRadPerSec = (bpm / 60.0) * TWO_PI`. The BPM value is already in the store and already passed to the orb. When BPM is 0 (not yet detected), fall back to the current `0.8` constant.

---

## Data Flow Summary

```
AudioEngine.getFrequencyData() [Uint8Array, 128 bins]
  └─▶ BeatDetector.detect()
        ├─▶ beat, beatConfidence, bassPower, bpm  [existing]
        ├─▶ midPower     [new — bins 20–60]
        ├─▶ treblePower  [new — bins 70–110]
        └─▶ spectralFlux [new — exposed from existing calculation]
              └─▶ visualiserStore.setAudioData()
                    ├─▶ AudioOrb uniforms (uMid, uTreble, uSpectralFlux)
                    ├─▶ ParticleCrown useFrame (spawn + motion)
                    ├─▶ AudioTerrain uniform (uMid)
                    └─▶ FrequencyBars (color LUT only — no new data read)
```

---

## Performance Budget

| Addition                        | Draw calls | Notes                                  |
| ------------------------------- | ---------- | -------------------------------------- |
| ParticleCrown (1,500 particles) | +1         | Single InstancedMesh                   |
| AudioOrb new uniforms           | 0          | Uniform writes only                    |
| AudioTerrain uMid               | 0          | Uniform write only                     |
| BeatDetector band computation   | 0          | Same frame pass, ~20 extra array reads |
| PresetInfoStrip                 | 0 (DOM)    | Outside R3F canvas                     |

Low quality path unaffected for all existing components. ParticleCrown Low quality reduces to 400 instances and skips the continuous trickle.

---

## Files Touched

| File                                                  | Change                                               |
| ----------------------------------------------------- | ---------------------------------------------------- |
| `src/audio/BeatDetector.ts`                           | Add mid/treble band averaging, expose spectralFlux   |
| `src/stores/visualiserStore.ts`                       | Add `midPower`, `treblePower`, `spectralFlux` fields |
| `src/components/visualiser/AudioOrb.tsx`              | Add uniforms, update shaders                         |
| `src/components/visualiser/ParticleCrown.tsx`         | New file                                             |
| `src/components/visualiser/FullscreenOverlay.tsx`     | Mount ParticleCrown in Ambient layer                 |
| `src/components/visualiser/AudioTerrain.tsx`          | Add uMid uniform + shader hue shift                  |
| `src/components/visualiser/FrequencyBars.tsx`         | Replace color LUT with three-zone gradient           |
| `src/components/visualiser/ButterchurnVisualiser.tsx` | Expose preset name + prev/next API                   |
| `src/components/visualiser/PresetInfoStrip.tsx`       | New file                                             |
| `src/components/visualiser/FullscreenOverlay.tsx`     | Mount PresetInfoStrip in Presets layer               |
