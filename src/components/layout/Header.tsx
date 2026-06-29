import React from 'react'
import { motion, type Variants } from 'framer-motion'
import { useVisualiserStore, type VisualLayer } from '@/stores/visualiserStore'
import { useWindowWidth } from '@/hooks/useWindowWidth'
import type { AlbumColour } from '@/hooks/useAlbumColour'

const VISUAL_LAYERS: VisualLayer[] = ['Ambient', 'Energy', 'Minimal', 'Presets', 'Ember']

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
  const cycleVisualLayer = useVisualiserStore(state => state.cycleVisualLayer)
  const setVisualLayer = useVisualiserStore(state => state.setVisualLayer)
  const toggleShortcutsLegend = useVisualiserStore(state => state.toggleShortcutsLegend)

  const windowWidth = useWindowWidth()
  const isMobile = windowWidth < 900

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
          Waveform
        </motion.h1>
      </div>

      {/* 4-tab mode selector — desktop only */}
      {!isMobile && (
        <div style={styles.modeTabs} role="tablist" aria-label="Visual mode">
          {VISUAL_LAYERS.map(layer => (
            <button
              key={layer}
              role="tab"
              aria-selected={visualLayer === layer}
              onClick={() => setVisualLayer(layer)}
              style={{
                ...styles.modeTab,
                color: visualLayer === layer ? accent.hex : 'inherit',
                borderBottomColor: visualLayer === layer ? accent.hex : 'transparent',
                opacity: visualLayer === layer ? 1 : 0.45,
              }}
            >
              {layer}
            </button>
          ))}
        </div>
      )}

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
              {isMobile ? '✕ Filter' : 'Reset Filter'}
            </button>
          )}

          {/* Quality toggle: desktop only — accessible via FX settings panel on mobile */}
          {!isMobile && (
            <button
              onClick={() => setQuality(isLowQuality ? 'Medium' : 'Low')}
              style={{
                ...styles.functionalBtn,
                color: isLowQuality ? '#ff4444' : 'inherit',
              }}
            >
              {isLowQuality ? 'Low Quality' : 'High Quality'}
            </button>
          )}

          {/* Cycle visual mode — mobile only (desktop uses 4-tab selector above) */}
          {isMobile && (
            <button
              onClick={cycleVisualLayer}
              title="Cycle visual mode"
              style={{
                ...styles.functionalBtn,
                color: accent.hex,
                borderColor: `${accent.hex}40`,
                background: `${accent.hex}10`,
                minWidth: 0,
                padding: '0.35rem 0.6rem',
              }}
            >
              <span style={{ letterSpacing: '0.05em' }}>{visualLayer}</span>
              <span style={{ opacity: 0.5, marginLeft: '0.3rem', fontSize: '0.7rem' }}>↻</span>
            </button>
          )}

          <button
            onClick={toggleShortcutsLegend}
            title="Keyboard shortcuts [?]"
            style={{
              ...styles.functionalBtn,
              padding: '0.35rem 0.6rem',
              minWidth: 0,
              opacity: 0.55,
            }}
          >
            ?
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
            {isMobile ? 'Enter' : `Enter ${visualLayer}`}
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
  right: {
    display: 'flex',
    alignItems: 'center',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  functionalBtn: {
    fontSize: '0.65rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    padding: '0.35rem 0.75rem',
    border: '1px solid var(--border-color)',
    borderRadius: '2px',
    backgroundColor: 'rgba(255,255,255,0.03)',
    transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease',
    whiteSpace: 'nowrap',
  },
  modeTabs: {
    display: 'flex',
    alignItems: 'stretch',
    height: '100%',
    gap: '0',
  },
  modeTab: {
    fontSize: '0.6rem',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    padding: '0 0.9rem',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'color 0.2s ease, opacity 0.2s ease, border-bottom-color 0.2s ease',
    whiteSpace: 'nowrap',
  },
}
