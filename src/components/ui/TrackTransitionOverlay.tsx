import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePlayerStore } from '@/stores/playerStore'
import type { AlbumColour } from '@/hooks/useAlbumColour'

export function TrackTransitionOverlay({ accent }: { accent: AlbumColour }) {
  const { currentTrack, isTransitioning } = usePlayerStore()

  return (
    <AnimatePresence>
      {isTransitioning && currentTrack && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={styles.overlay}
        >
          <motion.div
            layoutId={`album-${currentTrack.id}`}
            style={styles.artWrap}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <img
              src={currentTrack.album.cover_big}
              alt=""
              style={styles.art}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            style={styles.info}
          >
            <h1 style={{ ...styles.title, color: accent.hex }}>{currentTrack.title}</h1>
            <p style={styles.artist}>{currentTrack.artist.name}</p>
          </motion.div>

          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1.8, ease: "linear" }}
            style={{ ...styles.progress, background: accent.hex }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 2000,
    backgroundColor: 'rgba(0,0,0,0.9)',
    backdropFilter: 'blur(40px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  artWrap: {
    width: '40vh',
    height: '40vh',
    marginBottom: '2rem',
    boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  art: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  info: {
    textAlign: 'center',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 700,
    marginBottom: '0.5rem',
    letterSpacing: '-0.02em',
  },
  artist: {
    fontSize: '1.2rem',
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    fontFamily: 'monospace',
  },
  progress: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    transformOrigin: 'left',
  }
}
