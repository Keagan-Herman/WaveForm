import { useEffect, useState, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { getArtist, getArtistTopTracks, type DeezerArtist, type DeezerTrack } from '@/lib/deezerApi'
import { TrackRow } from '@/components/library/TrackRow'
import { usePlayerStore } from '@/stores/playerStore'

interface ArtistPanelProps {
  artistId: number
  accentColour: string
  onClose: () => void
}

export function ArtistPanel({ artistId, accentColour, onClose }: ArtistPanelProps) {
  const [artist, setArtist] = useState<DeezerArtist | null>(null)
  const [tracks, setTracks] = useState<DeezerTrack[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { setTrack, setIsPlaying, setQueue, currentTrack } = usePlayerStore()

  useEffect(() => {
    let mounted = true
    setIsLoading(true)

    async function loadData() {
      try {
        const [artistData, topTracks] = await Promise.all([
          getArtist(artistId),
          getArtistTopTracks(artistId, 10),
        ])

        if (mounted) {
          setArtist(artistData)
          setTracks(topTracks)
          setIsLoading(false)
        }
      } catch (err) {
        console.error('Failed to load artist data', err)
        if (mounted) setIsLoading(false)
      }
    }

    loadData()
    return () => { mounted = false }
  }, [artistId])

  const handleSelectTrack = (track: DeezerTrack, index: number) => {
    setQueue(tracks, index)
    setTrack(track)
    setIsPlaying(true)
  }

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      style={styles.panel}
    >
      {/* Background Blur */}
      {artist && (
        <div
          style={{
            ...styles.bgImage,
            backgroundImage: `url(${artist.picture_big})`,
          }}
        />
      )}
      <div style={styles.overlay} />

      <div style={styles.content}>
        <header style={styles.header}>
          <button onClick={onClose} style={{ ...styles.closeBtn, color: accentColour }}>
            ✕ Close
          </button>
        </header>

        {isLoading ? (
          <div style={styles.loading}>Loading Artist...</div>
        ) : artist ? (
          <div style={styles.scrollArea}>
            <div style={styles.hero}>
              <img src={artist.picture_medium} alt={artist.name} style={styles.heroArt} />
              <div>
                <h2 style={styles.artistName}>{artist.name}</h2>
                <p style={styles.fanCount}>
                  {artist.nb_fan?.toLocaleString()} fans · Verified Artist
                </p>
              </div>
            </div>

            <div style={styles.trackSection}>
              <h3 style={styles.sectionTitle}>Top Tracks</h3>
              <div style={styles.trackList}>
                {tracks.map((track, i) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    index={i}
                    isActive={currentTrack?.id === track.id}
                    onSelect={handleSelectTrack}
                    accentColour={accentColour}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={styles.error}>Artist not found</div>
        )}
      </div>
    </motion.div>
  )
}

const styles: Record<string, CSSProperties> = {
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '100%',
    height: '100%',
    zIndex: 100,
    background: '#0a0a0a',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  bgImage: {
    position: 'absolute',
    inset: 0,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    filter: 'blur(40px) brightness(0.25) saturate(1.5)',
    transform: 'scale(1.1)',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.8))',
    backdropFilter: 'blur(20px) saturate(1.8)',
  },
  content: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  header: {
    padding: '1rem',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  closeBtn: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '4px',
    padding: '0.4rem 0.8rem',
    fontSize: '0.65rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    cursor: 'pointer',
    fontFamily: 'monospace',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 1.5rem 2rem',
  },
  hero: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
    marginBottom: '2rem',
  },
  heroArt: {
    width: 120,
    height: 120,
    borderRadius: '50%',
    objectFit: 'cover',
    boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
    border: '2px solid rgba(255,255,255,0.1)',
  },
  artistName: {
    fontSize: '1.75rem',
    fontWeight: 700,
    marginBottom: '0.25rem',
    letterSpacing: '-0.02em',
  },
  fanCount: {
    fontSize: '0.75rem',
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  trackSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  sectionTitle: {
    fontSize: '0.65rem',
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    opacity: 0.4,
    marginBottom: '0.5rem',
  },
  trackList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  loading: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.8rem',
    opacity: 0.5,
    fontFamily: 'monospace',
    letterSpacing: '0.1em',
  },
  error: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5,
  },
}