// ─── Deezer shape ────────────────────────────────────────────────────────────

export interface DeezerArtist {
  id: number;
  name: string;
  picture_medium?: string;
}

export interface DeezerAlbum {
  id: number;
  title: string;
  cover: string;
  cover_medium: string;
  cover_big?: string;
}

export interface DeezerTrack {
  source: 'deezer';
  id: number;
  title: string;
  artist: DeezerArtist;
  album: DeezerAlbum;
  preview: string;   // 30-second preview URL
  duration: number;  // seconds
  rank: number;
}

// ─── Local file shape ─────────────────────────────────────────────────────────

export interface LocalTrack {
  source: 'local';
  id: string;             // crypto.randomUUID()
  title: string;
  artist: { name: string };
  album: { title: string; cover: string }; // cover is a blob URL or ''
  preview: string;        // === objectUrl — PreviewPlayer uses this field for both types
  duration: number;       // seconds, populated after audio element loadedmetadata
  objectUrl: string;      // URL.createObjectURL(file) — revoke on removal
  coverObjectUrl?: string; // separate blob URL for embedded art — needs its own revoke
  waveform?: Float32Array; // 800-sample peak data from OfflineAudioContext
  fileName: string;       // original filename for fallback display
}

// ─── Union ────────────────────────────────────────────────────────────────────

export type Track = DeezerTrack | LocalTrack;

// ─── Type guards ──────────────────────────────────────────────────────────────

export function isLocalTrack(track: Track): track is LocalTrack {
  return track.source === 'local';
}

export function isDeezerTrack(track: Track): track is DeezerTrack {
  return track.source === 'deezer';
}

// ─── Unified accessors ───────────────────────────────────────────────────────
// Both track shapes expose these fields — use these helpers to avoid
// scattering source checks across the UI layer.

export function getTrackCover(track: Track): string {
  if (track.source === 'local') return track.album.cover;
  return track.album.cover_medium ?? track.album.cover;
}

export function getTrackArtist(track: Track): string {
  return track.artist.name;
}

export function getTrackAlbum(track: Track): string {
  return track.album.title;
}