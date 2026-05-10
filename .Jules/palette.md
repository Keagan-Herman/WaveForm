## 2025-05-14 - [Theming and Accessibility touches]
**Learning:** Hardcoded brand colors (like Spotify green) in a dynamic theming app can feel disjointed when the album art changes the global palette. Accessibility labels on purely visual indicators (like the 'E' badge for explicit content) are essential for screen readers even if they seem obvious visually.
**Action:** Always check for hardcoded colors and use provided theme objects/CSS variables. Ensure all status indicators have descriptive ARIA labels.

## 2026-05-20 - [Metadata Consistency Across Views]
**Learning:** Users expect consistent information cues across different parts of the interface that represent the same data. Missing a critical metadata indicator (like 'Explicit' labels) in search results that is present in 'Now Playing' can lead to confusion or unintended playback of content.
**Action:** Identify core metadata for data objects and ensure consistent visual and accessibility markers across all list, grid, and detail views.
