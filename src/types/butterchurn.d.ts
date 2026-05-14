declare module 'butterchurn' {
  export interface VisualizerOptions {
    width: number
    height: number
    pixelRatio?: number
    textureSize?: number
    meshWidth?: number
    meshHeight?: number
  }

  export interface Visualizer {
    connectAudio(audioNode: AnalyserNode): void
    loadPreset(preset: unknown, blendTime: number): void
    render(): void
    setRendererSize(width: number, height: number): void
  }

  export function createVisualizer(
    audioContext: AudioContext,
    canvas: HTMLCanvasElement,
    options: VisualizerOptions
  ): Visualizer

  const butterchurn: {
    createVisualizer(
      audioContext: AudioContext,
      canvas: HTMLCanvasElement,
      options: VisualizerOptions
    ): Visualizer
  }

  export default butterchurn
}

declare module 'butterchurn-presets' {
  const presets: {
    getPresets(): Record<string, unknown>
  }
  export default presets
}
