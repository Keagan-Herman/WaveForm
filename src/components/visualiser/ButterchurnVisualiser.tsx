import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import butterchurn, { type Visualizer } from 'butterchurn'
import butterchurnPresets from 'butterchurn-presets'
import { audioEngine } from '@/audio/AudioEngine'
import { usePlayerStore } from '@/stores/playerStore'
import { useResize } from '@/hooks/useResize'

export interface ButterchurnHandle {
  nextPreset: () => void
  prevPreset: () => void
}

interface ButterchurnVisualiserProps {
  onFailure?: () => void
  onCanvasReady?: (canvas: HTMLCanvasElement) => void
  onPresetChange?: (name: string) => void
  opacity?: number
}

export const ButterchurnVisualiser = forwardRef<ButterchurnHandle, ButterchurnVisualiserProps>(
  function ButterchurnVisualiser({ onFailure, onCanvasReady, onPresetChange, opacity = 1 }, ref) {
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

    const loadPresetAtIndex = (index: number, blendTime: number) => {
      if (!visualizerRef.current) return
      const { visualizer, presets, allPresets } = visualizerRef.current
      const name = presets[index]
      visualizer.loadPreset(allPresets[name], blendTime)
      onPresetChange?.(name)
    }

    useImperativeHandle(ref, () => ({
      nextPreset: () => {
        if (!visualizerRef.current) return
        currentPresetIndex.current =
          (currentPresetIndex.current + 1) % visualizerRef.current.presets.length
        loadPresetAtIndex(currentPresetIndex.current, 0)
      },
      prevPreset: () => {
        if (!visualizerRef.current) return
        currentPresetIndex.current =
          (currentPresetIndex.current - 1 + visualizerRef.current.presets.length) %
          visualizerRef.current.presets.length
        loadPresetAtIndex(currentPresetIndex.current, 0)
      },
    }))

    useEffect(() => {
      if (!isPlaying || hasInitialisedRef.current) return

      const audioContext = audioEngine.audioContext
      const canvas = canvasRef.current
      const analyser = audioEngine.analyserNode

      if (!audioContext || !canvas || !analyser) return

      hasInitialisedRef.current = true

      let visualizer: Visualizer
      try {
        const bcModule = butterchurn as typeof butterchurn & { default?: typeof butterchurn }
        const createVisualizer = bcModule.default?.createVisualizer ?? butterchurn.createVisualizer
        if (typeof createVisualizer !== 'function') throw new Error('butterchurn not found')
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
      const keys = Object.keys(presets).sort(() => Math.random() - 0.5)

      visualizerRef.current = { visualizer, presets: keys, allPresets: presets }
      loadPresetAtIndex(0, 0)

      const render = () => {
        if (opacity > 0) visualizer.render()
        frameIdRef.current = requestAnimationFrame(render)
      }
      render()

      if (onCanvasReady && canvas) onCanvasReady(canvas)

      return () => {
        if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPlaying])

    useEffect(() => {
      if (visualizerRef.current && width && height) {
        visualizerRef.current.visualizer.setRendererSize(width, height)
      }
    }, [width, height])

    useEffect(() => {
      const autoCycle = () => {
        if (!visualizerRef.current) return
        currentPresetIndex.current =
          (currentPresetIndex.current + 1) % visualizerRef.current.presets.length
        loadPresetAtIndex(currentPresetIndex.current, 5.7)
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key.toLowerCase() === 'p') autoCycle()
      }

      const interval = setInterval(autoCycle, 20000)
      window.addEventListener('keydown', handleKeyDown)
      return () => {
        window.removeEventListener('keydown', handleKeyDown)
        clearInterval(interval)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          width={width || 800}
          height={height || 600}
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
      </div>
    )
  }
)
