/**
 * PreviewPlayer.tsx
 *
 * A hidden <audio> element that owns all playback concerns.
 * This is NOT a visible UI component — it has no rendered output.
 * Mount it once at the app root and forget about it.
 *
 * RESPONSIBILITIES:
 * - Owns the HTMLAudioElement ref
 * - Initialises AudioEngine on first user-triggered play
 * - Responds to playerStore state changes (track, isPlaying)
 * - Updates playerStore with progress and duration
 * - Handles track end → auto-advance to next in queue
 * - Starts/stops the rAF analyser loop with playback
 *
 * DESIGN DECISION:
 * The audio element is managed by ref, not state. Putting it in state
 * would cause unnecessary re-renders. All interaction is imperative.
 *
 * CROSSORIGIN:
 * The crossOrigin="anonymous" attribute is required for Web Audio API
 * to process audio from a different origin (Spotify's CDN). Without it,
 * the browser blocks the AudioContext from reading the stream.
 */

/**
 * PreviewPlayer.tsx — Deezer version
 *
 * One change from Spotify version:
 * - track.preview_url → track.preview (Deezer's field name)
 *
 * Everything else is identical — the audio engine wiring,
 * the rAF loop management, the event handlers.
 */

import { useRef, useEffect, useCallback } from 'react'
import { audioEngine } from '@/audio/AudioEngine'
import { usePlayerStore } from '@/stores/playerStore'
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser'

export function PreviewPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const engineInitialised = useRef(false)
  const { start: startAnalyser, stop: stopAnalyser } = useAudioAnalyser()

  const {
    currentTrack,
    isPlaying,
    setIsPlaying,
    setIsLoading,
    setProgress,
    setDuration,
    nextTrack,
  } = usePlayerStore()

  const ensureEngineInitialised = useCallback(async () => {
    if (engineInitialised.current) return
    if (!audioRef.current) return
    audioEngine.init(audioRef.current)
    await audioEngine.resume()
    engineInitialised.current = true
  }, [])

  // React to track changes
  useEffect(() => {
    const audio = audioRef.current
    // Deezer uses `preview` not `preview_url`
    if (!audio || !currentTrack?.preview) return

    audio.src = currentTrack.preview
    audio.load()

    if (isPlaying) {
      ensureEngineInitialised().then(() => {
        audio.play().catch(err => {
          console.warn('Autoplay prevented:', err)
          setIsPlaying(false)
        })
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id])

  // React to play/pause
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack?.preview) return

    if (isPlaying) {
      ensureEngineInitialised().then(async () => {
        try {
          await audio.play()
          startAnalyser()
        } catch (err) {
          console.warn('Play failed:', err)
          setIsPlaying(false)
        }
      })
    } else {
      audio.pause()
      stopAnalyser()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying])

  // Audio element events
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onLoadStart = () => setIsLoading(true)
    const onCanPlay = () => {
      setIsLoading(false)
      setDuration(audio.duration || 30)
    }
    const onTimeUpdate = () => {
      const dur = audio.duration || 30
      setProgress(audio.currentTime / dur)
    }
    const onEnded = () => {
      stopAnalyser()
      const next = nextTrack()
      if (!next) {
        setIsPlaying(false)
        setProgress(0)
      }
    }
    const onError = () => {
      setIsLoading(false)
      setIsPlaying(false)
    }

    audio.addEventListener('loadstart', onLoadStart)
    audio.addEventListener('canplay', onCanPlay)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)

    return () => {
      audio.removeEventListener('loadstart', onLoadStart)
      audio.removeEventListener('canplay', onCanPlay)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
    }
  }, [setIsLoading, setDuration, setProgress, setIsPlaying, nextTrack, stopAnalyser])

  return <audio ref={audioRef} crossOrigin="anonymous" preload="none" style={{ display: 'none' }} />
}
