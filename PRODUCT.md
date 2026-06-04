# Product

## Register

brand

## Users

Two overlapping audiences: portfolio visitors and recruiters evaluating frontend depth,
and developers (including the author) who use Waveform as a genuine music discovery tool.
The interface must work as both a compelling technical showcase and a usable daily-driver
app. Neither audience is secondary.

## Product Purpose

Waveform is a browser-based music discovery and visualisation interface backed by the
Deezer public API. Users search for tracks, play 30-second previews, and watch the UI
react in real time via beat detection, frequency analysis, and album-art-reactive theming.
The project exists to demonstrate full-stack frontend capability across audio processing
(Web Audio API), 3D rendering (React Three Fiber), data visualisation (D3), and precision
UI/UX.

Success: a visitor opens the app, plays a track, thinks "this is the most technically
interesting music app I've seen in a browser" — then plays another.

## Brand Personality

Technical · Expressive · Japanese

The interface should feel like a precision instrument powered by music. Dark and restrained
at rest. Alive with color and motion the moment audio starts. The Japanese principle of
_ma_ (purposeful negative space) applies: the empty state is the contrast that makes the
playing state feel extraordinary.

## References

- **Teenage Engineering hardware** — Honest materials, purposeful constraints,
  instrument-grade precision. Every control has a purpose; nothing decorative.
- **Resident Advisor / Pitchfork (pre-redesign)** — Music as culture, not a consumer
  product. Editorial gravity. Dense information carried with confidence.
- **Figma / Linear / Raycast dark mode** — Tool-grade polish. Dark chrome that disappears
  into the task and lets content carry color.

## Anti-references

- **Spotify / Apple Music** — No rounded card shelves, no heavy platform branding, no
  curated-recommendation chrome.
- **SoundCloud / YouTube Music** — No waveform-as-decoration, no dark-but-cluttered
  information architecture.
- **Generic music visualizer demos** — No rainbow blobs, no screensaver-energy looping,
  no over-saturated WebGL noise.
- **Standard SaaS dark mode** — No gray sidebar + card grid aesthetic.

## Design Principles

1. **Instrument, not interface.** Every control should feel like it belongs on a precision
   hardware device. If an element does not earn its place, it is not there.
2. **Color earned by music.** The interface is near-monochrome at rest. Album art activates
   the palette. Beat and frequency data drive motion.
3. **Ma: space as signal.** The absence of a track is not a loading failure — it is the
   contrast that makes playback feel like an event.
4. **Two audiences, one surface.** Portfolio depth and daily usability are not in tension.
5. **Motion grounded in physics.** If the motion would look the same without music, it is
   wrong.

## Accessibility & Inclusion

- `prefers-reduced-motion` implemented via `useReducedMotion` hook; all components respect it.
- WCAG AA baseline for text contrast.
- Keyboard navigation for all playback controls (space, arrows, F, V).
- No content gated behind motion — visualiser panels are supplementary to audio controls.
