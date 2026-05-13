import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import { audioEngine } from '../../audio/AudioEngine';

/**
 * PreviewPlayer — the hidden <audio> element that drives all playback.
 *
 * Responsibilities:
 * - Reflects playerStore.isPlaying into audio.play() / audio.pause()
 * - Fires setCurrentTime on timeupdate (used by WaveformLine scrubber)
 * - On loadedmetadata for local tracks, fires updateLocalTrackDuration
 * - Initialises AudioEngine on first user-gesture play
 *
 * Both Deezer and local tracks are played via track.preview, which is:
 *   - Deezer: a 30-second CDN preview URL
 *   - Local:  a blob: URL (URL.createObjectURL(file))
 */
export function PreviewPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const engineInitialised = useRef(false);

  const {
    currentTrack,
    isPlaying,
    setCurrentTime,
    pause,
    nextTrack,
    updateLocalTrackDuration,
  } = usePlayerStore();

  // ── Audio engine initialisation ──────────────────────────────────────────

  const ensureEngine = () => {
    if (!engineInitialised.current && audioRef.current) {
      audioEngine.init(audioRef.current);
      engineInitialised.current = true;
    }
    audioEngine.resume();
  };

  // ── Sync track source ────────────────────────────────────────────────────

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentTrack) {
      audio.src = '';
      return;
    }

    // .preview is the canonical audio URL for both Deezer and local tracks
    if (audio.src !== currentTrack.preview) {
      audio.src = currentTrack.preview;
      audio.load();
    }
  }, [currentTrack?.preview]);

  // ── Sync play/pause ──────────────────────────────────────────────────────

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (isPlaying) {
      ensureEngine();
      audio.play().catch(() => {
        // Autoplay blocked — flip store back to paused
        pause();
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, currentTrack?.preview]);

  // ── Event listeners ──────────────────────────────────────────────────────

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onLoadedMetadata = () => {
      // For local tracks whose duration was placeholder 0, update it now
      if (currentTrack?.source === 'local' && currentTrack.duration === 0) {
        updateLocalTrackDuration(currentTrack.id as string, audio.duration);
      }
    };

    const onEnded = () => {
      nextTrack();
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, [currentTrack?.id]);

  return (
    <audio
      id="preview-audio"
      ref={audioRef}
      preload="auto"
      crossOrigin="anonymous"   // Required for Web Audio API CORS
      style={{ display: 'none' }}
      aria-hidden="true"
    />
  );
}