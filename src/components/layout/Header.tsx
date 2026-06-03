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
    hidden: { opacity: 0, x: -10 },
    visible: {
      opacity: 0.9,
      x: 0,
      transition: { duration: 1, ease: [0.16, 1, 0.3, 1] },
    },
  }

  return (
    <header style={{ ...styles.header }}>
      <div style={styles.left}>
        <motion.h1
          initial={hasIntroPlayed ? 'visible' : 'hidden'}
          animate="visible"
          variants={logoVariants}
          style={styles.logo}
        >
          Waveform <span style={{ ...styles.version, color: accent.hex }}>v2.0</span>
        </motion.h1>
      </div>

      <div style={styles.right}>
        <div style={styles.controls}>
           {filteredTrackIds && (
            <button
              onClick={onClearFilter}
              style={{
                ...styles.functionalBtn,
                background: `${accent.hex}15`,
                borderColor: `${accent.hex}30`,
                color: accent.hex,
              }}
            >
              Reset Filter
            </button>
          )}

          <button
            onClick={() => setQuality(isLowQuality ? 'Medium' : 'Low')}
            style={{
              ...styles.functionalBtn,
              color: isLowQuality ? '#ff4444' : 'inherit',
            }}
          >
            {isLowQuality ? 'Low Quality' : 'High Quality'}
          </button>

          <button
            onClick={toggleFullscreen}
            style={{
              ...styles.functionalBtn,
              background: accent.hex,
              color: '#000',
              fontWeight: 700,
            }}
          >
            Enter {visualLayer}
          </button>
        </div>
      </div>
    </header>
  )
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    height: 46,
    padding: '0 1.5rem',
    borderBottom: '1px solid var(--border-color)',
    background: 'rgba(0,0,0,0.2)',
    flexShrink: 0,
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
  },
  logo: {
    fontSize: '0.85rem',
    letterSpacing: '0.3em',
    textTransform: 'uppercase',
    fontWeight: 600,
    margin: 0,
  },
  version: {
    fontSize: '0.5rem',
    letterSpacing: '0.1em',
    verticalAlign: 'top',
    marginLeft: '0.5rem',
    opacity: 0.8,
  },
  right: {
    display: 'flex',
    alignItems: 'center',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  functionalBtn: {
    fontSize: '0.65rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    padding: '0.35rem 0.75rem',
    border: '1px solid var(--border-color)',
    borderRadius: '2px',
    backgroundColor: 'rgba(255,255,255,0.03)',
    transition: 'all 0.2s ease',
  },
}
