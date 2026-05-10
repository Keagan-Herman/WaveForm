# BOLT'S JOURNAL - CRITICAL LEARNINGS ONLY

## 2025-05-14 - Redundant Allocations in Hot Path
**Learning:** High-frequency render loops (60fps) are extremely sensitive to garbage collection pressure. Creating new `Uint8Array`s and using `.slice()` on every frame in `AudioEngine` and `BeatDetector` creates significant memory churn.
**Action:** Reuse internal buffers and avoid array slicing in the hot path. Use simple loops for calculations instead of high-level array methods when performance is critical.

## 2025-05-14 - High-Frequency React Re-renders
**Learning:** Subscribing React components to high-frequency Zustand state (like `bassPower` updating at 60fps) causes the entire component to re-render every frame. Even with a simple component, the overhead of React's reconciliation and VDOM diffing adds up.
**Action:** Use imperative DOM updates for elements that need to react to 60fps data, bypassing React's render cycle for these specific hot-path updates.

## 2025-05-15 - Redundant Renders via Zustand Subscriptions
**Learning:** Bulk destructuring from Zustand stores (`const { x, y } = useStore()`) causes components to re-render whenever *any* property in the store changes. In this app, `playerStore` (via `progress`) and `visualiserStore` (via `bassPower`) update at 60fps. Any component using bulk destructuring from these stores will re-render at 60fps, even if they only need static data or low-frequency state.
**Action:** Always use targeted selectors (`const x = useStore(state => state.x)`) to ensure components only react to the specific state they need. For high-frequency visual updates that don't need React's reconciliation (like a progress bar or canvas draw), use imperative `getState()` inside the loop.
