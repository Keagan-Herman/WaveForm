# Testing Guide

Waveform uses **Vitest** with **Browser Mode** for its test suite. This ensures that all code is tested in a real browser environment, providing access to actual Web Audio API, Fetch, and DOM implementations without heavy mocking.

## Philosophy

- **No Mocks**: We prefer testing against real implementations. For example, `deezerApi` tests make real network calls to the Deezer API.
- **Real Browser APIs**: Tests run in a real Chromium instance (via Playwright). This is crucial for audio processing logic like the `BeatDetector`.
- **Zustand Store Testing**: Stores are tested in isolation by resetting their state before each test.
- **Component Testing**: We use **React Testing Library** within the browser environment to verify UI behavior and interactions.

## Running Tests

### Development Mode (Watch)
To start Vitest in watch mode with the UI:
```bash
pnpm test
```

### CI / Single Run
To run all tests once and exit:
```bash
pnpm test:run
```

## Test Structure

- `src/lib/*.test.ts`: Unit tests for core utilities and API wrappers.
- `src/audio/*.test.ts`: Unit tests for audio processing logic.
- `src/stores/*.test.ts`: Unit tests for Zustand state management.
- `src/components/**/*.test.tsx`: Component tests using React Testing Library.

## Configuration

The testing environment is configured in `vitest.config.ts`. Key settings include:
- `browser.enabled`: Set to `true` to run tests in the browser.
- `browser.provider`: Uses `playwright` with `chromium`.
- `setupFiles`: Points to `src/test/setup.ts` for global test setup (e.g., `@testing-library/jest-dom`).

## Adding New Tests

1. Create a file ending in `.test.ts` or `.test.tsx`.
2. For components, use `render` from `@testing-library/react`.
3. For logic, use standard Vitest `describe`, `it`, and `expect` blocks.
4. If your test requires new dependencies, add them to `optimizeDeps.include` in `vitest.config.ts` to ensure stable browser execution.
