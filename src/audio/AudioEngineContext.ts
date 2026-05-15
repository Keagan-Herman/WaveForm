import { createContext } from 'react'
import { audioEngine, type AudioEngine } from './AudioEngine'

export const AudioEngineContext = createContext<AudioEngine>(audioEngine)
