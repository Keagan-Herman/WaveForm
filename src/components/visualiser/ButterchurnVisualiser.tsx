import { useRef, useEffect } from 'react'
import butterchurn from 'butterchurn'
import butterchurnPresets from 'butterchurn-presets'
import { audioEngine } from '@/audio/AudioEngine'
import { useResize } from '@/hooks/useResize'

export function ButterchurnVisualiser() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const visualizerRef = useRef<any>(null)
  const { width, height } = useResize(containerRef)

  const currentPresetIndex = useRef(0)

  useEffect(() => {
    const audioContext = audioEngine.audioContext
    const canvas = canvasRef.current
    const analyser = audioEngine.analyserNode

    if (!audioContext || !canvas || !analyser) return

    const visualizer = butterchurn.createVisualizer(audioContext, canvas, {
      width: canvas.width,
      height: canvas.height,
    })

    visualizer.connectAudio(analyser)

    const presets = butterchurnPresets.getPresets()
    const keys = Object.keys(presets)
    // Pick a few "best of" presets as suggested
    const bestOfKeys = keys.filter(k =>
      k.toLowerCase().includes('flexi') ||
      k.toLowerCase().includes('milk') ||
      k.toLowerCase().includes('yin')
    )
    const finalKeys = bestOfKeys.length > 0 ? bestOfKeys : keys

    visualizer.loadPreset(presets[finalKeys[0]], 0)
    visualizerRef.current = { visualizer, presets: finalKeys, allPresets: presets }

    let frameId: number
    const render = () => {
      visualizer.render()
      frameId = requestAnimationFrame(render)
    }
    render()

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [])

  useEffect(() => {
    if (visualizerRef.current && width && height) {
      visualizerRef.current.visualizer.setRendererSize(width, height)
    }
  }, [width, height])

  // Cycle presets on P key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'p' && visualizerRef.current) {
        const { visualizer, presets, allPresets } = visualizerRef.current
        currentPresetIndex.current = (currentPresetIndex.current + 1) % presets.length
        visualizer.loadPreset(allPresets[presets[currentPresetIndex.current]], 2.0)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        width={width || 800}
        height={height || 600}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
      <div style={{
        position: 'absolute',
        bottom: '1rem',
        left: '1rem',
        fontSize: '0.6rem',
        opacity: 0.3,
        fontFamily: 'monospace',
        pointerEvents: 'none'
      }}>
        Press 'P' to cycle presets
      </div>
    </div>
  )
}
