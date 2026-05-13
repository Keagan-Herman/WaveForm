// ─── Core computation ─────────────────────────────────────────────────────────

const SAMPLE_COUNT = 800; // resolution: 800 peaks across the full duration

/**
 * Decode an audio File and extract a peak-normalised amplitude envelope.
 *
 * Uses a temporary AudioContext (not OfflineAudioContext — we only need
 * decoding, not rendering). The context is closed immediately after.
 *
 * Returns a Float32Array of SAMPLE_COUNT values in the range [0, 1].
 */
export async function computeWaveform(
  file: File,
  samples = SAMPLE_COUNT
): Promise<Float32Array> {
  const arrayBuffer = await file.arrayBuffer();

  // Temporary context for decoding only — closed in finally block
  const ctx = new AudioContext();

  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer);

    // Use left channel (index 0); mono files only have one channel
    const raw = decoded.getChannelData(0);
    const blockSize = Math.floor(raw.length / samples);
    const out = new Float32Array(samples);

    let globalMax = 0;

    for (let i = 0; i < samples; i++) {
      const start = i * blockSize;
      const end = Math.min(start + blockSize, raw.length);
      let peak = 0;

      for (let j = start; j < end; j++) {
        const abs = Math.abs(raw[j]);
        if (abs > peak) peak = abs;
      }

      out[i] = peak;
      if (peak > globalMax) globalMax = peak;
    }

    // Normalise to [0, 1] so quiet recordings still fill the canvas
    if (globalMax > 0) {
      for (let i = 0; i < samples; i++) {
        out[i] /= globalMax;
      }
    }

    return out;
  } finally {
    // Always close — leaving AudioContexts open leaks OS audio resources
    ctx.close();
  }
}