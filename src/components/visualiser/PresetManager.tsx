import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useVisualiserStore } from '@/stores/visualiserStore'

interface PresetManagerProps {
  accentColor: string
}

export function PresetManager({ accentColor }: PresetManagerProps) {
  const presets = useVisualiserStore(s => s.presets)
  const savePreset = useVisualiserStore(s => s.savePreset)
  const loadPreset = useVisualiserStore(s => s.loadPreset)
  const deletePreset = useVisualiserStore(s => s.deletePreset)
  const [nameInput, setNameInput] = useState('')

  const handleSave = () => {
    const name = nameInput.trim() || `Scene ${presets.length + 1}`
    savePreset(name)
    setNameInput('')
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <span style={styles.label}>Presets</span>
      </div>

      <div style={styles.saveRow}>
        <input
          style={styles.input}
          type="text"
          placeholder="Scene name…"
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSave()
          }}
          maxLength={24}
        />
        <button
          onClick={handleSave}
          style={{ ...styles.saveBtn, borderColor: accentColor, color: accentColor }}
        >
          Save
        </button>
      </div>

      <AnimatePresence initial={false}>
        {presets.length === 0 ? (
          <div style={styles.empty}>No presets saved</div>
        ) : (
          presets.map(preset => (
            <motion.div
              key={preset.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              style={styles.presetRow}
            >
              <button style={styles.presetName} onClick={() => loadPreset(preset.id)}>
                {preset.name}
              </button>
              <button
                style={styles.deleteBtn}
                onClick={() => deletePreset(preset.id)}
                aria-label={`Delete preset ${preset.name}`}
              >
                ✕
              </button>
            </motion.div>
          ))
        )}
      </AnimatePresence>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  label: {
    fontSize: '0.6rem',
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    fontWeight: 700,
    opacity: 0.45,
  },
  saveRow: { display: 'flex', gap: '0.5rem' },
  input: {
    flex: 1,
    fontSize: '0.7rem',
    padding: '0.3rem 0.5rem',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border-color)',
    borderRadius: '2px',
    color: 'inherit',
    fontFamily: 'inherit',
    outline: 'none',
  },
  saveBtn: {
    fontSize: '0.6rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    padding: '0.3rem 0.75rem',
    border: '1px solid',
    borderRadius: '2px',
    background: 'transparent',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: 700,
  },
  presetRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  presetName: {
    flex: 1,
    textAlign: 'left',
    fontSize: '0.7rem',
    padding: '0.35rem 0.5rem',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border-color)',
    borderRadius: '2px',
    cursor: 'pointer',
    color: 'inherit',
    fontFamily: 'inherit',
    transition: 'background-color 0.15s ease',
  },
  deleteBtn: {
    fontSize: '0.6rem',
    padding: '0.35rem 0.5rem',
    marginLeft: '0.25rem',
    background: 'transparent',
    border: '1px solid var(--border-color)',
    borderRadius: '2px',
    cursor: 'pointer',
    color: 'inherit',
    opacity: 0.45,
    fontFamily: 'inherit',
  },
  empty: {
    fontSize: '0.6rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    opacity: 0.3,
    textAlign: 'center',
    padding: '0.75rem 0',
  },
}
