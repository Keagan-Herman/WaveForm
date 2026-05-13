import { LocalTrack } from '../types/track';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '');
}

function parseFilename(filename: string): { title: string; artist: string } {
  const name = stripExtension(filename);
  const dashIdx = name.indexOf(' - ');
  if (dashIdx !== -1) {
    return {
      artist: name.slice(0, dashIdx).trim(),
      title: name.slice(dashIdx + 3).trim(),
    };
  }
  return { title: name, artist: 'Unknown Artist' };
}

// ─── Metadata extraction ──────────────────────────────────────────────────────

interface RawMeta {
  title: string;
  artist: string;
  album: string;
  coverObjectUrl?: string;
}

async function extractTags(file: File): Promise<RawMeta> {
  // Dynamically imported — not needed on initial load
  const mm = await import('music-metadata-browser');
  const metadata = await mm.parseBlob(file, { skipCovers: false });
  const { title, artist, album, picture } = metadata.common;

  let coverObjectUrl: string | undefined;
  if (picture && picture.length > 0) {
    const pic = picture[0];
    // Cast pic.data as BlobPart to satisfy TypeScript
    const blob = new Blob([pic.data as unknown as BlobPart], { type: pic.format });
    coverObjectUrl = URL.createObjectURL(blob);
  }

  const fallback = parseFilename(file.name);

  return {
    title: title?.trim() || fallback.title,
    artist: artist?.trim() || fallback.artist,
    album: album?.trim() || 'Unknown Album',
    coverObjectUrl,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build a LocalTrack from a File object.
 *
 * - Attempts ID3/Vorbis tag extraction via music-metadata-browser
 * - Falls back to filename parsing ("Artist - Title.mp3") on failure
 * - duration is 0 until PreviewPlayer fires loadedmetadata
 * - waveform is undefined until computeWaveform() completes separately
 */
export async function buildLocalTrack(
  file: File
): Promise<Omit<LocalTrack, 'waveform' | 'duration'> & { duration: 0 }> {
  let meta: RawMeta;

  try {
    meta = await extractTags(file);
  } catch {
    // music-metadata-browser failed (unsupported format, malformed tags, etc.)
    const fallback = parseFilename(file.name);
    meta = { ...fallback, album: 'Unknown Album' };
  }

  const objectUrl = URL.createObjectURL(file);

  return {
    source: 'local' as const,
    id: crypto.randomUUID(),
    title: meta.title,
    artist: { name: meta.artist },
    album: {
      title: meta.album,
      cover: meta.coverObjectUrl ?? '',
    },
    preview: objectUrl,   // PreviewPlayer reads .preview for audio src
    duration: 0,          // populated later via updateLocalTrackDuration
    objectUrl,
    coverObjectUrl: meta.coverObjectUrl,
    fileName: file.name,
  };
}

/**
 * Accepted audio MIME types and extensions.
 * Used to validate dropped/selected files before processing.
 */
export const ACCEPTED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'audio/flac',
  'audio/wav',
  'audio/aac',
  'audio/webm',
  'audio/x-m4a',
];

export function isAudioFile(file: File): boolean {
  if (ACCEPTED_AUDIO_TYPES.includes(file.type)) return true;
  // Fallback: check extension for files with empty MIME type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ['mp3', 'mp4', 'ogg', 'flac', 'wav', 'aac', 'm4a', 'webm', 'opus'].includes(ext);
}