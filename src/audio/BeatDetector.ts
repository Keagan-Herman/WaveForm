/**
 * BeatDetector.ts
 *
 * Enhanced beat detector combining bass energy variance with spectral flux.
 */

export class BeatDetector {
  // Rolling history of bass energy values (circular buffer)
  private energyHistory: Float32Array
  private energyHead = 0
  private energyCount = 0
  // Rolling history of spectral flux values (circular buffer)
  private fluxHistory: Float32Array
  private fluxHead = 0
  private fluxCount = 0
  // Previous frequency data for flux calculation
  private prevFrequencyData: Uint8Array | null = null

  private readonly windowSize: number
  private readonly sensitivity: number

  private lastBeatTime: number = 0
  private bpmHistory: number[] = []

  constructor(sensitivity = 1.5, windowSize = 43) {
    this.sensitivity = sensitivity
    this.windowSize = windowSize
    this.energyHistory = new Float32Array(windowSize)
    this.fluxHistory = new Float32Array(windowSize)
  }

  /**
   * Pass the current frequency data array on every animation frame.
   * Returns an object with { beat, confidence, bassEnergy, bpm, spectralFlux }.
   */
  detect(frequencyData: Uint8Array): {
    beat: boolean
    confidence: number
    bassEnergy: number
    bpm: number
    spectralFlux: number
  } {
    // 1. Bass Energy Detection (Current approach)
    // PERFORMANCE: Avoid .slice() and .reduce() in hot path to reduce GC pressure
    let bassEnergyTotal = 0
    const bassCount = 10
    for (let i = 0; i < bassCount; i++) {
      bassEnergyTotal += frequencyData[i]
    }
    const bassEnergy = bassEnergyTotal / bassCount

    this.energyHistory[this.energyHead] = bassEnergy
    this.energyHead = (this.energyHead + 1) % this.windowSize
    if (this.energyCount < this.windowSize) this.energyCount++

    // 2. Spectral Flux Detection
    // Spectral flux measures the change in power spectrum from one frame to the next.
    let flux = 0
    if (this.prevFrequencyData) {
      for (let i = 0; i < frequencyData.length; i++) {
        const diff = frequencyData[i] - this.prevFrequencyData[i]
        // Only count positive changes (onsets)
        if (diff > 0) flux += diff
      }
    }

    if (!this.prevFrequencyData || this.prevFrequencyData.length !== frequencyData.length) {
      this.prevFrequencyData = new Uint8Array(frequencyData)
    } else {
      this.prevFrequencyData.set(frequencyData)
    }

    this.fluxHistory[this.fluxHead] = flux
    this.fluxHead = (this.fluxHead + 1) % this.windowSize
    if (this.fluxCount < this.windowSize) this.fluxCount++

    // Need at least half a window
    if (this.energyCount < this.windowSize / 2) {
      return {
        beat: false,
        confidence: 0,
        bassEnergy: bassEnergy / 255,
        bpm: 0,
        spectralFlux: Math.min(1, flux / 5000),
      }
    }

    // Energy stats — manual loops to avoid reduce() closure allocation at 60fps
    let energySum = 0
    for (let i = 0; i < this.energyCount; i++) energySum += this.energyHistory[i]
    const energyAvg = energySum / this.energyCount

    let energyVarSum = 0
    for (let i = 0; i < this.energyCount; i++) {
      const d = this.energyHistory[i] - energyAvg
      energyVarSum += d * d
    }
    const energyVar = energyVarSum / this.energyCount
    const energyThresh = (this.sensitivity + energyVar / 10000) * energyAvg

    // Flux stats
    let fluxSum = 0
    for (let i = 0; i < this.fluxCount; i++) fluxSum += this.fluxHistory[i]
    const fluxAvg = fluxSum / this.fluxCount

    let fluxVarSum = 0
    for (let i = 0; i < this.fluxCount; i++) {
      const d = this.fluxHistory[i] - fluxAvg
      fluxVarSum += d * d
    }
    const fluxVar = fluxVarSum / this.fluxCount
    const fluxThresh = (this.sensitivity + fluxVar / 10000) * fluxAvg

    const energyBeat = bassEnergy > energyThresh && bassEnergy > 10
    const fluxBeat = flux > fluxThresh && flux > 100 // flux is naturally higher magnitude

    // Determine confidence based on how much thresholds were exceeded
    const energyConfidence = energyBeat ? Math.min(1, (bassEnergy - energyThresh) / energyAvg) : 0
    const fluxConfidence = fluxBeat ? Math.min(1, (flux - fluxThresh) / fluxAvg) : 0

    // Combined confidence
    const confidence = (energyConfidence + fluxConfidence) / 2

    // Final beat decision: both usually agree on strong beats, flux helps on weak ones
    const isBeat = energyBeat || (fluxBeat && fluxConfidence > 0.5)

    if (isBeat) {
      const now = performance.now()
      const interval = now - this.lastBeatTime
      if (interval > 300 && interval < 2000) {
        // 30–200 BPM range
        const instantBPM = 60000 / interval
        this.bpmHistory.push(instantBPM)
        if (this.bpmHistory.length > 8) this.bpmHistory.shift()
      }
      this.lastBeatTime = now
    }

    const bpm =
      this.bpmHistory.length > 2
        ? this.bpmHistory.reduce((a, b) => a + b, 0) / this.bpmHistory.length
        : 0

    return {
      beat: isBeat,
      confidence,
      bassEnergy: bassEnergy / 255,
      bpm,
      spectralFlux: Math.min(1, flux / 5000),
    }
  }

  reset(): void {
    this.energyHead = 0
    this.energyCount = 0
    this.fluxHead = 0
    this.fluxCount = 0
    this.energyHistory.fill(0)
    this.fluxHistory.fill(0)
    this.prevFrequencyData = null
    this.bpmHistory = []
    this.lastBeatTime = 0
  }
}
