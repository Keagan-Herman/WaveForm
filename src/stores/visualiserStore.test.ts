import { describe, it, expect, beforeEach } from 'vitest'
import { useVisualiserStore } from './visualiserStore'

describe('visualiserStore', () => {
  beforeEach(() => {
    useVisualiserStore.setState({
      beat: false,
      bassPower: 0,
      beatConfidence: 0,
      bpm: 0,
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

  it('should update audio data', () => {
    useVisualiserStore.getState().setAudioData({
      beat: true,
      bassPower: 0.8,
      beatConfidence: 0.9,
      bpm: 128,
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
})
