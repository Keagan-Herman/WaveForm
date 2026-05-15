import { type ReactNode } from 'react'
import { audioEngine } from './AudioEngine'
import { AudioEngineContext } from './AudioEngineContext'

export function AudioProvider({ children }: { children: ReactNode }) {
  return <AudioEngineContext.Provider value={audioEngine}>{children}</AudioEngineContext.Provider>
}
