# CLAUDE.md — Claude-Specific Instructions

> Read `AGENTS.md` first. This file adds Claude-specific behaviour on top of it.

---

## Scope of Changes

When asked to implement a feature or fix a bug, provide **complete, production-ready file contents** — not partial snippets, not pseudocode, not diffs with `// ... rest of file`. Keagan pastes files directly. Incomplete files waste both our time.

If a task touches multiple files, output all of them. If a file is untouched, say so explicitly rather than omitting it.

---

## Output Format

- One file per code block, with the full file path as the heading or in a comment at the top
- TypeScript only — no JavaScript
- Follow the exact Prettier config in `.prettierrc` (no semicolons, single quotes, 2-space indent, trailing commas in ES5 positions, 100-char print width, no parens on single arrow params)
- No `TODO` comments in delivered code — implement it or flag it as a named follow-up

---

## Reasoning Before Coding

For any non-trivial change, briefly state:

1. What the problem actually is (re-diagnose, don't assume the framing is correct)
2. What the approach is and why
3. Any tradeoffs or things that could go wrong

Keep this short — 3–5 sentences max. Then write the code.

---

## Architecture Rules (Claude must enforce these)

These come from `AGENTS.md` but are repeated here because Claude must flag violations even when not asked to:

1. **Raw audio data never enters React state or Zustand.** If a proposed change would put `Uint8Array` data into state, stop and redesign.
2. **AudioEngine is a singleton.** Never instantiate it. Import `audioEngine` from `AudioEngine.ts`.
3. **D3 owns its DOM.** If asked to render D3 nodes via React JSX, refuse and explain the boundary rule.
4. **Three render loops must stay separate.** R3F `useFrame` reads from `useVisualiserStore.getState()` — not from a React subscription.
5. **All Deezer calls go through `deezerFetch`.** Never hardcode `https://api.deezer.com`.
6. **Use Unified Track Accessors.** Always use `getTrackCover`, `getTrackArtist`, etc. from `@/types/track` when working with `Track` objects.

---

## Track Data Shape — Claude Must Remember

The app uses a `Track` union type (Deezer vs Local). **Always use unified accessors.**

| Field       | Deezer                     | Local                     | Accessor Helper          |
| ----------- | -------------------------- | ------------------------- | ------------------------ |
| Artist      | `track.artist.name`        | `track.artist.name`       | `getTrackArtist(track)`  |
| Album       | `track.album.title`        | `track.album.title`       | `getTrackAlbum(track)`   |
| Cover       | `track.album.cover_medium` | `track.album.cover`       | `getTrackCover(track)`   |
| Preview URL | `track.preview`            | `track.preview`           | (direct access)          |
| Duration    | `track.duration` (s)       | `track.duration` (s)      | (direct access)          |

If Claude ever writes code that accesses `track.artists`, `track.preview_url`, `track.duration_ms`, or `track.popularity` — that is a bug. Stop and correct it.

---

## What "Done" Looks Like

A feature is done when:

- It compiles with `pnpm build` (no TypeScript errors)
- It passes `pnpm lint` (no ESLint errors)
- It respects the architectural principles above
- It handles the empty/loading/error state (not just the happy path)
- It uses the `accent: AlbumColour` prop for any theming (no hardcoded colours)

---

## When Asked to Debug

1. Ask for the exact error message and stack trace if not provided
2. Identify the actual root cause before proposing a fix
3. Don't recommend `// @ts-ignore` or `any` as a fix — find the real type issue
4. If the bug is in a hot path (rAF loop), think about GC implications

---

## Style Preferences

- Monospace / terminal aesthetic throughout the UI
- Lowercase, spaced letter-tracking labels (e.g. `0.22em` letterSpacing, `uppercase`, opacity `0.2`)
- Inline `React.CSSProperties` style objects at the bottom of the file (no CSS modules, no Tailwind)
- Dark backgrounds (`#050505` base), colour comes entirely from album art via the `AlbumColour` system
- Transitions: `1s ease` for colour, `0.3s ease` for layout, `spring` for physics-based motion

---

## Memory Across Sessions

Claude does not retain memory between conversations. The combination of `AGENTS.md`, `CLAUDE.md`, `PROJECT-BRIEF.md`, and the codebase itself is the full context. At the start of any new session, Claude should read all three files before responding.
