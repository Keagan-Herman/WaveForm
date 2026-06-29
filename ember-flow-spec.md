# Ember Flow — Visual Spec

## Reference

Source: a TikTok visualizer (account `viutatonight`, "eyes are everything" audio).
Screenshots reviewed: dense particle strands erupting from a single point,
heat-colored, growing and brightening on bass hits.

## What it's supposed to look like

- **Form**: A dense particle/point field arranged into flowing, ribbon-like
  strands — not a flat plane, not a sphere. The strands twist and fork in
  3D space, sometimes crossing each other, tapering to fine points at their
  ends. No surface or mesh — pure particles following curved paths.
- **Color**: A heat gradient — pure black → deep red → magenta/pink →
  white-hot, in that order. The coolest (least active) particles are
  almost invisible against the black background; the hottest are blown
  out to near-white.
- **Streaks**: Long, motion-blurred rays/streaks shoot off the brightest,
  fastest-moving regions — like light trails stretched along the
  direction of travel, not static glow.
- **Texture**: A fine moiré/grid pattern is visible across the brighter
  surfaces — likely either the density of the underlying point cloud
  itself or a halftone-style overlay, not a sign of a solid mesh.
- **Background**: Pure black, no secondary light source — the structure
  is the only light in the scene.
- **Bloom**: Tight, hot threshold — only the truly bright particles glow,
  everything else stays dark and recedes into the background.

## Audio reactivity (the core behavior)

1. **Bass → growth.** On a bass hit, the strands visibly extend and
   thicken outward from their resting state, then ease back down between
   hits. This should read as "growing," not flickering — i.e. an eased
   response, not a 1:1 snap to the instantaneous bass value.
2. **Mid → turbulence.** Mid-frequency energy drives how chaotic/swirly
   the flow looks — more mid energy, more writhing motion in the strands.
3. **Treble → heat + sparkle.** Treble energy pushes color further along
   the heat ramp toward white, and adds a fine, fast jitter/sparkle on
   top of the base motion — this is what gives the brightest moments
   their "energetic" feel, distinct from just "more bass."

## Why this needs to be a flow-field, not a displaced grid/mesh

A heightmap/displaced-plane approach (what `AudioTerrain` already does)
produces a *surface* — looks like terrain or a flag, with implied
topology. The reference has none of that: strands fork, cross over each
other freely, and have no implied "ground." Only independent particles
following a 3D vector field (curl noise, in this implementation) can
produce that look — each particle moves along its own path with no
shared surface constraining it.

## Implementation summary

- New `EmberFlow.tsx` component, modeled on the existing `ParticleField.tsx`
  conventions (quality-scaled particle count, GPU-side shader math,
  deterministic PRNG seeding, additive blending).
- Curl noise built from finite differences of the project's existing
  `SIMPLEX_NOISE_3D` (3 offset samples per axis → cross-difference →
  normalized vector). This is what replaces an actual fluid/vector-field
  simulation at near-zero cost.
- `bassPower` → eased `growth` scalar (exponential lerp toward a
  bass-scaled target, not a direct assignment) → field amplitude.
- `midPower` → noise field time-evolution speed (turbulence).
- `treblePower` → brightness/heat-ramp position + secondary high-frequency
  curl sample as jitter.
- Heat ramp implemented as a 3-stage `mix()` in the fragment shader
  (black→red→magenta→white), not a texture lookup.
- Streaks done via stretching the point-sprite's UV space along the
  per-particle flow direction in the fragment shader — not a real
  accumulation/motion-blur buffer.
- Wired in as a 5th `VisualLayer` (`'Ember'`), exclusive with the other
  layers (replaces rather than blends), reachable via the `V` key cycle,
  the Header layer picker, and the shareable-URL layer param.

## Known gap (as of last build)

The current implementation does **not** match the reference closely
enough — it's visually indistinguishable from the `Ambient` layer in
practice. Root cause not yet confirmed; suspects are covered in the
debugging section of the conversation this doc was generated from
(likely candidates: opacity/uniform values too low to register, geometry
not actually receiving distinguishing motion, or `quality`-driven count
collapsing to something invisible at distance). Needs a real render to
diagnose rather than further static code review.