import { createContext, useContext, type ReactNode } from 'react'
import { audioEngine, type AudioEngine } from './AudioEngine'

const AudioEngineContext = createContext<AudioEngine>(audioEngine)

export function AudioProvider({ children }: { children: ReactNode }) {
  return <AudioEngineContext.Provider value={audioEngine}>{children}</AudioEngineContext.Provider>
}

export const useAudioContext = () => useContext(AudioEngineContext)
