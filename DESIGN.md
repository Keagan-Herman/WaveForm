---
name: Waveform
description: A browser-based music discovery and visualisation instrument backed by the Deezer public API.
colors:
  deep-black: '#0d0d0d'
  monitor-white: '#e0e0e0'
  system-idle: '#7082a0'
  surface-layer: '#111111'
  border-dim: '#1f1f1f'
typography:
  wordmark:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Helvetica, sans-serif'
    fontSize: '0.85rem'
    fontWeight: 600
    letterSpacing: '0.3em'
    lineHeight: 1
  label:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Helvetica, sans-serif'
    fontSize: '0.6rem'
    fontWeight: 700
    letterSpacing: '0.25em'
    lineHeight: 1
  body:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Helvetica, sans-serif'
    fontSize: '0.75rem'
    fontWeight: 600
    letterSpacing: '-0.01em'
    lineHeight: 1.4
  meta:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Helvetica, sans-serif'
    fontSize: '0.65rem'
    fontWeight: 400
    letterSpacing: '0.05em'
    lineHeight: 1.3
  mono:
    fontFamily: 'SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace'
    fontSize: '0.65rem'
    fontWeight: 400
    letterSpacing: '0'
    lineHeight: 1
rounded:
  none: '0px'
  sm: '2px'
  md: '4px'
spacing:
  xs: '8px'
  sm: '16px'
  md: '32px'
  lg: '64px'
  xl: '96px'
components:
  button-transport:
    backgroundColor: 'rgba(255,255,255,0.03)'
    textColor: '{colors.monitor-white}'
    rounded: '{rounded.sm}'
    width: '32px'
    height: '32px'
  button-transport-active:
    backgroundColor: '{colors.accent}'
    textColor: '#000000'
    rounded: '{rounded.sm}'
    width: '32px'
    height: '32px'
  button-play:
    backgroundColor: 'rgba(255,255,255,0.05)'
    textColor: '{colors.monitor-white}'
    rounded: '{rounded.sm}'
    width: '44px'
    height: '44px'
  button-play-active:
    backgroundColor: '{colors.accent}'
    textColor: '#000000'
    rounded: '{rounded.sm}'
    width: '44px'
    height: '44px'
  button-functional:
    backgroundColor: 'rgba(255,255,255,0.03)'
    textColor: '{colors.monitor-white}'
    rounded: '{rounded.sm}'
    padding: '0.35rem 0.75rem'
  track-row:
    backgroundColor: 'transparent'
    textColor: '{colors.monitor-white}'
    rounded: '{rounded.sm}'
    padding: '0.5rem 1rem'
  track-row-active:
    backgroundColor: 'rgba(255,255,255,0.03)'
    textColor: '{colors.accent}'
    rounded: '{rounded.sm}'
    padding: '0.5rem 1rem'
  art-frame:
    backgroundColor: 'rgba(255,255,255,0.02)'
    rounded: '{rounded.none}'
    width: '32px'
    height: '32px'
---

# Design System: Waveform

## 1. Overview

**Creative North Star: "The Instrumentation Panel"**

Waveform is designed as a precision instrument panel, not a music app. The closest physical references are a studio mixing board at rest, a Teenage Engineering OP-1, or a piece of rack-mount audio equipment: dark anodized aluminum, engraved labels, mechanical buttons that depress exactly 1mm, and numerical readouts in a fixed-width typeface. Everything functional, nothing decorative.

The interface exists in two states: _standby_ and _active_. At rest, the palette is near-monochromatic — deep black backgrounds, faint borders, monitor-white text at controlled opacity. The moment a track plays, the album art drives a full reactive palette through CSS custom properties: backgrounds, borders, accents, and glows shift to reflect the music. This reactive system is the visual signature of Waveform. It is not a theme toggle; it is the interface responding to its input signal, like a meter needle moving.

Typography is compressed and functional. All metadata travels in uppercase with wide tracking, echoing the legend labels on hardware panels. Track titles use tight tracking and heavier weight — they are the signal name, not decoration. Monospace appears only for numerical readouts (time, indices) — data that should read like a display, not prose.

