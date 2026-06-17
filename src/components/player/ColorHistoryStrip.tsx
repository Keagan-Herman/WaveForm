import React from 'react'
import { motion } from 'framer-motion'
import { usePlayerStore } from '@/stores/playerStore'

export function ColorHistoryStrip() {
  const colorHistory = usePlayerStore(s => s.colorHistory)
  const queue = usePlayerStore(s => s.queue)
  const setTrack = usePlayerStore(s => s.setTrack)
  const play = usePlayerStore(s => s.play)

  if (colorHistory.length === 0) return null

  const handleSwatchClick = (trackId: string | number) => {
    const track = queue.find(t => t.id === trackId)
    if (track) {
      setTrack(track)
      play()
    }
  }

  return (
    <div style={styles.strip} role="list" aria-label="Color history">
      {colorHistory.map((entry, i) => (
        <motion.button
          key={`${entry.trackId}-${i}`}
          data-testid="color-swatch"
          role="listitem"
          whileHover={{ scaleY: 1.6, zIndex: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          onClick={() => handleSwatchClick(entry.trackId)}
          aria-label={`Replay ${entry.title}`}
          title={entry.title}
          style={{
            ...styles.swatch,
            backgroundColor: entry.hex,
          }}
        />
      ))}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  strip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '3px',
    display: 'flex',
    overflow: 'hidden',
  },
  swatch: {
    flex: 1,
    height: '100%',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    opacity: 0.7,
    transformOrigin: 'bottom',
    transition: 'opacity 0.15s ease',
  },
}
