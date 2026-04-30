/**
 * BeatDetector.ts
 *
 * Sliding window beat detector based on bass energy variance.
 *
 * HOW IT WORKS:
 * Maintains a history of bass energy values over a rolling window (~1 second).
 * A beat is detected when the current energy significantly exceeds the
 * recent average. The threshold multiplier C is dynamic — it increases
 * when energy variance is high (busy signal) to reduce false positives.
 *
 * KNOWN LIMITATIONS:
 * - Works best on music with hard transient kicks (electronic, hip-hop, rock)
 * - Will false-positive on tracks with sustained bass (jazz, classical)
 * - Heavily compressed pop music (low dynamic range) reduces detection accuracy
 * - The configurable `sensitivity` parameter lets you tune per-genre if needed
 *
 * This is a heuristic detector, not a ground-truth onset detector.
 * For a portfolio demo it is more than sufficient.
 */

export class BeatDetector {
  // Rolling history of bass energy values
  private history: number[] = []

  // ~1 second of history at 60fps
  private readonly windowSize: number

  // Base threshold multiplier. Higher = less sensitive (fewer false positives).
  // Lower = more sensitive (catches quieter beats, more false positives).
  // Recommended range: 1.2 – 2.0
  private readonly sensitivity: number

  constructor(sensitivity = 1.5, windowSize = 43) {
    this.sensitivity = sensitivity
    this.windowSize = windowSize
  }

  /**
   * Pass the current frequency data array on every animation frame.
   * Returns true if a beat onset is detected on this frame.
   */
  detect(frequencyData: Uint8Array): boolean {
    // Focus on bass frequencies: bins 0–10 in a 128-bin FFT
    // These correspond roughly to 0–1700 Hz depending on sample rate
    const bassSlice = frequencyData.slice(0, 10)
    const bassEnergy = bassSlice.reduce((sum, v) => sum + v, 0) / bassSlice.length

    this.history.push(bassEnergy)
    if (this.history.length > this.windowSize) {
      this.history.shift()
    }

    // Need at least half a window before making a decision
    if (this.history.length < this.windowSize / 2) return false

    const average =
      this.history.reduce((a, b) => a + b, 0) / this.history.length

    const variance =
      this.history.reduce((sum, v) => sum + Math.pow(v - average, 2), 0) /
      this.history.length

    // Dynamic threshold: raises the bar when the signal is already energetic
    const C = this.sensitivity + variance / 10000

    return bassEnergy > C * average && bassEnergy > 10 // ignore near-silence
  }

  reset(): void {
    this.history = []
  }
}