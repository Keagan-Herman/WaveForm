import React from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { usePlayerStore } from '@/stores/playerStore'
import { useVisualiserStore } from '@/stores/visualiserStore'
import { useUIStore } from '@/stores/uiStore'
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser'
import { ArtistRipple } from '@/components/search/ArtistRipple'
import type { AlbumColour } from '@/hooks/useAlbumColour'
import { getTrackCover, getTrackArtist, getTrackAlbum, isDeezerTrack } from '@/types/track'
import { usePreloadImage } from '@/hooks/usePreloadImage'

interface NowPlayingProps {
  accent?: AlbumColour
}

function formatRank(rank: number): string {
  if (rank >= 800_000) return 'Viral'
  if (rank >= 500_000) return 'Popular'
  if (rank >= 200_000) return 'Rising'
  if (rank >= 50_000) return 'Known'
  return 'Niche'
}

function NowPlayingOscilloscope({ accent }: { accent: string }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const smoothedData = React.useRef<Float32Array | null>(null)

  const draw = React.useCallback(
    (data: Uint8Array) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)

      if (!smoothedData.current || smoothedData.current.length !== data.length) {
        smoothedData.current = new Float32Array(data.length)
      }

      for (let i = 0; i < data.length; i++) {
        smoothedData.current[i] += (data[i] - smoothedData.current[i]) * 0.35
      }

      ctx.beginPath()
      ctx.strokeStyle = accent
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.6

      const sliceWidth = w / data.length
      let x = 0

      for (let i = 0; i < data.length; i++) {
        const v = smoothedData.current[i] / 128.0
        const y = (v / 2) * h
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
        x += sliceWidth
      }

      ctx.stroke()
    },
    [accent]
  )

  const { start, stop } = useAudioAnalyser({ onWaveformData: draw })

  React.useEffect(() => {
    start()
    return () => stop()
  }, [start, stop])

  return (
    <div style={styles.miniScrutinizer}>
      <canvas ref={canvasRef} width={100} height={30} style={{ opacity: 0.8 }} />
    </div>
  )
}

function NowPlayingProgress({ accent }: { accent: string }) {
  const currentTime = usePlayerStore(s => s.currentTime)
  const duration = usePlayerStore(s => s.currentTrack?.duration ?? 0)
  const seekTo = usePlayerStore(s => s.seekTo)
  const progress = duration > 0 ? currentTime / duration : 0

  const durationStr = `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}`
  const elapsedStr = `${Math.floor(currentTime / 60)}:${String(Math.floor(currentTime % 60)).padStart(2, '0')}`

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1))
    seekTo(ratio * duration)
  }

  return (
    <div style={styles.scrubberWrap}>
      <div
        style={{ ...styles.scrubberTrack, cursor: duration > 0 ? 'pointer' : 'default' }}
        onClick={handleSeek}
        role="slider"
        aria-label="Playback position"
        aria-valuenow={Math.round(currentTime)}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
      >
        <div
          style={{
            ...styles.scrubberFill,
            width: `${progress * 100}%`,
            background: accent,
          }}
        />
      </div>
      <div style={styles.scrubberLabels}>
        <span style={styles.timeLabel}>{elapsedStr}</span>
        <span style={styles.timeLabel}>{durationStr}</span>
      </div>
    </div>
  )
}

