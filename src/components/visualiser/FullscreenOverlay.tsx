import React from 'react'
import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { motion, AnimatePresence } from 'framer-motion'
import { useVisualiserStore } from '@/stores/visualiserStore'
import { FluidBackground } from './FluidBackground'
import { WaveformTunnel } from './WaveformTunnel'
import { RadialVisualiser } from './RadialVisualiser'
import type { AlbumColour } from '@/hooks/useAlbumColour'

interface FullscreenOverlayProps {
  accent: AlbumColour
  isPlaying: boolean
}

export function FullscreenOverlay({ accent }: FullscreenOverlayProps) {
  const { isFullscreen, visualLayer, toggleFullscreen, isLowQuality } = useVisualiserStore()

  if (!isFullscreen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={styles.overlay}
      >
        <div style={styles.canvasWrap}>
          <Canvas camera={{ position: [0, 0, 5] }}>
            <color attach="background" args={[accent.palette.background]} />
            <FluidBackground accent={accent} />

            {visualLayer === 'Energy' && <WaveformTunnel accent={accent} />}

            {!isLowQuality && (
              <EffectComposer>
                <Bloom luminanceThreshold={0.1} intensity={1.5} />
              </EffectComposer>
            )}
          </Canvas>
        </div>

        <div style={styles.uiLayer}>
          {(visualLayer === 'Energy' || visualLayer === 'Minimal') && (
            <div style={styles.radialWrap}>
              <RadialVisualiser width={400} height={400} accent={accent} />
            </div>
          )}

          <div style={styles.controls}>
            <button
              onClick={toggleFullscreen}
              style={{ ...styles.button, borderColor: accent.hex, color: accent.hex }}
            >
              Exit Fullscreen (F)
            </button>
            <div style={styles.info}>
              <span style={styles.layerLabel}>Layer: {visualLayer} (V)</span>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    backgroundColor: '#000',
    display: 'flex',
    flexDirection: 'column',
  },
  canvasWrap: {
    position: 'absolute',
    inset: 0,
    zIndex: 1,
  },
  uiLayer: {
    position: 'relative',
    zIndex: 2,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  radialWrap: {
    opacity: 0.8,
  },
  controls: {
    position: 'absolute',
    bottom: '2rem',
    left: '2rem',
    right: '2rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    pointerEvents: 'auto',
  },
  button: {
    background: 'rgba(0,0,0,0.4)',
    border: '1px solid',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontFamily: 'monospace',
    backdropFilter: 'blur(10px)',
  },
  info: {
    fontSize: '0.8rem',
    opacity: 0.6,
    fontFamily: 'monospace',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  layerLabel: {
    background: 'rgba(0,0,0,0.4)',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    backdropFilter: 'blur(10px)',
  }
}
