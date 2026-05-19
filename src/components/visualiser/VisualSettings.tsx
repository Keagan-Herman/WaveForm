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
          <label>Effects</label>
          <div style={styles.fxGrid}>
            {[
              { id: 'bloom', label: 'Bloom', val: bloomEnabled },
              { id: 'godRays', label: 'God Rays', val: godRaysEnabled },
              { id: 'chromaticAberration', label: 'Chromatic', val: chromaticAberrationEnabled },
              { id: 'vignette', label: 'Vignette', val: vignetteEnabled },
              { id: 'filmGrain', label: 'Film Grain', val: filmGrainEnabled },
              { id: 'dof', label: 'Depth of Field', val: dofEnabled },
            ].map(fx => (
              <label key={fx.id} style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={fx.val}
                  onChange={e => setFxEnabled(fx.id, e.target.checked)}
                />
                {fx.label}
              </label>
            ))}
          </div>
        </div>

        {bloomEnabled && (
          <div style={styles.section}>
            <label>Bloom Intensity: {bloomIntensity.toFixed(1)}</label>
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
    width: '280px',
    background: 'rgba(0,0,0,0.85)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    padding: '1.5rem',
    zIndex: 100,
    color: '#fff',
    pointerEvents: 'auto',
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
    padding: '0.4rem',
    fontSize: '0.7rem',
    borderRadius: '4px',
    border: '1px solid',
    color: '#fff',
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  checkboxLabel: {
    fontSize: '0.8rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    opacity: 0.8,
  },
  fxGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.8rem',
  },
  divider: {
    height: '1px',
    background: 'rgba(255,255,255,0.1)',
    margin: '1rem 0',
  },
  range: {
    width: '100%',
    cursor: 'pointer',
  }
}