**Key Characteristics:**

- Near-monochrome at rest; album-art-reactive when playing
- Square corners throughout (2px maximum radius on interactive elements; 0px on media frames)
- Opacity as the primary hierarchy tool within a single hue
- Spring physics on transport controls; eased curves on panels and overlays
- Uppercase-tracked labels as the dominant typographic voice for all metadata
- No decorative shadows; depth through tonal layering and opacity

## 2. Colors: The Reactive Instrument Palette

The palette has two tiers: _static chassis colors_ that never change, and a _reactive signal palette_ injected at runtime from each track's album art.

### Static Chassis

- **Deep Black** (`#0d0d0d`): The body background. Near-absolute black, not pure `#000`, which reads as digital void. This is the material of the panel — matte anodized aluminum at dusk.
- **Surface Layer** (`#111111`): Panel interiors, sidebar backgrounds. One step above Deep Black, readable as a distinct surface without a border.
- **Border Dim** (`#1f1f1f`): Resting border color on all interactive elements when no track is playing. At this lightness it reads as structure without calling attention.
- **Monitor White** (`#e0e0e0`): All body text. Not pure white — that reads as screen glare. This is the readable luminance of a calibrated monitor.
- **System Idle** (`#7082a0`): The fallback accent when no album art is loaded. A neutral blue-grey that reads as "ready, not playing." Used on error states and the unplayed default.

### Reactive Signal Palette

Injected as CSS custom properties on `:root` by `useAlbumColour` each time a track changes:

- `--accent-color`: The dominant hue from the album art, saturated +30% and lightened +10%. Used on active track titles, playing indicators, button fills, and hover glows.
- `--primary-color`: The raw dominant hue extracted from the art.
- `--secondary-color`: The dominant hue desaturated -20% and lightened +5%.
- `--bg-color`: Album hue desaturated -50%, forced to ≤8% lightness. The reactive body background.
- `--surface-color`: Album hue desaturated -40%, forced to ≤12% lightness. Panel surfaces when playing.
- `--border-color`: Album hue darkened -30% at 15% opacity. Borders when playing.
- `--reactive-border`: Bass-power-driven border glow, updated at 60fps outside React. Pulses with each beat.

**The One Signal Rule.** `--accent-color` is used for exactly three things: the active track title, the playing state on transport buttons, and beat-reactive glows. It never appears as a background on neutral elements or as a decoration on inactive states. Its scarcity is what makes it feel like a signal, not a coat of paint.

**The Forced Dark Rule.** No matter what the album art extracts, `--bg-color` is capped at 8% lightness and `--surface-color` at 12%. White album? The background is still near-black. The music provides the color; the chassis stays dark.

### Named Rules

**The No Static Accent Rule.** Do not pick a single hardcoded accent color for the interface. The accent is always derived from the current track. When no track is playing, System Idle (`#7082a0`) is the fallback — it signals readiness, not branding.

## 3. Typography

**Primary Font:** Inter (system stack: `-apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif`)
**Mono Font:** SFMono-Regular (fallback stack: `Consolas, Liberation Mono, Menlo, monospace`)

**Character:** Inter carries the entire hierarchy. No display/body pairing — the system is monofont in spirit, with weight and case doing all the work. The mono stack appears only for numerical readouts, preserving tabular alignment and hardware-readout semantics.

### Hierarchy

- **Wordmark** (600, 0.85rem, 0.3em tracking, uppercase): The app name in the header. The widest tracking in the system — it announces the instrument, not the content.
- **Label** (700, 0.6rem, 0.25em tracking, uppercase, opacity 0.4): Section headers (`Library`, `Status`, `Topology`), panel eyebrows, functional button text. The typographic language of a panel legend — it identifies the zone, then steps back.
- **Body** (600, 0.75rem, -0.01em tracking): Track titles, primary content. Tighter tracking and heavier weight mark this as the signal name. At most 1-2 lines; this is a list item, not prose.
- **Meta** (400, 0.65rem, 0.05em tracking, uppercase, opacity 0.4–0.5): Artist names, album titles, utility labels. Uppercase with gentle tracking — readable without competing with Body.
- **Mono Readout** (400, 0.65rem, monospace, opacity 0.3–0.4): Timestamps, track indices. Fixed-width so numbers stay aligned across rows. Deliberately low opacity — data, not content.

