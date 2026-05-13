import React, { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { motion, AnimatePresence } from 'framer-motion'
import { useVisualiserStore } from '@/stores/visualiserStore'
import { FluidBackground } from './FluidBackground'
import { RadialVisualiser } from './RadialVisualiser'
import { AlbumMesh } from '../library/AlbumMesh'
import { ParticleField } from '../library/ParticleField'
import { AudioOrb } from './AudioOrb'
import { AudioTerrain } from './AudioTerrain'
import { ButterchurnVisualiser } from './ButterchurnVisualiser'
import { usePlayerStore } from '@/stores/playerStore'
import type { AlbumColour } from '@/hooks/useAlbumColour'
import type { DeezerTrack } from '@/lib/deezerApi'
import { getTrackCover, getTrackArtist } from '@/types/track'

interface FullscreenOverlayProps {
  accent: AlbumColour
  isPlaying: boolean
  tracks: DeezerTrack[]
}

function FullscreenScene({ accent, tracks }: { accent: AlbumColour; tracks: DeezerTrack[] }) {
  const visualLayer = useVisualiserStore(state => state.visualLayer)
  const isLowQuality = useVisualiserStore(state => state.isLowQuality)

  const albumLayout = useMemo(() => {
    const seen = new Set<number>()
    const unique = tracks.filter(t => {
      if (seen.has(t.album.id)) return false
      seen.add(t.album.id)
      return true
    })

    return unique.slice(0, 15).map((track, i) => {
      const r = (n: number) => {
        const x = Math.sin(i * 17 + n) * 10000
        return x - Math.floor(x)
      }
      return {
        imageUrl: track.album.cover_medium,
        albumId: String(track.album.id),
        position: [(r(0) - 0.5) * 15, (r(1) - 0.5) * 8, r(2) * -10 - 2] as [number, number, number],
        phaseOffset: r(3) * Math.PI * 2,
        rotationSpeed: 0.02 + r(4) * 0.06,
        floatSpeed: 0.2 + r(5) * 0.3,
        floatAmplitude: 0.2 + r(6) * 0.3,
        size: 1.2 + r(7) * 0.8,
      }
    })
  }, [tracks])

  return (
    <>
      <color attach="background" args={[accent.palette.background]} />
      <FluidBackground accent={accent} />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />

      <ParticleField color={accent.hex} />

      {visualLayer === 'Energy' && <AudioOrb accent={accent} />}
      {visualLayer === 'Ambient' && <AudioTerrain accent={accent} />}

      {visualLayer === 'Ambient' &&
        albumLayout.map(album => <AlbumMesh key={album.albumId} {...album} />)}

      {!isLowQuality && (
        <EffectComposer>
          <Bloom luminanceThreshold={0.1} intensity={1.5} />
        </EffectComposer>
      )}
    </>
  )
}

export function FullscreenOverlay({ accent, tracks }: FullscreenOverlayProps) {
  const isFullscreen = useVisualiserStore(state => state.isFullscreen)
  const visualLayer = useVisualiserStore(state => state.visualLayer)
  const toggleFullscreen = useVisualiserStore(state => state.toggleFullscreen)
  const setVisualLayer = useVisualiserStore(state => state.setVisualLayer)

  const currentTrack = usePlayerStore(state => state.currentTrack)

  // AnimatePresence must wrap the conditional — early return here would
  // prevent the exit animation from firing when isFullscreen goes false.
  return (
    <AnimatePresence mode="wait">
      {isFullscreen && (
        <motion.div
          key="fullscreen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={styles.overlay}
        >
          <div style={styles.canvasWrap}>
            {visualLayer === 'Presets' ? (
              <ButterchurnVisualiser onFailure={() => setVisualLayer('Minimal')} />
            ) : (
              <Canvas camera={{ position: [0, 0, 8], fov: 60 }}>
                <FullscreenScene accent={accent} tracks={tracks} />
              </Canvas>
            )}
          </div>

          <div style={styles.uiLayer}>
            <AnimatePresence mode="wait">
              <motion.div
                key={visualLayer}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                style={styles.layerIndicator}
              >
                Mode: {visualLayer}
              </motion.div>
            </AnimatePresence>

            {visualLayer === 'Minimal' && (
              <div style={styles.radialWrap}>
                <RadialVisualiser width={500} height={500} accent={accent} />
              </div>
            )}

            {currentTrack && (
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                style={styles.nowPlaying}
              >
                <img src={getTrackCover(currentTrack)} style={styles.nowPlayingArt} alt="" />
                <div style={styles.nowPlayingInfo}>
                  <div style={styles.nowPlayingTitle}>{currentTrack.title}</div>
                  <div style={{ ...styles.nowPlayingArtist, color: accent.hex }}>
                    {getTrackArtist(currentTrack)}
                  </div>
                </div>
              </motion.div>
            )}

            <div style={styles.controls}>
              <button
                onClick={toggleFullscreen}
                style={{ ...styles.button, borderColor: accent.hex, color: accent.hex }}
              >
                Exit Fullscreen (F)
              </button>
              <div style={styles.info}>
                <span style={styles.layerLabel}>Press 'V' to cycle layers</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
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
  layerIndicator: {
    position: 'absolute',
    top: '4rem',
    fontSize: '1.2rem',
    letterSpacing: '0.4em',
    textTransform: 'uppercase',
    color: '#fff',
    background: 'rgba(0,0,0,0.5)',
    padding: '0.5rem 2rem',
    borderRadius: '40px',
    backdropFilter: 'blur(10px)',
  },
  energyVisWrap: {
    position: 'absolute',
    bottom: '8rem',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    opacity: 0.6,
  },
  radialWrap: {
    opacity: 0.8,
  },
  nowPlaying: {
    position: 'absolute',
    top: '2rem',
    left: '2rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    background: 'rgba(0,0,0,0.4)',
    padding: '0.75rem',
    borderRadius: '8px',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  nowPlayingArt: {
    width: 48,
    height: 48,
    borderRadius: 4,
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
  },
  nowPlayingInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.1rem',
  },
  nowPlayingTitle: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#fff',
  },
  nowPlayingArtist: {
    fontSize: '0.75rem',
    fontFamily: 'monospace',
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
  },
}
