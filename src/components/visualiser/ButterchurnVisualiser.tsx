import { useRef, useEffect } from 'react'
import butterchurn, { type Visualizer } from 'butterchurn'
import butterchurnPresets from 'butterchurn-presets'
import { audioEngine } from '@/audio/AudioEngine'
import { usePlayerStore } from '@/stores/playerStore'
import { useResize } from '@/hooks/useResize'

interface ButterchurnVisualiserProps {
  onFailure?: () => void
}

export function ButterchurnVisualiser({ onFailure }: ButterchurnVisualiserProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const visualizerRef = useRef<{
    visualizer: Visualizer
    presets: string[]
    allPresets: Record<string, unknown>
  } | null>(null)
  const hasInitialisedRef = useRef(false)
  const frameIdRef = useRef<number>()
  const { width, height } = useResize(containerRef)

  const currentPresetIndex = useRef(0)
  const isPlaying = usePlayerStore(state => state.isPlaying)

  // AudioEngine is null until a user gesture — wait for isPlaying to become
  // true before attempting initialisation. The ref prevents double-init.
  useEffect(() => {
    if (!isPlaying || hasInitialisedRef.current) return

    const audioContext = audioEngine.audioContext
    const canvas = canvasRef.current
    const analyser = audioEngine.analyserNode

    if (!audioContext || !canvas || !analyser) return

    hasInitialisedRef.current = true

    let visualizer: Visualizer
    try {
      // Handle ESM default import variations
      // @ts-expect-error - butterchurn types and ESM interop are messy
      const createVisualizer = butterchurn.default?.createVisualizer || butterchurn.createVisualizer

      if (typeof createVisualizer !== 'function') {
        throw new Error('butterchurn.createVisualizer is not a function')
      }

      visualizer = createVisualizer(audioContext, canvas, {
        width: canvas.width,
        height: canvas.height,
      })
    } catch (err) {
      console.error('Failed to initialize Butterchurn:', err)
      onFailure?.()
      return
    }

    visualizer.connectAudio(analyser)

    const presets = butterchurnPresets.getPresets()
    const keys = Object.keys(presets)
    const bestOfKeys = keys.filter(
      k =>
        k.toLowerCase().includes('flexi') ||
        k.toLowerCase().includes('milk') ||
        k.toLowerCase().includes('yin')
    )
    const finalKeys = bestOfKeys.length > 0 ? bestOfKeys : keys

    visualizer.loadPreset(presets[finalKeys[0]], 0)
    visualizerRef.current = { visualizer, presets: finalKeys, allPresets: presets }

    const render = () => {
      visualizer.render()
      frameIdRef.current = requestAnimationFrame(render)
    }
    render()

    return () => {
      if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current)
    }
  }, [isPlaying, onFailure])

  useEffect(() => {
    if (visualizerRef.current && width && height) {
      visualizerRef.current.visualizer.setRendererSize(width, height)
    }
  }, [width, height])

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
      <div
        style={{
          position: 'absolute',
          bottom: '1rem',
          left: '1rem',
          fontSize: '0.6rem',
          opacity: 0.3,
          fontFamily: 'monospace',
          pointerEvents: 'none',
        }}
      >
        Press 'P' to cycle presets
      </div>
    </div>
  )
}
