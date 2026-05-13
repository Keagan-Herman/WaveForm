import { create } from 'zustand';
import { Track, LocalTrack, isLocalTrack } from '../types/track';

// ─── Object URL registry ─────────────────────────────────────────────────────
// Tracks all blob URLs that need revoking when local tracks are removed.
// Kept outside React state to avoid serialisation issues with Map.

interface UrlEntry {
  audioUrl: string;
  coverUrl?: string;
}

const urlRegistry = new Map<string, UrlEntry>();

function revokeEntry(id: string) {
  const entry = urlRegistry.get(id);
  if (!entry) return;
  URL.revokeObjectURL(entry.audioUrl);
  if (entry.coverUrl) URL.revokeObjectURL(entry.coverUrl);
  urlRegistry.delete(id);
}

// ─── Store types ──────────────────────────────────────────────────────────────

interface PlayerStore {
  currentTrack: Track | null;
  isPlaying: boolean;
  queue: Track[];
  currentTime: number;     // seconds — updated by PreviewPlayer on timeupdate
  localTrackCount: number; // derived: how many local tracks are in the queue
  isTransitioning: boolean;

  // Playback
  setTrack: (track: Track) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setCurrentTime: (time: number) => void;

  // Queue
  addToQueue: (track: Track) => void;
  clearQueue: () => void;
  nextTrack: () => void;
  prevTrack: () => void;

  // Local file management
  registerLocalTrack: (track: LocalTrack) => void;
  removeLocalTrack: (id: string) => void;
  clearLocalTracks: () => void;
  updateLocalTrackDuration: (id: string, duration: number) => void;
  playTrackByAlbumId: (albumId: number) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  queue: [],
  currentTime: 0,
  localTrackCount: 0,
  isTransitioning: false,

  // ── Playback ──

  setTrack: (track) =>
    set({ currentTrack: track, isPlaying: true, currentTime: 0 }),

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),

  setCurrentTime: (time) => set({ currentTime: time }),

  // ── Queue ──

  addToQueue: (track) =>
    set((s) => ({
      queue: [...s.queue, track],
      localTrackCount: s.localTrackCount + (isLocalTrack(track) ? 1 : 0),
    })),

  clearQueue: () => set({ queue: [], localTrackCount: 0 }),

  nextTrack: () => {
    const { queue, currentTrack } = get();
    if (!queue.length) return;
    const idx = currentTrack
      ? queue.findIndex((t) => t.id === currentTrack.id)
      : -1;
    const next = queue[(idx + 1) % queue.length];
    set({ currentTrack: next, isPlaying: true, currentTime: 0 });
  },

  prevTrack: () => {
    const { queue, currentTrack, currentTime } = get();
    // If more than 3 seconds in, just restart the current track
    if (currentTime > 3) {
      set({ currentTime: 0 });
      return;
    }
    if (!queue.length) return;
    const idx = currentTrack
      ? queue.findIndex((t) => t.id === currentTrack.id)
      : 0;
    const prev = queue[(idx - 1 + queue.length) % queue.length];
    set({ currentTrack: prev, isPlaying: true, currentTime: 0 });
  },

  // ── Local file management ──

  registerLocalTrack: (track) => {
    urlRegistry.set(track.id, {
      audioUrl: track.objectUrl,
      coverUrl: track.coverObjectUrl,
    });
  },

  removeLocalTrack: (id) => {
    revokeEntry(id);
    set((s) => {
      const newQueue = s.queue.filter((t) => t.id !== id);
      const removingCurrent = s.currentTrack?.id === id;
      return {
        queue: newQueue,
        localTrackCount: Math.max(0, s.localTrackCount - 1),
        currentTrack: removingCurrent ? (newQueue[0] ?? null) : s.currentTrack,
        isPlaying: removingCurrent
          ? newQueue.length > 0
          : s.isPlaying,
        currentTime: removingCurrent ? 0 : s.currentTime,
      };
    });
  },

  clearLocalTracks: () => {
    const { queue } = get();
    queue
      .filter(isLocalTrack)
      .forEach((t) => revokeEntry(t.id));

    set((s) => {
      const nonLocal = s.queue.filter((t) => !isLocalTrack(t));
      const currentIsLocal =
        s.currentTrack !== null && isLocalTrack(s.currentTrack);
      return {
        queue: nonLocal,
        localTrackCount: 0,
        currentTrack: currentIsLocal ? (nonLocal[0] ?? null) : s.currentTrack,
        isPlaying: currentIsLocal
          ? nonLocal.length > 0
          : s.isPlaying,
        currentTime: currentIsLocal ? 0 : s.currentTime,
      };
    });
  },

  playTrackByAlbumId: (albumId) => {
    const { queue } = get();
    const track = queue.find((t) => t.source === 'deezer' && t.album.id === albumId);
    if (track) {
      set({ currentTrack: track, isPlaying: true, currentTime: 0 });
    }
  },

  // Called by PreviewPlayer once the audio element fires loadedmetadata
  updateLocalTrackDuration: (id, duration) => {
    set((s) => ({
      queue: s.queue.map((t) =>
        t.id === id && isLocalTrack(t) ? { ...t, duration } : t
      ),
      currentTrack:
        s.currentTrack?.id === id && isLocalTrack(s.currentTrack)
          ? { ...s.currentTrack, duration }
          : s.currentTrack,
    }));
  },
}));