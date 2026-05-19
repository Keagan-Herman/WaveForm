import React, { useMemo, useCallback, useRef, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { Bloom, EffectComposer, ChromaticAberration, Vignette, Noise, DepthOfField, GodRays } from '@react-three/postprocessing'
import { Environment } from '@react-three/drei'
import { motion, AnimatePresence } from 'framer-motion'
import { useVisualiserStore } from '@/stores/visualiserStore'
import { useSceneManager } from '@/hooks/useSceneManager'
import { VisualSettings } from './VisualSettings'
import { CanvasRecorder } from '@/lib/CanvasRecorder'
import { FluidBackground } from './FluidBackground'
import { RadialVisualiser } from './RadialVisualiser'
import { AlbumMesh } from '../library/AlbumMesh'
import { ParticleField } from '../library/ParticleField'
import { AudioOrb } from './AudioOrb'
import { AudioTerrain } from './AudioTerrain'
import { ButterchurnVisualiser } from './ButterchurnVisualiser'
import { ButterchurnTexture } from './ButterchurnTexture'
import { usePlayerStore } from '@/stores/playerStore'
import type { AlbumColour } from '@/hooks/useAlbumColour'
import type { DeezerTrack } from '@/lib/deezerApi'
import { getTrackCover, getTrackArtist, isDeezerTrack } from '@/types/track'

interface FullscreenOverlayProps {
  accent: AlbumColour
  isPlaying: boolean
  tracks: DeezerTrack[]
}

function FullscreenScene({
  accent,
  tracks,
  butterchurnCanvas
}: {
  accent: AlbumColour;
  tracks: DeezerTrack[];
  butterchurnCanvas: HTMLCanvasElement | null
}) {
  const quality = useVisualiserStore(state => state.quality)
  const [orb, setOrb] = React.useState<THREE.Group | null>(null)

  // Layer Opacities
  const orbOpacity = useVisualiserStore(state => state.orbOpacity)
  const terrainOpacity = useVisualiserStore(state => state.terrainOpacity)
  const particlesOpacity = useVisualiserStore(state => state.particlesOpacity)
  const albumGravityOpacity = useVisualiserStore(state => state.albumGravityOpacity)
  const presetsOpacity = useVisualiserStore(state => state.presetsOpacity)

  // FX state
  const bloomEnabled = useVisualiserStore(state => state.bloomEnabled)
  const bloomIntensity = useVisualiserStore(state => state.bloomIntensity)
  const godRaysEnabled = useVisualiserStore(state => state.godRaysEnabled)
  const chromaticAberrationEnabled = useVisualiserStore(state => state.chromaticAberrationEnabled)
  const vignetteEnabled = useVisualiserStore(state => state.vignetteEnabled)
  const filmGrainEnabled = useVisualiserStore(state => state.filmGrainEnabled)
  const dofEnabled = useVisualiserStore(state => state.dofEnabled)

  const bassPower = useVisualiserStore(state => state.bassPower)

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

      <Environment preset="night" />

      {butterchurnCanvas && <ButterchurnTexture canvas={butterchurnCanvas} opacity={presetsOpacity} />}

      {particlesOpacity > 0 && <ParticleField color={accent.hex} />}

      {orbOpacity > 0 && <AudioOrb ref={setOrb} accent={accent} />}
      {terrainOpacity > 0 && <AudioTerrain accent={accent} />}

      {albumGravityOpacity > 0 &&
        albumLayout.map(album => <AlbumMesh key={album.albumId} {...album} />)}

      {quality !== 'Low' && (
        <EffectComposer multisampling={quality === 'Epic' ? 8 : 0}>
          {bloomEnabled ? (
            <Bloom
              luminanceThreshold={0.1}
              intensity={bloomIntensity * (1 + bassPower * 0.5)}
            />
          ) : <></>}
          {godRaysEnabled && orb ? (
            <GodRays
              sun={orb as unknown as THREE.Mesh}
              samples={quality === 'Epic' ? 60 : 20}
              density={0.96}
              decay={0.9}
              weight={0.3}
              exposure={0.6}
              clampMax={1.0}
            />
          ) : <></>}
          {chromaticAberrationEnabled ? (
            <ChromaticAberration
              offset={new THREE.Vector2(0.002 * bassPower, 0.002 * bassPower)}
              radialModulation={false}
              modulationOffset={0}
            />
          ) : <></>}
          {vignetteEnabled ? <Vignette eskil={false} offset={0.5} darkness={0.5} /> : <></>}
          {filmGrainEnabled ? <Noise opacity={0.05} /> : <></>}
          {dofEnabled ? (
            <DepthOfField
              focusDistance={0}
              focalLength={0.02}
              bokehScale={2}
              height={480}
            />
          ) : <></>}
        </EffectComposer>
      )}
    </>
  )
}

