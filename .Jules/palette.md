## 2025-05-14 - [Theming and Accessibility touches]
**Learning:** Hardcoded brand colors (like Spotify green) in a dynamic theming app can feel disjointed when the album art changes the global palette. Accessibility labels on purely visual indicators (like the 'E' badge for explicit content) are essential for screen readers even if they seem obvious visually.
**Action:** Always check for hardcoded colors and use provided theme objects/CSS variables. Ensure all status indicators have descriptive ARIA labels.