### Named Rules

**The Two-Case Rule.** Body text is sentence case. Everything else — labels, metadata, section titles, button text — is uppercase. There is no mixed-case metadata in this system; it reads as noise on a dark panel.

**The Opacity Stack Rule.** Within a single hue, hierarchy is expressed through opacity, not size. Monitor White at full opacity is the active element; at 0.5 it's secondary; at 0.3-0.4 it's tertiary context. Never introduce a third typeface or a gray value to create hierarchy — use the opacity stack.

## 4. Elevation

Waveform is flat by default. There are no ambient drop shadows, no card elevation layers, no blurs on resting surfaces. Depth is conveyed through:

1. **Opacity layering**: `rgba(255,255,255,0.01)` → `rgba(255,255,255,0.03)` → `rgba(255,255,255,0.08)` are the three surface levels.
2. **Border presence**: A `1px solid` border at Border Dim marks an interactive surface as distinct from its background.
3. **Reactive glows**: The only "shadow" in the system is the accent-color hover glow on the play button (`0 0 20px {accent}44`) and the bass-reactive border on the active track row. Both are state-driven, not decorative.

### Shadow Vocabulary

- **Play Button Hover Glow** (`0 0 20px {accent}44`): Applied to the primary play button on hover. The only outward-casting light in the system. It is driven by interaction, not applied by default.
- **Play Button Inset** (`inset 0 1px 0 rgba(255,255,255,0.1)`): A subtle internal highlight on the play button at rest. Creates the faint bevel that reads as a physical button.
- **Bass Reactive Border** (`rgba({accent-rgb}, 0.05–0.20)`): Updated at 60fps via direct DOM manipulation. Pulses on the outer border of the interface in response to bass frequency power.

### Named Rules

**The No Ambient Shadow Rule.** Shadows are prohibited on resting UI elements: cards, panels, section containers, list items. If an element needs visual separation, use a border or a 1-step opacity shift. Shadows appear only as a response to state (hover, active, beat).

## 5. Components

**Character:** Restrained at rest, reactive under music. Every component earns its visual presence from the audio state. At standby, the interface is a dark instrument waiting to be played.

### Transport Buttons (Prev / Next)

- **Shape:** Square-edged (2px radius — near-zero; reads as mechanical, not rounded)
- **Size:** 32×32px
- **Resting:** `rgba(255,255,255,0.03)` fill, `1px solid` Border Dim border, Monitor White icon
- **Hover:** `rgba(255,255,255,0.08)` fill (via spring animation, `stiffness: 400, damping: 18`)
- **Active / Looping:** `--accent-color` fill, black icon — the button becomes the signal
- **Press:** `scale: 0.95` (spring, confirms the mechanical click)

### Play / Pause Button

- **Shape:** 2px radius, 44×44px — larger than transport to mark primary action
- **Resting (paused):** `rgba(255,255,255,0.05)` fill, 1px border, Monitor White icon, inset highlight
- **Active (playing):** `--accent-color` fill, black icon, accent hover glow (`0 0 20px {accent}44`)
- **Press:** `scale: 0.94` spring, immediate

### Functional Buttons (Header utilities)

- **Shape:** 2px radius
- **Resting:** `rgba(255,255,255,0.03)` fill, 1px border, 0.65rem uppercase label, 0.1em tracking
- **Accent-filled variant** (Enter Visualiser): `--accent-color` fill, black text, bold — the one high-contrast action in the header

### Track Row

- **Layout:** CSS grid (`32px 32px 1.5fr 1fr 50px`): index · art · title+artist · album · duration
- **Resting:** `transparent` fill, 1px Border Dim border, 2px radius
- **Hover:** `rgba(255,255,255,0.015)` fill
- **Active:** `rgba(255,255,255,0.03)` fill, accent-colored border (1px), accent-colored title text
- **Active + Playing:** Bass-reactive glow overlay (`position: absolute, inset: 0`) animates fill opacity with `bassPower` at 60fps. The row breathes with the music.
- **Album art:** 32×32px, 0px radius (square), grayscale-shifted 50% on inactive tracks, full color on active