export function FullscreenOverlay({ accent, tracks }: FullscreenOverlayProps) {
  useSceneManager()
  const isFullscreen = useVisualiserStore(state => state.isFullscreen)
  const visualLayer = useVisualiserStore(state => state.visualLayer)
  const toggleFullscreen = useVisualiserStore(state => state.toggleFullscreen)
  const setVisualLayer = useVisualiserStore(state => state.setVisualLayer)
  const presetsOpacity = useVisualiserStore(state => state.presetsOpacity)
  const [butterchurnCanvas, setButterchurnCanvas] = React.useState<HTMLCanvasElement | null>(null)
  const setShowSettings = useVisualiserStore(state => state.setShowSettings)
  const isRecording = useVisualiserStore(state => state.isRecording)
  const setIsRecording = useVisualiserStore(state => state.setIsRecording)

  const currentTrack = usePlayerStore(state => state.currentTrack)

  const recorderRef = useRef<CanvasRecorder | null>(null)

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      recorderRef.current?.stop()
      setIsRecording(false)
    } else {
      // Specifically target the Three.js canvas which now contains all layers
      const canvas = document.querySelector('canvas[data-engine="three.js r170"]') || document.querySelector('canvas')
      if (canvas instanceof HTMLCanvasElement) {
        recorderRef.current = new CanvasRecorder(canvas)
        recorderRef.current.start()
        setIsRecording(true)
      }
    }
  }, [isRecording, setIsRecording])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFullscreen) return
      if (e.key.toLowerCase() === 's') setShowSettings(!useVisualiserStore.getState().showSettings)
      if (e.key.toLowerCase() === 'r') toggleRecording()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFullscreen, setShowSettings, toggleRecording])

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
            <div
              style={{
                position: 'absolute',
                inset: 0,
                visibility: 'hidden',
                pointerEvents: 'none',
              }}
            >
              <ButterchurnVisualiser
                onFailure={() => setVisualLayer('Minimal')}
                onCanvasReady={setButterchurnCanvas}
                opacity={presetsOpacity}
              />
            </div>

            <div style={{ position: 'absolute', inset: 0 }}>
              <Canvas camera={{ position: [0, 0, 8], fov: 60 }} gl={{ preserveDrawingBuffer: true }}>
                <FullscreenScene
                  accent={accent}
                  tracks={tracks}
                  butterchurnCanvas={butterchurnCanvas}
                />
              </Canvas>
            </div>
          </div>

          <div style={styles.uiLayer}>
            <VisualSettings />

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
                <div style={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}>
                  <img src={getTrackCover(currentTrack)} style={styles.nowPlayingArt} alt="" />
                  {isDeezerTrack(currentTrack) && currentTrack.explicit_lyrics && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        width: 12,
                        height: 12,
                        borderRadius: 2,
                        border: '1px solid',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        background: 'rgba(0,0,0,0.6)',
                        color: accent.hex,
                        borderColor: `${accent.hex}66`,
                        zIndex: 1,
                      }}
                      aria-label="Explicit content"
                      title="Explicit content"
                    >
                      E
                    </div>
                  )}
                </div>
                <div style={styles.nowPlayingInfo}>
                  <div style={styles.nowPlayingTitle}>{currentTrack.title}</div>
                  <div style={{ ...styles.nowPlayingArtist, color: accent.hex }}>
                    {getTrackArtist(currentTrack)}
                  </div>
                </div>
              </motion.div>
            )}

            <div style={styles.controls}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  onClick={toggleFullscreen}
                  style={{ ...styles.button, borderColor: accent.hex, color: accent.hex }}
                >
                  Exit Fullscreen (F)
                </button>
                <button
                  onClick={() => setShowSettings(!useVisualiserStore.getState().showSettings)}
                  style={{ ...styles.button, borderColor: accent.hex, color: accent.hex }}
                >
                  Settings (S)
                </button>
                <button
                  onClick={toggleRecording}
                  style={{
                    ...styles.button,
                    borderColor: isRecording ? '#ff4444' : accent.hex,
                    color: isRecording ? '#ff4444' : accent.hex
                  }}
                >
                  {isRecording ? 'Stop Recording (R)' : 'Record (R)'}
                </button>
              </div>
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
