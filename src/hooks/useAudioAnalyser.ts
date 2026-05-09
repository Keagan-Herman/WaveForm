/**
 * useAudioAnalyser.ts — v3
 *
 * Single shared rAF loop across all subscribers. Corrected version:
 * - Uses useVisualiserStore.getState() inside the module-level loop
 *   (safe — Zustand's getState() works outside React)
 * - Removed the broken useEffect that tried to sync setters into state
 * - Zustand setters are stable references, they never need syncing
 */

import { useEffect, useRef, useCallback } from 'react'
import { audioEngine } from '@/audio/AudioEngine'
import { BeatDetector } from '@/audio/BeatDetector'
import { useVisualiserStore } from '@/stores/visualiserStore'

// ─── Module-level shared loop ─────────────────────────────────────────────

type FrameCallback = (freqData: Uint8Array, waveData: Uint8Array) => void

const subscribers = new Map<symbol, FrameCallback>()
let animFrameId: number | null = null
const beatDetector = new BeatDetector()

function tick() {
  if (subscribers.size === 0) {
    animFrameId = null
    return
  }

  const freqData = audioEngine.getFrequencyData()
  const waveData = audioEngine.getWaveformData()

  // getState() is safe to call outside React — this is Zustand's
  // escape hatch for imperative / non-React contexts
  const { setBeat, setBassPower, setBeatConfidence } = useVisualiserStore.getState()

  const { beat, confidence, bassEnergy } = beatDetector.detect(freqData)

  setBeat(beat)
  setBeatConfidence(confidence)
  setBassPower(bassEnergy)

  subscribers.forEach(cb => cb(freqData, waveData))

  animFrameId = requestAnimationFrame(tick)
}

function startSharedLoop() {
  if (animFrameId !== null) return
  animFrameId = requestAnimationFrame(tick)
}

function stopSharedLoop() {
  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId)
    animFrameId = null
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────

interface AnalyserCallbacks {
  onFrequencyData?: (data: Uint8Array) => void
  onWaveformData?: (data: Uint8Array) => void
}

export function useAudioAnalyser(callbacks: AnalyserCallbacks = {}) {
  // Stable symbol per hook instance — uniquely identifies this subscriber
  const keyRef = useRef<symbol>(Symbol())

  // Keep callbacks in a ref so the loop always has the latest version
  // without needing to re-register on every render
  const callbacksRef = useRef(callbacks)
  useEffect(() => {
    callbacksRef.current = callbacks
  })

  const start = useCallback(() => {
    const key = keyRef.current

    subscribers.set(key, (freqData, waveData) => {
      callbacksRef.current.onFrequencyData?.(freqData)
      callbacksRef.current.onWaveformData?.(waveData)
    })

    startSharedLoop()
  }, [])

  const stop = useCallback(() => {
    subscribers.delete(keyRef.current)

    if (subscribers.size === 0) {
      stopSharedLoop()
      beatDetector.reset()
    }
  }, [])

  // Guarantee cleanup on unmount even if the consumer forgets to call stop()
  useEffect(() => {
    return () => stop()
  }, [stop])

  return { start, stop }
}