export function NowPlaying({ accent: accentColour }: NowPlayingProps) {
  const currentTrack = usePlayerStore(state => state.currentTrack)
  const isPlaying = usePlayerStore(state => state.isPlaying)
  const queue = usePlayerStore(state => state.queue)
  const beat = useVisualiserStore(state => state.beat)
  const bpm = useVisualiserStore(state => state.bpm)
  const prefersReducedMotion = useReducedMotion()

  const accent = accentColour?.hex ?? '#7a8fa6'

  const currentIdx = currentTrack ? queue.findIndex(t => t.id === currentTrack.id) : -1
  const nextTrack = currentIdx >= 0 ? (queue[currentIdx + 1] ?? null) : null
  usePreloadImage(nextTrack ? getTrackCover(nextTrack) : null)

  if (!currentTrack) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyIcon}>■</div>
        <div style={styles.emptyText}>Standing by for signal.</div>
      </div>
    )
  }

  const releaseYear =
    isDeezerTrack(currentTrack) && currentTrack.album.release_date
      ? new Date(currentTrack.album.release_date).getFullYear()
      : null

  return (
    <motion.div
      key={currentTrack.id}
      initial={prefersReducedMotion ? false : { opacity: 0, x: 20, filter: 'blur(8px)' }}
      animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={styles.wrap}
    >
      {/* Identity: art + title block */}
      <div style={styles.identity}>
        <motion.div
          whileHover={{ scale: 1.02 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          style={{
            ...styles.artFrame,
            boxShadow: isPlaying ? `0 0 32px ${accent}2e` : 'none',
            transition: 'box-shadow 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <img src={getTrackCover(currentTrack)} alt="" style={styles.art} />
        </motion.div>

        <div style={styles.titleArea}>
          <div style={styles.trackTitle}>{currentTrack.title}</div>
          <ArtistRipple active={isPlaying} color={accent}>
            <motion.div
              whileHover={{ x: 4 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              style={{ ...styles.artistName, color: accent }}
              onClick={() => {
                if (isDeezerTrack(currentTrack)) {
                  useUIStore.getState().setSelectedArtistId(currentTrack.artist.id)
                }
              }}
            >
              {getTrackArtist(currentTrack)}
            </motion.div>
          </ArtistRipple>
          <div style={styles.albumTitle}>{getTrackAlbum(currentTrack)}</div>
        </div>
      </div>

      {/* Instrument readout */}
      <div style={styles.techReadout}>
        {/* STATUS — crossfades on play/pause */}
        <div style={styles.readoutItem}>
          <span style={styles.readoutLabel}>STATUS</span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={isPlaying ? 'active' : 'standby'}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              style={{ ...styles.readoutValue, color: beat ? '#fff' : accent }}
            >
              {isPlaying ? 'ACTIVE' : 'STANDBY'}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* TEMPO — micro-pulse on beat */}
        <motion.div
          animate={
            beat && !prefersReducedMotion
              ? { scale: [1, 1.02, 1], transition: { duration: 0.12, ease: 'easeOut' } }
              : { scale: 1 }
          }
          style={styles.readoutItem}
        >
          <span style={styles.readoutLabel}>TEMPO</span>
          <span
            style={{
              ...styles.readoutValue,
              color: beat ? '#fff' : 'inherit',
              transition: 'color 0.1s ease',
            }}
          >
            {isPlaying ? `${Math.round(bpm)} BPM` : '—'}
          </span>
        </motion.div>

        {releaseYear && (
          <div style={styles.readoutItem}>
            <span style={styles.readoutLabel}>YEAR</span>
            <span style={styles.readoutValue}>{releaseYear}</span>
          </div>
        )}

        {isDeezerTrack(currentTrack) && (
          <div style={styles.readoutItem}>
            <span style={styles.readoutLabel}>RANK</span>
            <span style={styles.readoutValue}>{formatRank(currentTrack.rank)}</span>
          </div>
        )}

        <div style={{ ...styles.readoutItem, marginTop: '0.5rem', alignItems: 'flex-end' }}>
          <span style={styles.readoutLabel}>SIGNAL</span>
          <NowPlayingOscilloscope accent={accent} />
        </div>
      </div>

      {/* Scrubber */}
      <div style={styles.scrubberContainer}>
        <NowPlayingProgress accent={accent} />
      </div>
    </motion.div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    padding: '2rem',
    height: '100%',
    gap: '1.5rem',
    position: 'relative',
  },
  identity: {
    display: 'flex',
    gap: '2rem',
    alignItems: 'flex-start',
  },
  artFrame: {
    width: 140,
    height: 140,
    border: '1px solid var(--border-color)',
    padding: '8px',
    backgroundColor: 'rgba(5, 5, 5, 0.4)',
    position: 'relative',
    flexShrink: 0,
  },
  art: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  titleArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  trackTitle: {
    fontSize: '1.5rem',
    fontWeight: 600,
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
    marginBottom: '0.5rem',
    color: 'var(--text-color)',
  },
  artistName: {
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'color 0.2s ease',
  },
  albumTitle: {
    fontSize: '0.8rem',
    opacity: 0.45,
    letterSpacing: '0.02em',
    marginTop: '0.25rem',
  },
  techReadout: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    borderTop: '1px solid var(--border-color)',
    padding: '1.25rem 0 0',
  },
  readoutItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  readoutLabel: {
    fontSize: '0.6rem',
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    opacity: 0.45,
    fontWeight: 700,
  },
  readoutValue: {
    fontSize: '0.65rem',
    fontFamily: 'var(--font-mono)',
    fontWeight: 500,
  },
  miniScrutinizer: {
    height: '30px',
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(0,0,0,0.2)',
    padding: '0 0.5rem',
    borderRadius: '2px',
  },
  scrubberContainer: {
    marginTop: 'auto',
  },
  scrubberWrap: {},
  scrubberTrack: {
    height: 2,
    background: 'rgba(255,255,255,0.05)',
    position: 'relative',
  },
  scrubberFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    transition: 'width 0.1s linear',
  },
  scrubberLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '0.5rem',
  },
  timeLabel: {
    fontSize: '0.55rem',
    fontFamily: 'var(--font-mono)',
    opacity: 0.45,
    letterSpacing: '0.1em',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '0.5rem',
    opacity: 0.4,
  },
  emptyIcon: {
    fontSize: '1.5rem',
  },
  emptyText: {
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
}
