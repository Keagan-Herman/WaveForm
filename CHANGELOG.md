# Changelog

## [2025-05-10] - Local Music Support Improvements

### Added
- Unified track accessor helpers in `src/types/track.ts` (`getTrackCover`, `getTrackArtist`, `getTrackAlbum`) to simplify UI code.
- Click-to-seek functionality on the `WaveformLine` component.
- Album-driven dynamic theming for local file waveforms using `useAlbumColour`.
- Worker-based concurrency control (max 2 decodes) for local file uploads to prevent memory issues.

### Changed
- Refactored `computeWaveform` to return both peak data and audio duration in a single decoding pass.
- Renamed `usLocalFileMetadata.ts` to `useLocalFileMetadata.ts` and corrected all imports.
- Updated `PreviewPlayer.tsx` to use a stable ID (`preview-audio`) for programmatic seeking.
- Updated `PlayerBar.tsx` and other UI components to use the new unified track accessors.
- Synchronized `playerStore` state (`currentTime`, `duration`) with visualisers to ensure accurate scrubbing and progress display.
- Improved TypeScript definitions for `DeezerTrack` and `LocalTrack` to resolve type mismatches across the app.

### Fixed
- Fixed broken progress/setProgress state references in `WaveformScrubber.tsx`.
- Resolved over 40 TypeScript compilation errors related to the new local track union type.
- Fixed an issue where local track duration wasn't being correctly updated in the store.
- Ensured local file processing properly handles metadata extraction failures with filename fallbacks.
