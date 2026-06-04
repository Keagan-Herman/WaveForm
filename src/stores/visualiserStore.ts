/**
 * visualiserStore.ts
 *
 * Zustand store for derived audio state that needs to cross the
 * canvas/React/R3F boundary.
 */

import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'

export type VisualLayer = 'Ambient' | 'Energy' | 'Minimal' | 'Presets'
export type QualityLevel = 'Low' | 'Medium' | 'Epic'

interface VisualiserStore {
  // Audio reactive state
  beat: boolean
  bassPower: number
  beatConfidence: number
  bpm: number

  // UI / Mode state
  visualLayer: VisualLayer
  isFullscreen: boolean
  quality: QualityLevel
  autoCycle: boolean
  isRecording: boolean
  showSettings: boolean

  // Layer Opacities (0-1)
  orbOpacity: number
  terrainOpacity: number
  particlesOpacity: number
  presetsOpacity: number
  albumGravityOpacity: number

  // Post-Processing
  bloomEnabled: boolean
  bloomIntensity: number
  godRaysEnabled: boolean
  chromaticAberrationEnabled: boolean
  vignetteEnabled: boolean
  filmGrainEnabled: boolean
  dofEnabled: boolean

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
  setQuality: (quality: QualityLevel) => void
  setAutoCycle: (enabled: boolean) => void
  setIsRecording: (isRecording: boolean) => void
  setShowSettings: (show: boolean) => void
  autoDowngrade: () => void

  // Layer controls
  setLayerOpacity: (layer: 'orb' | 'terrain' | 'particles' | 'presets' | 'albumGravity', opacity: number) => void

  // FX controls
  setFxEnabled: (fx: 'bloom' | 'godRays' | 'chromaticAberration' | 'vignette' | 'filmGrain' | 'dof', enabled: boolean) => void
  setBloomIntensity: (intensity: number) => void

  // Helper for backward compatibility
  isLowQuality: boolean
}

export const useVisualiserStore = create<VisualiserStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
      beat: false,
      bassPower: 0,
      beatConfidence: 0,
      bpm: 0,

      visualLayer: 'Ambient',
      isFullscreen: false,
      quality: 'Medium',
      autoCycle: false,
      isRecording: false,
      showSettings: false,
      isLowQuality: false,

      orbOpacity: 1,
      terrainOpacity: 1,
      particlesOpacity: 1,
      presetsOpacity: 0,
      albumGravityOpacity: 1,

      bloomEnabled: true,
      bloomIntensity: 1.5,
      godRaysEnabled: false,
      chromaticAberrationEnabled: false,
      vignetteEnabled: true,
      filmGrainEnabled: true,
      dofEnabled: false,

      setBeat: beat => set({ beat }),
      setBassPower: bassPower => set({ bassPower }),
      setBeatConfidence: beatConfidence => set({ beatConfidence }),
      setBpm: bpm => set({ bpm }),
      setAudioData: data => set(data),

      setVisualLayer: visualLayer => {
        // Legacy support: when switching layers, we might want to reset opacities
        // or keep them. For now, let's just update the label.
        set({ visualLayer })
      },
      cycleVisualLayer: () => {
        const layers: VisualLayer[] = ['Ambient', 'Energy', 'Minimal', 'Presets']
        const current = get().visualLayer
        const nextIndex = (layers.indexOf(current) + 1) % layers.length
        set({ visualLayer: layers[nextIndex] })
      },

      setIsFullscreen: isFullscreen => set({ isFullscreen }),
      toggleFullscreen: () => set(state => ({ isFullscreen: !state.isFullscreen })),

      setQuality: quality => set({ quality, isLowQuality: quality === 'Low' }),
      setAutoCycle: autoCycle => set({ autoCycle }),
      setIsRecording: isRecording => set({ isRecording }),
      setShowSettings: showSettings => set({ showSettings }),
      autoDowngrade: () => {
        const { quality } = get()
        if (quality === 'Epic') set({ quality: 'Medium' })
        else if (quality === 'Medium') set({ quality: 'Low', isLowQuality: true })
      },

      setLayerOpacity: (layer, opacity) => {
        switch (layer) {
          case 'orb': set({ orbOpacity: opacity }); break
          case 'terrain': set({ terrainOpacity: opacity }); break
          case 'particles': set({ particlesOpacity: opacity }); break
          case 'presets': set({ presetsOpacity: opacity }); break
          case 'albumGravity': set({ albumGravityOpacity: opacity }); break
        }
      },

      setFxEnabled: (fx, enabled) => {
        switch (fx) {
          case 'bloom': set({ bloomEnabled: enabled }); break
          case 'godRays': set({ godRaysEnabled: enabled }); break
          case 'chromaticAberration': set({ chromaticAberrationEnabled: enabled }); break
          case 'vignette': set({ vignetteEnabled: enabled }); break
          case 'filmGrain': set({ filmGrainEnabled: enabled }); break
          case 'dof': set({ dofEnabled: enabled }); break
        }
      },

      setBloomIntensity: bloomIntensity => set({ bloomIntensity }),
    }),
      {
        name: 'visualiser-settings',
        partialize: state => ({
          godRaysEnabled: state.godRaysEnabled,
        }),
      }
    )
  )
)
