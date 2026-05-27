import React from 'react'
import { motion, type Variants } from 'framer-motion'
import { useVisualiserStore } from '@/stores/visualiserStore'
import type { AlbumColour } from '@/hooks/useAlbumColour'

interface HeaderProps {
  accent: AlbumColour
  hasIntroPlayed: boolean
  visualLayer: string
  filteredTrackIds: string[] | null
  onClearFilter: () => void
}

export function Header({
  accent,
  hasIntroPlayed,
  visualLayer,
  filteredTrackIds,
  onClearFilter,
}: HeaderProps) {
  const toggleFullscreen = useVisualiserStore(state => state.toggleFullscreen)
  const isLowQuality = useVisualiserStore(state => state.isLowQuality)
  const setQuality = useVisualiserStore(state => state.setQuality)

  const logoVariants: Variants = {
    hidden: { opacity: 0, letterSpacing: '0.1em' },
    visible: {
      opacity: 0.85,
      letterSpacing: '0.4em',
      transition: { duration: 1.5, ease: 'easeOut' },
    },
  }

  return (
    <header style={{ ...styles.header, borderBottomColor: `${accent.hex}28` }}>
      <motion.h1
        initial={hasIntroPlayed ? 'visible' : 'hidden'}
        animate="visible"
        variants={logoVariants}
        style={styles.logo}
      >
        Waveform
      </motion.h1>
      <div style={styles.headerMid}>
        <div
          style={{ ...styles.accentSwatch, background: accent.hex }}
          title={`Album colour: ${accent.hex}`}
        />
      </div>
      <div style={styles.headerSub}>
        <kbd style={{ ...styles.kbd, borderColor: `${accent.hex}44` }}>/</kbd> search ·{' '}
        <kbd style={{ ...styles.kbd, borderColor: `${accent.hex}44` }}>Space</kbd> play ·{' '}
        <kbd style={{ ...styles.kbd, borderColor: `${accent.hex}44` }}>←</kbd>{' '}
        <kbd style={{ ...styles.kbd, borderColor: `${accent.hex}44` }}>→</kbd> navigate ·{' '}
        <kbd style={{ ...styles.kbd, borderColor: `${accent.hex}44` }}>F</kbd> full ·{' '}
        <kbd style={{ ...styles.kbd, borderColor: `${accent.hex}44` }}>V</kbd> {visualLayer}
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={toggleFullscreen}
          style={{ ...styles.headerBtn, borderColor: `${accent.hex}44`, color: accent.hex }}
        >
          Fullscreen
        </motion.button>
        {filteredTrackIds && (
          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClearFilter}
            style={{
              ...styles.headerBtn,
              borderColor: `${accent.hex}aa`,
              background: `${accent.hex}22`,
              color: '#fff',
            }}
          >
            Clear Filter ✕
          </motion.button>
        )}
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setQuality(isLowQuality ? 'Medium' : 'Low')}
          style={{
            ...styles.headerBtn,
            borderColor: `${accent.hex}44`,
            color: isLowQuality ? '#ff4444' : accent.hex,
          }}
        >
          {isLowQuality ? 'HQ Off' : 'HQ On'}
        </motion.button>
      </div>
    </header>
  )
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    height: 46,
    padding: '0 1.75rem',
    borderBottom: '1px solid var(--border-color)',
    backdropFilter: 'blur(24px)',
    flexShrink: 0,
    zIndex: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    transition: 'border-color 1s ease',
  },
  logo: {
    fontSize: '0.9rem',
    letterSpacing: '0.4em',
    textTransform: 'uppercase',
    opacity: 0.85,
    fontWeight: 600,
    flexShrink: 0,
  },
  headerMid: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
  },
  accentSwatch: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    transition: 'background 1s ease',
    flexShrink: 0,
  },
  headerSub: {
    fontSize: '0.65rem',
    letterSpacing: '0.05em',
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    flexShrink: 0,
    color: 'var(--text-dim)',
  },
  headerBtn: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid',
    borderRadius: '4px',
    padding: '0.2rem 0.5rem',
    fontSize: '0.65rem',
    cursor: 'pointer',
    fontFamily: 'monospace',
    marginLeft: '0.5rem',
    textTransform: 'uppercase',
    transition: 'all 0.2s ease',
  },
  kbd: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '3px',
    padding: '0.08rem 0.3rem',
    fontSize: '0.65rem',
    fontFamily: 'monospace',
    transition: 'border-color 1s ease',
  },
}
