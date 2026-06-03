import React from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
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

  return (
    <AnimatePresence>
      {showSettings && (
        <motion.div
          initial={{ opacity: 0, x: 40, scale: 0.95, filter: 'blur(10px)' }}
          animate={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, x: 40, scale: 0.95, filter: 'blur(10px)' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={styles.panel}
        >
          <div style={styles.header}>
            <h3 style={styles.title}>Visual Settings</h3>
            <motion.button
              whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.1)' }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowSettings(false)}
              style={styles.closeBtn}
              aria-label="Close settings"
            >
              ×
            </motion.button>
          </div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
            }}
          >
            <motion.div variants={itemVariants} style={styles.section}>
              <label style={styles.label}>Quality Profile</label>
              <div style={styles.buttonGroup}>
                {(['Low', 'Medium', 'Epic'] as QualityLevel[]).map(q => (
                  <motion.button
                    key={q}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                    onClick={() => setQuality(q)}
                    style={{
                      ...styles.toggleBtn,
                      background: quality === q ? 'rgba(255,255,255,0.12)' : 'transparent',
                      borderColor: quality === q ? '#fff' : 'rgba(255,255,255,0.1)',
                      color: quality === q ? '#fff' : 'rgba(255,255,255,0.4)',
                    }}
                  >
                    {q}
                  </motion.button>
                ))}
              </div>
            </motion.div>

            <motion.div variants={itemVariants} style={styles.section}>
              <label style={styles.checkboxLabel}>
                <div style={styles.checkboxWrapper}>
                  <input
                    type="checkbox"
                    checked={autoCycle}
                    onChange={e => setAutoCycle(e.target.checked)}
                    style={styles.hiddenCheckbox}
                  />
                  <motion.div
                    animate={{
                      backgroundColor: autoCycle ? '#fff' : 'transparent',
                      borderColor: autoCycle ? '#fff' : 'rgba(255,255,255,0.2)',
                    }}
                    style={styles.checkbox}
                  >
                    {autoCycle && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        style={styles.checkmark}
                      />
                    )}
                  </motion.div>
                </div>
                <span style={{ opacity: autoCycle ? 1 : 0.6 }}>Auto-Cycle Scenes (30s)</span>
              </label>
            </motion.div>

            <motion.div variants={itemVariants} style={styles.divider} />

            <motion.div variants={itemVariants} style={styles.section}>
              <label style={styles.label}>Post-Processing</label>
              <div style={styles.fxGrid}>
                {[
                  { id: 'bloom', label: 'Bloom', val: bloomEnabled },
                  { id: 'godRays', label: 'God Rays', val: godRaysEnabled },
                  { id: 'chromaticAberration', label: 'Chroma', val: chromaticAberrationEnabled },
                  { id: 'vignette', label: 'Vignette', val: vignetteEnabled },
                  { id: 'filmGrain', label: 'Grain', val: filmGrainEnabled },
                  { id: 'dof', label: 'DoF', val: dofEnabled },
                ].map(fx => (
                  <motion.div
                    key={fx.id}
                    whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.06)', x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                    style={{
                      ...styles.toggleRow,
                      background: fx.val ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                      borderColor: fx.val ? 'rgba(255,255,255,0.1)' : 'transparent',
                    }}
                    onClick={() => setFxEnabled(fx.id as 'bloom' | 'godRays' | 'chromaticAberration' | 'vignette' | 'filmGrain' | 'dof', !fx.val)}
                  >
                    <span style={{ ...styles.fxLabel, opacity: fx.val ? 1 : 0.5 }}>{fx.label}</span>
                    <div
                      style={{
                        ...styles.toggleTrack,
                        background: fx.val ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                      }}
                    >
                      <motion.div
                        animate={{
                          x: fx.val ? 16 : 0,
                          backgroundColor: fx.val ? '#fff' : 'rgba(255,255,255,0.3)',
                        }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        style={styles.toggleThumb}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {bloomEnabled && (
              <motion.div
                variants={itemVariants}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={styles.section}
              >
                <div style={styles.rangeHeader}>
                  <label style={styles.label}>Bloom Intensity</label>
                  <span style={styles.rangeValue}>{bloomIntensity.toFixed(1)}</span>
                </div>
                <div style={styles.rangeWrapper}>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.1"
                    value={bloomIntensity}
                    onChange={e => setBloomIntensity(parseFloat(e.target.value))}
                    style={styles.range}
                  />
                  <motion.div
                    style={{
                      ...styles.rangeTrack,
                      width: `${(bloomIntensity / 5) * 100}%`,
                    }}
                  />
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    position: 'absolute',
    right: '2.5rem',
    top: '2.5rem',
    width: '320px',
    background: 'rgba(5, 5, 5, 0.4)',
    backdropFilter: 'blur(64px) saturate(2)',
    WebkitBackdropFilter: 'blur(64px) saturate(2)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 40px 80px rgba(0, 0, 0, 0.7), inset 0 0 0 1px rgba(255, 255, 255, 0.05)',
    borderRadius: '24px',
    padding: '2rem',
    zIndex: 100,
    color: '#fff',
    pointerEvents: 'auto',
    fontFamily: 'monospace',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
  },
  title: {
    fontSize: '1rem',
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    opacity: 0.9,
  },
  closeBtn: {
    background: 'rgba(255,255,255,0.05)',
    border: 'none',
    color: '#fff',
    fontSize: '1.2rem',
    cursor: 'pointer',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
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
    gap: '0.75rem',
  },
  toggleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 0.85rem',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    border: '1px solid rgba(255,255,255,0.05)',
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
  rangeWrapper: {
    position: 'relative',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
  },
  range: {
    width: '100%',
    cursor: 'pointer',
    WebkitAppearance: 'none',
    background: 'rgba(255,255,255,0.1)',
    height: '4px',
    borderRadius: '2px',
    zIndex: 2,
    position: 'relative',
    outline: 'none',
  },
  rangeTrack: {
    position: 'absolute',
    left: 0,
    height: '4px',
    background: '#fff',
    borderRadius: '2px',
    zIndex: 1,
    pointerEvents: 'none',
  },
  checkboxWrapper: {
    position: 'relative',
    width: '18px',
    height: '18px',
  },
  hiddenCheckbox: {
    position: 'absolute',
    opacity: 0,
    cursor: 'pointer',
    height: 0,
    width: 0,
  },
  checkbox: {
    width: '18px',
    height: '18px',
    borderRadius: '4px',
    border: '1px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  checkmark: {
    width: '6px',
    height: '6px',
    backgroundColor: '#000',
    borderRadius: '1px',
  },
}