### Art Frame

- **Shape:** No radius (0px) — media is always rectangular, never pill-shaped
- **Sizes:** 32×32px (track row), 48×48px (player bar)
- **Background:** `rgba(255,255,255,0.02)` when empty
- **Border:** 1px Border Dim

### Section Headers

- **Height:** 32px
- **Background:** `rgba(255,255,255,0.02)`
- **Border:** 1px bottom Border Dim
- **Label:** 0.6rem Inter 700, uppercase, 0.25em tracking, opacity 0.4
- **Accent dot:** 4×4px circle at `--accent-color`, opacity 0.6. The only decoration allowed in section headers.

### Player Bar (Footer)

- **Height:** 80px, fixed bottom
- **Background:** `--bg-color` (reactive), 1px top Border Dim
- **Layout:** track info (left, min-width 240px) · transport controls (center) · waveform readout (flex-1) · utilities (right)
- **Entrance:** Spring slide-up (`y: 80 → 0`, `stiffness: 200, damping: 30`) on mount

### Header

- **Height:** 46px
- **Background:** `rgba(0,0,0,0.2)` — semi-transparent so reactive background shows through
- **Border:** 1px bottom Border Dim
- **z-index:** 100

## 6. Do's and Don'ts

### Do:

- **Do** derive all accent colors from `useAlbumColour`. The reactive palette is the product's visual signature; any hardcoded accent color breaks the system.
- **Do** use 2px radius (`--radius-sm`) on all interactive controls. This near-square shape is the hardware-instrument signature.
- **Do** use 0px radius on all media frames (album art, thumbnails). Images are always square-cornered.
- **Do** express hierarchy through opacity within Monitor White, not through multiple gray values or a secondary typeface.
- **Do** uppercase all metadata labels with at least 0.05em letter-spacing. Body content (track titles) is the only text in sentence case.
- **Do** use spring physics on transport controls (`stiffness: 400, damping: 18`) and eased curves on panels. The physical/digital distinction is deliberate.
- **Do** keep `--bg-color` and `--surface-color` at ≤8% and ≤12% lightness. Force this even for bright or white album art.
- **Do** use Framer Motion's `whileTap` on all buttons for the press-depth confirmation (`scale: 0.95`).
- **Do** use `prefers-reduced-motion` via the `useReducedMotion` hook to disable beat-reactive and entrance animations.

### Don't:

- **Don't** add border-radius above 4px to any element. No pill-shaped buttons, no rounded cards. If an element has radius >4px, it is wrong.
- **Don't** use Spotify/Apple Music patterns: no rounded card shelves, no curated shelf layouts, no heavy platform branding.
- **Don't** build screensaver-energy visualizers — rainbow blobs, looping patterns independent of audio. Every visual motion must respond to a real audio event (beat, frequency band, bass power).
- **Don't** add ambient drop shadows to resting elements. Shadows appear only on interaction states and beat-reactive moments.
- **Don't** use SoundCloud/YouTube Music patterns: no waveform-as-decoration, no cluttered dark layouts that treat density as energy.
- **Don't** introduce a second accent color as decoration. `--accent-color` earns its place on active states only; inactive elements stay in the Monitor White opacity stack.
- **Don't** build standard SaaS dark-mode layouts: no gray sidebar + card grid. Sections are spatial zones, not template columns.
- **Don't** add new sections to the layout with the small-caps eyebrow label pattern without questioning whether the label earns its place. Labels should identify function, then recede.
- **Don't** use `rgba(0,0,0,0)` as a hover state color. Use opacity-shifted Monitor White layers (`rgba(255,255,255,0.015)`, `rgba(255,255,255,0.03)`, `rgba(255,255,255,0.08)`).
- **Don't** put raw audio data (Uint8Array) in React state or Zustand. Beat-reactive UI updates bypass React via direct DOM mutation on CSS variables.
