/**
 * AudioContext.tsx
 *
 * React context that exposes the AudioEngine singleton to the component tree.
 * Wrap your app root with <AudioProvider>. Consume with useAudio().
 *
 * This does NOT create the AudioEngine — it just makes the existing singleton
 * accessible via context. The engine is initialised lazily on first user gesture
 * inside PreviewPlayer.
 */

import { createContext, useContext, type ReactNode } from 'react'
import { audioEngine, type AudioEngine } from './AudioEngine'

const AudioEngineContext = createContext<AudioEngine>(audioEngine)

export function AudioProvider({ children }: { children: ReactNode }) {
  // audioEngine is a singleton — no state, no effect needed here.
  // We're just making it available to the React tree via context.
  return <AudioEngineContext.Provider value={audioEngine}>{children}</AudioEngineContext.Provider>
}

export function useAudio(): AudioEngine {
  return useContext(AudioEngineContext)
}
