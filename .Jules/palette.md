## 2025-05-14 - [Theming and Accessibility touches]
**Learning:** Hardcoded brand colors (like Spotify green) in a dynamic theming app can feel disjointed when the album art changes the global palette. Accessibility labels on purely visual indicators (like the 'E' badge for explicit content) are essential for screen readers even if they seem obvious visually.
**Action:** Always check for hardcoded colors and use provided theme objects/CSS variables. Ensure all status indicators have descriptive ARIA labels.

## 2026-05-20 - [Metadata Consistency Across Views]
**Learning:** Users expect consistent information cues across different parts of the interface that represent the same data. Missing a critical metadata indicator (like 'Explicit' labels) in search results that is present in 'Now Playing' can lead to confusion or unintended playback of content.
**Action:** Identify core metadata for data objects and ensure consistent visual and accessibility markers across all list, grid, and detail views.

## 2026-05-22 - [Legibility and Focus Visibility]
**Learning:** Dense UI layouts with low-contrast metadata (opacity < 0.3) fail basic legibility standards even if they fit the "technical" aesthetic. Global focus indicators should always follow the dynamic theme to remain highly visible and feel integrated with the app's visual identity.
**Action:** Ensure secondary metadata has an opacity of at least 0.45 and font size of 0.65rem+. Use theme-aware CSS variables for all interactive focus states.
