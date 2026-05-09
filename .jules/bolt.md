# BOLT'S JOURNAL - CRITICAL LEARNINGS ONLY

## 2025-05-14 - Redundant Allocations in Hot Path
**Learning:** High-frequency render loops (60fps) are extremely sensitive to garbage collection pressure. Creating new `Uint8Array`s and using `.slice()` on every frame in `AudioEngine` and `BeatDetector` creates significant memory churn.
**Action:** Reuse internal buffers and avoid array slicing in the hot path. Use simple loops for calculations instead of high-level array methods when performance is critical.

## 2025-05-14 - High-Frequency React Re-renders
**Learning:** Subscribing React components to high-frequency Zustand state (like `bassPower` updating at 60fps) causes the entire component to re-render every frame. Even with a simple component, the overhead of React's reconciliation and VDOM diffing adds up.
**Action:** Use imperative DOM updates for elements that need to react to 60fps data, bypassing React's render cycle for these specific hot-path updates.
