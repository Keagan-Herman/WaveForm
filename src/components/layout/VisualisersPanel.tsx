import React from 'react'
import { motion } from 'framer-motion'
import { Spectrogram } from '../visualiser/Spectrogram'
import { FrequencyBars } from '../visualiser/FrequencyBars'
import { usePlayerStore } from '@/stores/playerStore'
import type { AlbumColour } from '@/hooks/useAlbumColour'

interface VisualisersPanelProps {
  accent: AlbumColour
}

export function VisualisersPanel({ accent }: VisualisersPanelProps) {
  const isPlaying = usePlayerStore(state => state.isPlaying)

  return (
    <div style={{ ...styles.quadrant, overflowY: 'auto', ...styles.borderBottom }}>
      <div style={styles.quadLabel}>Visualisers</div>
      <div style={styles.visInner}>
        <div style={styles.canvasBlock}>
          <p style={styles.canvasLabel}>Spectrogram · hover for frequency</p>
          <Spectrogram width={680} height={160} accent={accent} />
        </div>

        <div style={styles.canvasBlock}>
          <p style={styles.canvasLabel}>Frequency Spectrum</p>
          <FrequencyBars width={680} height={160} mirrorMode accent={accent} />
        </div>

        {!isPlaying && (
          <div style={styles.idleOverlay}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              style={styles.idleContent}
            >
              <p style={styles.idleText}>Select a track to visualise</p>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  quadrant: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  },
  borderBottom: { borderBottom: '1px solid var(--border-color)' },
  quadLabel: {
    fontSize: '0.65rem',
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    opacity: 0.4,
    padding: '0.5rem 1rem 0.25rem',
    flexShrink: 0,
    fontFamily: 'monospace',
  },
  visInner: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    padding: '0.5rem 1.25rem 1.25rem',
    flex: 1,
    position: 'relative',
  },
  canvasBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.3rem',
    background: 'rgba(0,0,0,0.2)',
    padding: '0.75rem',
    borderRadius: '4px',
    border: '1px solid var(--border-color)',
  },
  canvasLabel: {
    fontSize: '0.6rem',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    opacity: 0.45,
    fontFamily: 'monospace',
  },
  idleOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(20px)',
    pointerEvents: 'none',
    zIndex: 5,
  },
  idleContent: {
    textAlign: 'center',
  },
  idleText: {
    opacity: 0.45,
    fontSize: '0.75rem',
    letterSpacing: '0.12em',
  },
}
