/**
 * AudioEngine.ts
 *
 * Singleton class that owns the Web Audio API context and analyser.
 * Must never be instantiated more than once — the AudioContext is a
 * limited browser resource and creating multiples causes glitches.
 *
 * IMPORTANT: AudioContext must be created inside a user gesture handler
 * (click, keydown, etc.) due to browser autoplay policy. Call init()
 * only after the user has interacted with the page.
 */

export class AudioEngine {
  private static instance: AudioEngine
  private context: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private source: MediaElementAudioSourceNode | null = null
  private _isInitialised = false

  private constructor() {}

  static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine()
    }
    return AudioEngine.instance
  }

  /**
   * Wire up an <audio> element to the analyser.
   * Call this exactly once, inside a user gesture handler.
   * Calling it a second time on the same element is a no-op.
   */
  init(audioElement: HTMLAudioElement): void {
    if (this._isInitialised) return

    this.context = new AudioContext()
    this.analyser = this.context.createAnalyser()

    // fftSize must be a power of 2. 256 gives 128 frequency bins —
    // enough resolution for bar visualisers without being expensive.
    this.analyser.fftSize = 256
    this.analyser.smoothingTimeConstant = 0.8

    this.source = this.context.createMediaElementSource(audioElement)
    this.source.connect(this.analyser)
    this.analyser.connect(this.context.destination)

    this._isInitialised = true
  }

  /**
   * Must be called inside a user gesture to satisfy browser autoplay policy.
   * Safe to call even if context is already running.
   */
  resume(): Promise<void> {
    if (!this.context) return Promise.resolve()
    return this.context.resume()
  }

  /**
   * Returns frequency-domain data (0–255 per bin).
   * Use for bar visualisers and beat detection.
   * Returns a zeroed array if the engine is not yet initialised.
   */
  getFrequencyData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(128)
    const data = new Uint8Array(this.analyser.frequencyBinCount)
    this.analyser.getByteFrequencyData(data)
    return data
  }

  /**
   * Returns time-domain (waveform) data (0–255 per sample, 128 = silence).
   * Use for the scrolling waveform line visualiser.
   * Returns a flat array if the engine is not yet initialised.
   */
  getWaveformData(): Uint8Array {
    if (!this.analyser) {
      const silence = new Uint8Array(256)
      silence.fill(128)
      return silence
    }
    const data = new Uint8Array(this.analyser.fftSize)
    this.analyser.getByteTimeDomainData(data)
    return data
  }

  get isInitialised(): boolean {
    return this._isInitialised
  }

  get sampleRate(): number {
    return this.context?.sampleRate ?? 44100
  }
}

// Export the singleton instance directly — import this everywhere,
// never call new AudioEngine().
export const audioEngine = AudioEngine.getInstance()