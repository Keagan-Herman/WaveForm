import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BeatDetector } from './BeatDetector'

describe('BeatDetector', () => {
  let detector: BeatDetector

  beforeEach(() => {
    detector = new BeatDetector()
  })

  it('should initialize with default values', () => {
    expect(detector).toBeDefined()
  })

  it('should return 0 bassEnergy when input is silent', () => {
    const data = new Uint8Array(128).fill(0)
    const result = detector.detect(data)
    expect(result.bassEnergy).toBe(0)
    expect(result.beat).toBe(false)
  })

  it('should calculate bassEnergy correctly', () => {
    const data = new Uint8Array(128).fill(0)
    // Fill first 10 bins (bass range) with 255
    for (let i = 0; i < 10; i++) data[i] = 255
    const result = detector.detect(data)
    expect(result.bassEnergy).toBe(1)
  })

  it('should detect a beat on sudden energy increase', () => {
    // 1. Prime with silence to build history
    const silence = new Uint8Array(128).fill(0)
    for (let i = 0; i < 50; i++) {
      detector.detect(silence)
    }

    // 2. Sudden loud bass burst
    const loud = new Uint8Array(128).fill(0)
    for (let i = 0; i < 10; i++) loud[i] = 200

    const result = detector.detect(loud)
    expect(result.beat).toBe(true)
    expect(result.confidence).toBeGreaterThan(0)
  })

  it('should calculate approximate BPM after multiple beats', async () => {
    // We'll use real time but with longer waits to ensure accuracy in the browser environment
    const silence = new Uint8Array(128).fill(0)
    const beat = new Uint8Array(128).fill(255)

    // Helper to simulate a frame
    const process = (data: Uint8Array) => detector.detect(data)

    // Initial prime
    for (let i = 0; i < 50; i++) process(silence)

    // First beat
    process(beat)

    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    // 120 BPM = 500ms intervals
    await wait(500)
    process(beat)

    await wait(500)
    const result = process(beat)

    // Allow more wiggle room for real-time variations in sandbox
    expect(result.bpm).toBeGreaterThan(90)
    expect(result.bpm).toBeLessThan(150)
  })

  it('should reset state correctly', () => {
    const beat = new Uint8Array(128).fill(255)
    detector.detect(beat)
    detector.reset()

    const silentResult = detector.detect(new Uint8Array(128).fill(0))
    expect(silentResult.beat).toBe(false)
    expect(silentResult.bpm).toBe(0)
  })
})
