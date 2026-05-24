import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useVisualiserStore, type QualityLevel } from '@/stores/visualiserStore'

export function VisualSettings() {
  const showSettings = useVisualiserStore(state => state.showSettings)
  const setShowSettings = useVisualiserStore(state => state.setShowSettings)

  const {
    quality, setQuality,
    autoCycle, setAutoCycle,
    bloomEnabled, setFxEnabled,
    godRaysEnabled,
    chromaticAberrationEnabled,
    vignetteEnabled,
    filmGrainEnabled,
    dofEnabled,
    bloomIntensity, setBloomIntensity
  } = useVisualiserStore()

  if (!showSettings) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        style={styles.panel}
      >
        <div style={styles.header}>
          <h3>Visual Settings</h3>
          <button onClick={() => setShowSettings(false)} style={styles.closeBtn}>×</button>
        </div>

        <div style={styles.section}>
          <label>Quality</label>
          <div style={styles.buttonGroup}>
            {(['Low', 'Medium', 'Epic'] as QualityLevel[]).map(q => (
              <button
                key={q}
                onClick={() => setQuality(q)}
                style={{
                  ...styles.toggleBtn,
                  background: quality === q ? 'rgba(255,255,255,0.2)' : 'transparent',
                  borderColor: quality === q ? '#fff' : 'rgba(255,255,255,0.2)',
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.section}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={autoCycle}
              onChange={e => setAutoCycle(e.target.checked)}
            />
            Auto-Cycle Scenes (30s)
          </label>
        </div>

        <div style={styles.divider} />

        <div style={styles.section}>
          <label style={styles.label}>Effects</label>
          <div style={styles.fxGrid}>
            {[
              { id: 'bloom', label: 'Bloom', val: bloomEnabled },
              { id: 'godRays', label: 'God Rays', val: godRaysEnabled },
              { id: 'chromaticAberration', label: 'Chroma', val: chromaticAberrationEnabled },
              { id: 'vignette', label: 'Vignette', val: vignetteEnabled },
              { id: 'filmGrain', label: 'Grain', val: filmGrainEnabled },
              { id: 'dof', label: 'DoF', val: dofEnabled },
            ].map(fx => (
              <div
                key={fx.id}
                style={styles.toggleRow}
                onClick={() => setFxEnabled(fx.id, !fx.val)}
              >
                <span style={styles.fxLabel}>{fx.label}</span>
                <div style={{ ...styles.toggleTrack, background: fx.val ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)' }}>
                  <motion.div
                    animate={{ x: fx.val ? 16 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    style={{ ...styles.toggleThumb, background: fx.val ? '#fff' : 'rgba(255,255,255,0.3)' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {bloomEnabled && (
          <div style={styles.section}>
            <div style={styles.rangeHeader}>
              <label style={styles.label}>Bloom Intensity</label>
              <span style={styles.rangeValue}>{bloomIntensity.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              value={bloomIntensity}
              onChange={e => setBloomIntensity(parseFloat(e.target.value))}
              style={styles.range}
            />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    position: 'absolute',
    right: '2rem',
    top: '2rem',
    width: '300px',
    background: 'rgba(5, 5, 5, 0.4)',
    backdropFilter: 'blur(50px) saturate(1.5)',
    WebkitBackdropFilter: 'blur(50px) saturate(1.5)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 30px 60px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.03)',
    borderRadius: '24px',
    padding: '1.75rem',
    zIndex: 100,
    color: '#fff',
    pointerEvents: 'auto',
    fontFamily: 'monospace',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: '1.5rem',
    cursor: 'pointer',
    padding: '0 0.5rem',
  },
  section: {
    marginBottom: '1.2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  buttonGroup: {
    display: 'flex',
    gap: '0.5rem',
  },
  toggleBtn: {
    flex: 1,
    padding: '0.5rem',
    fontSize: '0.65rem',
    borderRadius: '6px',
    border: '1px solid',
    color: '#fff',
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    fontWeight: 600,
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  checkboxLabel: {
    fontSize: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    cursor: 'pointer',
    opacity: 0.8,
    letterSpacing: '0.05em',
  },
  fxGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.5rem',
  },
  toggleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.6rem 0.75rem',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'background 0.2s ease',
  },
  fxLabel: {
    fontSize: '0.7rem',
    letterSpacing: '0.05em',
    opacity: 0.8,
  },
  toggleTrack: {
    width: 32,
    height: 16,
    borderRadius: '10px',
    padding: '2px',
    position: 'relative',
    transition: 'background 0.3s ease',
  },
  toggleThumb: {
    width: 12,
    height: 12,
    borderRadius: '50%',
  },
  divider: {
    height: '1px',
    background: 'rgba(255,255,255,0.08)',
    margin: '1.25rem 0',
  },
  label: {
    fontSize: '0.65rem',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    opacity: 0.4,
    marginBottom: '0.25rem',
  },
  rangeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rangeValue: {
    fontSize: '0.7rem',
    fontVariantNumeric: 'tabular-nums',
    opacity: 0.6,
  },
  range: {
    width: '100%',
    cursor: 'pointer',
    accentColor: '#fff',
    height: '4px',
    borderRadius: '2px',
    marginTop: '0.5rem',
  }
}
