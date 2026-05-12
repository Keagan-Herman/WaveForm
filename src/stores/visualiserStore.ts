/**
 * visualiserStore.ts
 *
 * Zustand store for derived audio state that needs to cross the
 * canvas/React/R3F boundary.
 */

import { create } from 'zustand'

export type VisualLayer = 'Ambient' | 'Energy' | 'Minimal' | 'Presets'

interface VisualiserStore {
  // Audio reactive state
  beat: boolean
  bassPower: number
  beatConfidence: number
  bpm: number

  // UI / Mode state
  visualLayer: VisualLayer
  isFullscreen: boolean
  isLowQuality: boolean

  // Actions
  setBeat: (beat: boolean) => void
  setBassPower: (power: number) => void
  setBeatConfidence: (confidence: number) => void
  setBpm: (bpm: number) => void
  setAudioData: (data: {
    beat: boolean
    bassPower: number
    beatConfidence: number
    bpm: number
  }) => void
  setVisualLayer: (layer: VisualLayer) => void
  cycleVisualLayer: () => void
  setIsFullscreen: (isFullscreen: boolean) => void
  toggleFullscreen: () => void
  setIsLowQuality: (isLowQuality: boolean) => void
  toggleLowQuality: () => void
}

export const useVisualiserStore = create<VisualiserStore>((set, get) => ({
  beat: false,
  bassPower: 0,
  beatConfidence: 0,
  bpm: 0,

  visualLayer: 'Ambient',
  isFullscreen: false,
  isLowQuality: false,

  setBeat: beat => set({ beat }),
  setBassPower: bassPower => set({ bassPower }),
  setBeatConfidence: beatConfidence => set({ beatConfidence }),
  setBpm: bpm => set({ bpm }),
  setAudioData: data => set(data),

  setVisualLayer: visualLayer => set({ visualLayer }),
  cycleVisualLayer: () => {
    const layers: VisualLayer[] = ['Ambient', 'Energy', 'Minimal', 'Presets']
    const current = get().visualLayer
    const nextIndex = (layers.indexOf(current) + 1) % layers.length
    set({ visualLayer: layers[nextIndex] })
  },

  setIsFullscreen: isFullscreen => set({ isFullscreen }),
  toggleFullscreen: () => set(state => ({ isFullscreen: !state.isFullscreen })),

  setIsLowQuality: isLowQuality => set({ isLowQuality }),
  toggleLowQuality: () => set(state => ({ isLowQuality: !state.isLowQuality })),
}))
