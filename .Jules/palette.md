## 2025-05-14 - [Focus Ring Restoration & Navigation Interactivity]
**Learning:** Over-reliance on `outline: none` for "cleaner" visual designs severely breaks keyboard accessibility. Interactive elements like waveforms and scrubbers must maintain focus indicators to be usable without a mouse. Additionally, secondary metadata (like artist names) provides a natural navigation hook that users expect to be interactive.
**Action:** Always audit interactive components for `:focus-visible` styles and ensure all textual metadata that refers to a navigable entity (Artist, Album) is implemented as a semantic `<button>` or `<a>`.

## 2024-05-22 - [Rendering Heat: HSL Caching & Squared Distances]
**Learning:** Hot-path (60fps) string interpolations and square roots are silent performance killers. Template literals like `hsla(${h}, ${s}%, ${l}%, ${a})` trigger garbage collection churn if called hundreds of times per frame.
**Action:** Pre-calculate HSL color strings into a lookup table (palette) on theme change. Use squared distance checks (`dx*dx + dy*dy > thresholdSq`) to avoid `Math.sqrt` in radial visualizers.
