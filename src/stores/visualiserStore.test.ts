import { describe, it, expect, beforeEach } from 'vitest'
import { useVisualiserStore } from './visualiserStore'

describe('visualiserStore', () => {
  beforeEach(() => {
    useVisualiserStore.setState({
      beat: false,
      bassPower: 0,
      beatConfidence: 0,
      bpm: 0,
      midPower: 0,
      treblePower: 0,
      spectralFlux: 0,
      visualLayer: 'Ambient',
      isFullscreen: false,
      isLowQuality: false,
      quality: 'Medium',
      autoCycle: false,
      isRecording: false,
      showSettings: false,
      orbOpacity: 1,
      terrainOpacity: 1,
      particlesOpacity: 1,
      presetsOpacity: 0,
      albumGravityOpacity: 1,
      emberFlowOpacity: 0,
      bloomEnabled: true,
      bloomIntensity: 1.5,
      godRaysEnabled: false,
      chromaticAberrationEnabled: false,
      vignetteEnabled: true,
      filmGrainEnabled: true,
      dofEnabled: false,
    })
  })

  it('should initialize with default state', () => {
    const state = useVisualiserStore.getState()
    expect(state.visualLayer).toBe('Ambient')
    expect(state.beat).toBe(false)
  })

  it('should accept and store midPower, treblePower, and spectralFlux from setAudioData', () => {
    useVisualiserStore.getState().setAudioData({
      beat: false,
      bassPower: 0.3,
      beatConfidence: 0.1,
      bpm: 120,
      midPower: 0.6,
      treblePower: 0.4,
      spectralFlux: 0.2,
    })
    const s = useVisualiserStore.getState()
    expect(s.midPower).toBe(0.6)
    expect(s.treblePower).toBe(0.4)
    expect(s.spectralFlux).toBe(0.2)
  })

  it('should update audio data', () => {
    useVisualiserStore.getState().setAudioData({
      beat: true,
      bassPower: 0.8,
      beatConfidence: 0.9,
      bpm: 128,
      midPower: 0,
      treblePower: 0,
      spectralFlux: 0,
    })

    const state = useVisualiserStore.getState()
    expect(state.beat).toBe(true)
    expect(state.bassPower).toBe(0.8)
    expect(state.bpm).toBe(128)
  })

  it('should cycle visual layers', () => {
    const store = useVisualiserStore.getState()

    expect(store.visualLayer).toBe('Ambient')
    store.cycleVisualLayer()
    expect(useVisualiserStore.getState().visualLayer).toBe('Energy')
    store.cycleVisualLayer()
    expect(useVisualiserStore.getState().visualLayer).toBe('Minimal')
    store.cycleVisualLayer()
    expect(useVisualiserStore.getState().visualLayer).toBe('Presets')
    store.cycleVisualLayer()
    expect(useVisualiserStore.getState().visualLayer).toBe('Ember')
    store.cycleVisualLayer()
    expect(useVisualiserStore.getState().visualLayer).toBe('Ambient')
  })

  it('should toggle fullscreen', () => {
    expect(useVisualiserStore.getState().isFullscreen).toBe(false)
    useVisualiserStore.getState().toggleFullscreen()
    expect(useVisualiserStore.getState().isFullscreen).toBe(true)
  })

  it('should persist godRaysEnabled', async () => {
    // Initial state
    expect(useVisualiserStore.getState().godRaysEnabled).toBe(false)

    // Update state
    useVisualiserStore.getState().setFxEnabled('godRays', true)
    expect(useVisualiserStore.getState().godRaysEnabled).toBe(true)

    // Verify localStorage
    const stored = localStorage.getItem('visualiser-settings')
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.state.godRaysEnabled).toBe(true)
  })

  it('should update all layer opacities in a single call', () => {
    useVisualiserStore.getState().setAllLayerOpacities({
      orb: 0.5,
      terrain: 0.25,
      particles: 0.75,
    })
    const state = useVisualiserStore.getState()
    expect(state.orbOpacity).toBe(0.5)
    expect(state.terrainOpacity).toBe(0.25)
    expect(state.particlesOpacity).toBe(0.75)
    // Untouched keys unchanged
    expect(state.albumGravityOpacity).toBe(1)
    expect(state.presetsOpacity).toBe(0)
    expect(state.emberFlowOpacity).toBe(0)
  })
})
