## 2025-05-14 - [Theming and Accessibility touches]
**Learning:** Hardcoded brand colors (like Spotify green) in a dynamic theming app can feel disjointed when the album art changes the global palette. Accessibility labels on purely visual indicators (like the 'E' badge for explicit content) are essential for screen readers even if they seem obvious visually.
**Action:** Always check for hardcoded colors and use provided theme objects/CSS variables. Ensure all status indicators have descriptive ARIA labels.

## 2026-05-20 - [Metadata Consistency Across Views]
**Learning:** Users expect consistent information cues across different parts of the interface that represent the same data. Missing a critical metadata indicator (like 'Explicit' labels) in search results that is present in 'Now Playing' can lead to confusion or unintended playback of content.
**Action:** Identify core metadata for data objects and ensure consistent visual and accessibility markers across all list, grid, and detail views.

## 2026-05-24 - [Global Accessibility and Dynamic Context]
**Learning:** In a dynamically themed application, hardcoded focus rings (like the legacy green) break visual harmony. Using CSS variables for `:focus-visible` ensures accessibility remains integrated with the current aesthetic. Additionally, media applications benefit greatly from document title state (Play/Pause) as it provides immediate context in the browser's tab list.
**Action:** Always link global interaction styles (focus, selection) to the theme engine and leverage document title for ambient status updates.

## Integrated Local/Cloud UX (2025-05-10)
- **Unified Accessors:** Created `getTrackCover`, `getTrackArtist`, and `getTrackAlbum` to abstract away the `DeezerTrack | LocalTrack` union. Components should never check `source === 'local'` just to find an image.
- **Waveform Interaction:** Added click-to-seek on the static waveform (`WaveformLine`). The waveform color now shifts from white (beat pulse) to accent (album-matched) based on playback progress.
- **Visual Feedback:** `LocalFileLoader` provides explicit state transitions (Idle -> Processing -> Success) with a persistent count badge.

## 2026-05-28 - [Dynamic Theming for Playback Controls]
**Learning:** Hardcoded brand colors in playback controls (like the Spotify green play button) create a visual mismatch in a dynamically themed UI. Propagating the extracted album palette to the player bar ensures the most prominent interaction element feels integrated with the current track. Adding keyboard shortcut hints to titles improves discoverability for power users.
**Action:** Ensure all primary interaction points (play buttons, uploaders, progress bars) consume the global theme and provide explicit keyboard shortcut hints.

## 2026-06-05 - [Secondary Text Contrast in Dark Themes]
**Learning:** In a dark-themed application (especially one with dynamic background glows), secondary metadata like track indices or duration labels with 0.3-0.35 opacity often fall below acceptable contrast ratios. Increasing this to at least 0.45-0.5 significantly improves legibility without compromising the visual hierarchy.
**Action:** Audit secondary UI elements and ensure they maintain a minimum opacity of 0.45 against the dark background to satisfy accessibility guidelines.
