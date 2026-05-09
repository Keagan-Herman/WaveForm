declare module 'butterchurn' {
  interface VisualizerOptions {
    width: number
    height: number
    pixelRatio?: number
    textureSize?: number
    meshWidth?: number
    meshHeight?: number
  }

  interface Visualizer {
    connectAudio(audioNode: AnalyserNode): void
    loadPreset(preset: any, blendTime: number): void
    render(): void
    setRendererSize(width: number, height: number): void
  }

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
    getPresets(): { [key: string]: any }
  }
  export default presets
}
