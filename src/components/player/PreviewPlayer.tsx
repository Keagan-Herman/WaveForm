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

  // Initialise the AudioEngine on the first play interaction.
  // Must happen inside a user gesture — this is triggered by the play
  // button click which sets isPlaying = true in the store.
  const ensureEngineInitialised = useCallback(async () => {
    if (engineInitialised.current) return
    if (!audioRef.current) return

    audioEngine.init(audioRef.current)
    await audioEngine.resume()
    engineInitialised.current = true
  }, [])

  // React to track changes — load the new preview URL
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack?.preview_url) return

    audio.src = currentTrack.preview_url
    audio.load()

    // If we were already playing, auto-play the new track
    if (isPlaying) {
      ensureEngineInitialised().then(() => {
        audio.play().catch(err => {
          console.warn('Autoplay prevented:', err)
          setIsPlaying(false)
        })
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id]) // Only re-run when the track ID changes

  // React to isPlaying changes — play or pause
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack?.preview_url) return

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
  }, [isPlaying]) // eslint-disable-line react-hooks/exhaustive-deps

  // Wire up audio element events
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onLoadStart = () => setIsLoading(true)
    const onCanPlay = () => {
      setIsLoading(false)
      setDuration(audio.duration || 30) // Spotify previews are always ~30s
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
      // If next exists, the track change useEffect above handles playback
    }
    const onError = (e: Event) => {
      console.error('Audio error:', e)
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

  return (
    <audio
      ref={audioRef}
      crossOrigin="anonymous"
      preload="none"
      style={{ display: 'none' }}
    />
  )
}