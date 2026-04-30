/**
 * NowPlaying.tsx
 *
 * The right-hand panel showing the current track's detail view.
 * Sits above the visualisers and collapses gracefully when nothing is playing.
 *
 * Contains:
 * - Album art (large)
 * - Track name + artist with ArtistRipple
 * - Popularity indicator
 * - A minimal waveform scrubber (visual only — Spotify previews
 *   don't expose seek on the preview URL)
 */

import { usePlayerStore } from '@/stores/playerStore'
import { useVisualiserStore } from '@/stores/visualiserStore'
import { getAlbumArt } from '@/lib/spotifyApi'
import { ArtistRipple } from '@/components/search/ArtistRipple'

export function NowPlaying() {
  const { currentTrack, isPlaying, progress } = usePlayerStore()
  const beat = useVisualiserStore(state => state.beat)

  if (!currentTrack) {
    return (
      <div style={styles.empty}>
        <p style={styles.emptyIcon}>◎</p>
        <p style={styles.emptyText}>Nothing playing</p>
      </div>
    )
  }

  const albumArt = getAlbumArt(currentTrack, 'large')
  const artists = currentTrack.artists.map(a => a.name).join(' · ')
  const popularity = currentTrack.popularity

  return (
    <div style={styles.wrap}>
      {/* Album art */}
      <div style={styles.artWrap}>
        <img
          src={albumArt}
          alt={currentTrack.album.name}
          style={{
            ...styles.art,
            transform:
              beat && isPlaying
                ? 'scale(1.02) rotate(0.3deg)'
                : 'scale(1) rotate(0deg)',
            transition: beat
              ? 'transform 0.08s ease-out'
              : 'transform 0.4s ease-out',
          }}
        />
        {isPlaying && <div style={styles.artGlow} />}
      </div>

      {/* Track info */}
      <div style={styles.info}>
        <p style={styles.albumName}>{currentTrack.album.name}</p>
        <p style={styles.trackName}>{currentTrack.name}</p>

        <ArtistRipple active={isPlaying}>
          <p style={styles.artistName}>{artists}</p>
        </ArtistRipple>

        {/* Popularity bar */}
        <div style={styles.popularityWrap}>
          <span style={styles.popularityLabel}>Popularity</span>
          <div style={styles.popularityTrack}>
            <div
              style={{
                ...styles.popularityFill,
                width: `${popularity}%`,
              }}
            />
          </div>
          <span style={styles.popularityValue}>{popularity}</span>
        </div>

        {/* Progress scrubber — visual only */}
        <div style={styles.scrubberWrap}>
          <div style={styles.scrubberTrack}>
            <div
              style={{
                ...styles.scrubberFill,
                width: `${progress * 100}%`,
                background: beat ? '#fff' : '#1db954',
                transition: beat ? 'background 0.05s' : 'background 0.3s, width 0.1s linear',
              }}
            />
            {/* Playhead */}
            <div
              style={{
                ...styles.playhead,
                left: `${progress * 100}%`,
                opacity: isPlaying ? 1 : 0,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '0.75rem',
    opacity: 0.15,
    fontFamily: 'monospace',
  },
  emptyIcon: {
    fontSize: '2.5rem',
  },
  emptyText: {
    fontSize: '0.75rem',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
  },
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    padding: '2rem',
    height: '100%',
    overflow: 'hidden',
  },
  artWrap: {
    position: 'relative',
    flexShrink: 0,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 280,
    aspectRatio: '1',
  },
  art: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '6px',
    display: 'block',
  },
  artGlow: {
    position: 'absolute',
    inset: -8,
    borderRadius: 12,
    background: 'radial-gradient(ellipse at center, rgba(29,185,84,0.15) 0%, transparent 70%)',
    pointerEvents: 'none',
    animation: 'pulse 2s ease-in-out infinite',
  },
  info: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    flex: 1,
    minWidth: 0,
    fontFamily: 'monospace',
  },
  albumName: {
    fontSize: '0.65rem',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    opacity: 0.3,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  trackName: {
    fontSize: '1.1rem',
    color: '#e8f5e8',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    letterSpacing: '-0.01em',
  },
  artistName: {
    fontSize: '0.8rem',
    color: '#1db954',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    padding: '0.2rem 0',
  },
  popularityWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    marginTop: '0.5rem',
  },
  popularityLabel: {
    fontSize: '0.6rem',
    opacity: 0.25,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    flexShrink: 0,
  },
  popularityTrack: {
    flex: 1,
    height: 2,
    background: 'rgba(255,255,255,0.08)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  popularityFill: {
    height: '100%',
    background: 'rgba(29,185,84,0.5)',
    borderRadius: 1,
  },
  popularityValue: {
    fontSize: '0.6rem',
    opacity: 0.25,
    flexShrink: 0,
    fontVariantNumeric: 'tabular-nums',
  },
  scrubberWrap: {
    marginTop: 'auto',
    paddingTop: '1rem',
  },
  scrubberTrack: {
    height: 3,
    background: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    position: 'relative',
    overflow: 'visible',
  },
  scrubberFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    borderRadius: 2,
  },
  playhead: {
    position: 'absolute',
    top: '50%',
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#fff',
    transform: 'translate(-50%, -50%)',
    transition: 'left 0.1s linear, opacity 0.2s',
    boxShadow: '0 0 6px rgba(255,255,255,0.5)',
  },
}