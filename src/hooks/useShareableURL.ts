import { useCallback } from 'react'
import { usePlayerStore } from '@/stores/playerStore'
import { useVisualiserStore } from '@/stores/visualiserStore'
import type { VisualLayer, QualityLevel } from '@/stores/visualiserStore'

const VALID_QUALITIES: QualityLevel[] = ['Low', 'Medium', 'Epic']
const VALID_LAYERS: VisualLayer[] = ['Ambient', 'Energy', 'Minimal', 'Presets', 'Ember']

interface ShareParams {
  visualLayer: string
  quality: string
  trackId: number | string | null
}

interface DecodedShareParams {
  visualLayer: VisualLayer | null
  quality: QualityLevel | null
  trackId: number | null
}

// Pure functions — exported for unit testing
export function encodeShareParams(params: ShareParams): string {
  const p = new URLSearchParams()
  if (params.visualLayer) p.set('v', params.visualLayer)
  if (params.quality) p.set('q', params.quality)
  if (params.trackId !== null) p.set('t', String(params.trackId))
  return p.toString()
}

export function decodeShareParams(params: URLSearchParams): DecodedShareParams {
  const v = params.get('v')
  const q = params.get('q')
  const t = params.get('t')
  return {
    visualLayer: VALID_LAYERS.includes(v as VisualLayer) ? (v as VisualLayer) : null,
    quality: VALID_QUALITIES.includes(q as QualityLevel) ? (q as QualityLevel) : null,
    trackId: t !== null ? Number(t) : null,
  }
}

export function useShareableURL() {
  const buildShareURL = useCallback(() => {
    const { visualLayer, quality } = useVisualiserStore.getState()
    const { currentTrack } = usePlayerStore.getState()
    const qs = encodeShareParams({
      visualLayer,
      quality,
      trackId: currentTrack?.id ?? null,
    })
    return `${window.location.origin}${window.location.pathname}?${qs}`
  }, [])

  const restoreFromURL = useCallback(() => {
    const params = new URLSearchParams(window.location.search)
    const decoded = decodeShareParams(params)
    if (decoded.visualLayer) {
      useVisualiserStore.getState().setVisualLayer(decoded.visualLayer)
    }
    if (decoded.quality) {
      useVisualiserStore.getState().setQuality(decoded.quality)
    }
    if (decoded.trackId !== null) {
      const { queue, setTrack } = usePlayerStore.getState()
      const track = queue.find(t => t.id === decoded.trackId)
      if (track) setTrack(track)
    }
  }, [])

  return { buildShareURL, restoreFromURL }
}
