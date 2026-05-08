/**
 * BeatDetector.ts
 *
 * Enhanced beat detector combining bass energy variance with spectral flux.
 */

export class BeatDetector {
  // Rolling history of bass energy values
  private energyHistory: number[] = []
  // Rolling history of spectral flux values
  private fluxHistory: number[] = []
  // Previous frequency data for flux calculation
  private prevFrequencyData: Uint8Array | null = null

  private readonly windowSize: number
  private readonly sensitivity: number

  constructor(sensitivity = 1.5, windowSize = 43) {
    this.sensitivity = sensitivity
    this.windowSize = windowSize
  }

  /**
   * Pass the current frequency data array on every animation frame.
   * Returns an object with { beat: boolean, confidence: number }.
   */
  detect(frequencyData: Uint8Array): { beat: boolean; confidence: number } {
    // 1. Bass Energy Detection (Current approach)
    const bassSlice = frequencyData.slice(0, 10)
    const bassEnergy = bassSlice.reduce((sum, v) => sum + v, 0) / bassSlice.length

    this.energyHistory.push(bassEnergy)
    if (this.energyHistory.length > this.windowSize) {
      this.energyHistory.shift()
    }

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
    this.prevFrequencyData = new Uint8Array(frequencyData)

    this.fluxHistory.push(flux)
    if (this.fluxHistory.length > this.windowSize) {
      this.fluxHistory.shift()
    }

    // Need at least half a window
    if (this.energyHistory.length < this.windowSize / 2) return { beat: false, confidence: 0 }

    // Energy stats
    const energyAvg = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length
    const energyVar = this.energyHistory.reduce((sum, v) => sum + Math.pow(v - energyAvg, 2), 0) / this.energyHistory.length
    const energyThresh = (this.sensitivity + energyVar / 10000) * energyAvg

    // Flux stats
    const fluxAvg = this.fluxHistory.reduce((a, b) => a + b, 0) / this.fluxHistory.length
    const fluxVar = this.fluxHistory.reduce((sum, v) => sum + Math.pow(v - fluxAvg, 2), 0) / this.fluxHistory.length
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

    return { beat: isBeat, confidence }
  }

  reset(): void {
    this.energyHistory = []
    this.fluxHistory = []
    this.prevFrequencyData = null
  }
}
