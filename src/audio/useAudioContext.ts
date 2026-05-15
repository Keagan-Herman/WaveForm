import { useContext } from 'react'
import { AudioEngineContext } from './AudioEngineContext'

export const useAudioContext = () => useContext(AudioEngineContext)
