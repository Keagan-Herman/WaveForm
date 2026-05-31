import React, { useMemo, useCallback, useRef, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { Bloom, EffectComposer, ChromaticAberration, Vignette, Noise, DepthOfField, GodRays } from '@react-three/postprocessing'
import { Environment } from '@react-three/drei'
import { motion, AnimatePresence } from 'framer-motion'
import { useVisualiserStore } from '@/stores/visualiserStore'
import { useSceneManager } from '@/hooks/useSceneManager'
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser'
import { VisualSettings } from './VisualSettings'
import { CanvasRecorder } from '@/lib/CanvasRecorder'
import { FluidBackground } from './FluidBackground'
import { RadialVisualiser } from './RadialVisualiser'
import { AlbumMesh } from '../library/AlbumMesh'
import { ParticleField } from '../library/ParticleField'
import { AudioOrb } from './AudioOrb'
import { AudioTerrain } from './AudioTerrain'
import { SceneController } from './SceneController'
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
  const [orb, setOrb] = React.useState<THREE.Mesh | null>(null)

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
  const chromaOffset = useRef(new THREE.Vector2())

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
      <SceneController />
      <color attach="background" args={[accent.palette.background]} />
      <FluidBackground accent={accent} />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />

      <Environment preset="night" />

      {butterchurnCanvas && <ButterchurnTexture canvas={butterchurnCanvas} opacity={presetsOpacity} />}

      {particlesOpacity > 0 && (
        <ParticleField
          color={accent.hex}
          accent={accent.palette.accent}
          secondary={accent.palette.secondary}
        />
      )}

      {orbOpacity > 0 && <AudioOrb ref={setOrb} accent={accent} />}
      {terrainOpacity > 0 && <AudioTerrain accent={accent} />}

      {albumGravityOpacity > 0 &&
        albumLayout.map(album => <AlbumMesh key={album.albumId} {...album} />)}

        {quality !== 'Low' && (
          <EffectComposer
            multisampling={quality === 'Epic' ? 8 : 0}
            frameBufferType={THREE.HalfFloatType}
          >
            {([] as React.ReactElement[]).concat(
              bloomEnabled
                ? [
                    <Bloom
                      key="bloom"
                      luminanceThreshold={0.1}
                      intensity={bloomIntensity * (1 + bassPower * 0.5)}
                    />,
                  ]
                : [],
              godRaysEnabled && orb
                ? [
                    <GodRays
                      key="godrays"
                      sun={orb}
                      samples={quality === 'Epic' ? 32 : 16}
                      density={0.96}
                      decay={0.9}
                      weight={0.3}
                      exposure={0.4}
                      clampMax={1.0}
                    />,
                  ]
                : [],
              chromaticAberrationEnabled
                ? [
                    <ChromaticAberration
                      key="chroma"
                      /* eslint-disable react-hooks/refs */
                      offset={chromaOffset.current.set(0.002 * bassPower, 0.002 * bassPower)}
                      /* eslint-enable react-hooks/refs */
                      radialModulation={false}
                      modulationOffset={0}
                    />,
                  ]
                : [],
              vignetteEnabled
                ? [<Vignette key="vignette" eskil={false} offset={0.5} darkness={0.5} />]
                : [],
              filmGrainEnabled ? [<Noise key="noise" opacity={0.05} />] : [],
              dofEnabled
                ? [
                    <DepthOfField
                      key="dof"
                      focusDistance={0}
                      focalLength={0.02}
                      bokehScale={2}
                      height={480}
                    />,
                  ]
                : []
            )}
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
              <Canvas camera={{ position: [0, 0, 8], fov: 60 }}   
              gl={{
                preserveDrawingBuffer: isRecording, // only pay this cost when recording
                stencil: false,
                antialias: false,
                powerPreference: 'high-performance',
              }}>
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

            {/* Cinematic HUD Elements */}
            <div style={styles.hudRight}>
              <EnergyFlux accent={accent.hex} />
              <FrequencyScrutinizer accent={accent.hex} />
              <WaveformScrutinizer accent={accent.hex} />
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={visualLayer}
                initial={{ opacity: 0, scale: 0.8, filter: 'blur(20px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 1.2, filter: 'blur(20px)' }}
                transition={{
                  duration: 0.8,
                  ease: [0.16, 1, 0.3, 1],
                }}
                style={{ ...styles.layerIndicator, borderColor: `${accent.hex}33` }}
              >
                <div style={styles.indicatorLabel}>MODE</div>
                <div style={styles.indicatorValue}>
                  {Array.from(visualLayer.toUpperCase()).map((char, i) => (
                    <motion.span
                      key={i}
                      initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      transition={{
                        delay: i * 0.04 + 0.1,
                        duration: 0.6,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >
                      {char}
                    </motion.span>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>

            {visualLayer === 'Minimal' && (
              <div style={styles.radialWrap}>
                <RadialVisualiser width={500} height={500} accent={accent} />
              </div>
            )}

            {currentTrack && (
              <motion.div
                initial={{ opacity: 0, x: -60, filter: 'blur(10px)' }}
                animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                transition={{
                  type: 'spring',
                  stiffness: 300,
                  damping: 30,
                  delay: 0.1,
                }}
                style={{ ...styles.nowPlaying, borderColor: `${accent.hex}33` }}
              >
                <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
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
                  <div style={styles.hudMeta}>
                    <BeatIndicator accent={accent.hex} />
                    <span style={{ opacity: 0.4 }}>LIVE_FEED</span>
                  </div>
                </div>
              </motion.div>
            )}

            <div style={styles.controls}>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <HUDButton
                  onClick={toggleFullscreen}
                  label="EXIT_FULLSCREEN"
                  shortcut="F"
                  accent={accent.hex}
                />
                <HUDButton
                  onClick={() => setShowSettings(!useVisualiserStore.getState().showSettings)}
                  label="FX_SETTINGS"
                  shortcut="S"
                  accent={accent.hex}
                />
                <HUDButton
                  onClick={toggleRecording}
                  label={isRecording ? "STOP_RECORDING" : "START_CAPTURE"}
                  shortcut="R"
                  accent={isRecording ? '#ff4444' : accent.hex}
                  isActive={isRecording}
                />
              </div>
              <div style={styles.info}>
                <div style={{ ...styles.layerLabel, borderColor: `${accent.hex}22` }}>
                  CYCLE_LAYERS <span style={{ opacity: 0.5, marginLeft: '0.5rem' }}>[V]</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function EnergyFlux({ accent }: { accent: string }) {
  const fillRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return useVisualiserStore.subscribe(
      state => state.bassPower,
      bassPower => {
        if (fillRef.current) {
          fillRef.current.style.height = `${bassPower * 100}%`
        }
      }
    )
  }, [])

  return (
    <div style={styles.energyFlux}>
      <div style={styles.hudLabel}>ENERGY_FLUX</div>
      <div style={styles.fluxTrack}>
        <div
          ref={fillRef}
          style={{
            ...styles.fluxFill,
            background: `linear-gradient(to top, transparent, ${accent}88, ${accent})`,
            boxShadow: `0 0 15px ${accent}44`,
            transition: 'height 0.1s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>
    </div>
  )
}

function WaveformScrutinizer({ accent }: { accent: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const draw = useCallback(
    (data: Uint8Array) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)

      ctx.beginPath()
      ctx.strokeStyle = accent
      ctx.lineWidth = 1.5
      ctx.lineJoin = 'round'

      const sliceWidth = w / data.length
      let x = 0

      for (let i = 0; i < data.length; i++) {
        const v = data[i] / 128.0
        const y = (v / 2) * h
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
        x += sliceWidth
      }

      ctx.stroke()
    },
    [accent]
  )

  const { start, stop } = useAudioAnalyser({ onWaveformData: draw })

  useEffect(() => {
    start()
    return () => stop()
  }, [start, stop])

  return (
    <div style={styles.scrutinizer}>
      <div style={styles.hudLabel}>WAVE_SCRUTINIZER</div>
      <canvas ref={canvasRef} width={120} height={40} style={styles.scrutinizerCanvas} />
    </div>
  )
}

function FrequencyScrutinizer({ accent }: { accent: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const draw = useCallback((data: Uint8Array) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    const barWidth = 2
    const gap = 1
    const count = Math.floor(w / (barWidth + gap))

    ctx.fillStyle = accent
    for (let i = 0; i < count; i++) {
      const val = data[i * 2] || 0
      const bh = (val / 255) * h
      ctx.fillRect(i * (barWidth + gap), h - bh, barWidth, bh)
    }
  }, [accent])

  const { start, stop } = useAudioAnalyser({ onFrequencyData: draw })

  useEffect(() => {
    start()
    return () => stop()
  }, [start, stop])

  return (
    <div style={styles.scrutinizer}>
      <div style={styles.hudLabel}>FREQ_SCRUTINIZER</div>
      <canvas ref={canvasRef} width={120} height={40} style={styles.scrutinizerCanvas} />
    </div>
  )
}

function BeatIndicator({ accent }: { accent: string }) {
  const beat = useVisualiserStore(state => state.beat)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
      <motion.div
        animate={{
          scale: beat ? [1, 1.4, 1] : 1,
          opacity: beat ? 1 : 0.3,
          backgroundColor: beat ? '#fff' : accent,
        }}
        transition={{ duration: 0.15 }}
        style={{ width: 6, height: 6, borderRadius: '50%' }}
      />
      <span style={{ fontSize: '0.6rem', letterSpacing: '0.1em', opacity: 0.5 }}>BEAT</span>
    </div>
  )
}

function HUDButton({ onClick, label, shortcut, accent, isActive }: {
  onClick: () => void,
  label: string,
  shortcut: string,
  accent: string,
  isActive?: boolean
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.1)' }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      style={{
        ...styles.hudButton,
        borderColor: isActive ? accent : `${accent}33`,
        color: isActive ? '#fff' : accent,
        background: isActive ? `${accent}22` : 'rgba(0,0,0,0.4)',
      }}
    >
      <span style={styles.buttonLabel}>{label}</span>
      <span style={styles.buttonShortcut}>[{shortcut}]</span>
    </motion.button>
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
    fontFamily: 'monospace',
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
    background: 'rgba(5, 5, 5, 0.4)',
    padding: '0.6rem 2rem',
    borderRadius: '4px',
    backdropFilter: 'blur(32px)',
    WebkitBackdropFilter: 'blur(32px)',
    border: '1px solid',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.2rem',
    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
  },
  indicatorLabel: {
    fontSize: '0.6rem',
    letterSpacing: '0.3em',
    opacity: 0.3,
    fontWeight: 600,
  },
  indicatorValue: {
    fontSize: '1rem',
    letterSpacing: '0.4em',
    color: '#fff',
    display: 'flex',
    gap: '0.1em',
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
    top: '2.5rem',
    left: '2.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
    background: 'rgba(5, 5, 5, 0.4)',
    padding: '1.25rem',
    borderRadius: '4px',
    backdropFilter: 'blur(32px)',
    WebkitBackdropFilter: 'blur(32px)',
    border: '1px solid',
    boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
  },
  nowPlayingArt: {
    width: 56,
    height: 56,
    borderRadius: 2,
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    objectFit: 'cover',
  },
  nowPlayingInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
  },
  nowPlayingTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
  },
  nowPlayingArtist: {
    fontSize: '0.75rem',
    opacity: 0.7,
    letterSpacing: '0.1em',
  },
  hudMeta: {
    marginTop: '0.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    fontSize: '0.6rem',
    letterSpacing: '0.1em',
  },
  controls: {
    position: 'absolute',
    bottom: '2.5rem',
    left: '2.5rem',
    right: '2.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    pointerEvents: 'auto',
  },
  hudButton: {
    border: '1px solid',
    padding: '0.6rem 1.25rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.75rem',
    backdropFilter: 'blur(24px)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    transition: 'all 0.3s ease',
    fontWeight: 600,
  },
  buttonLabel: {
    letterSpacing: '0.1em',
  },
  buttonShortcut: {
    opacity: 0.3,
    fontSize: '0.65rem',
  },
  info: {
    fontSize: '0.75rem',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  layerLabel: {
    background: 'rgba(5, 5, 5, 0.4)',
    padding: '0.6rem 1.25rem',
    borderRadius: '4px',
    backdropFilter: 'blur(32px)',
    border: '1px solid',
    display: 'flex',
    alignItems: 'center',
  },
  hudRight: {
    position: 'absolute',
    top: '2.5rem',
    right: '2.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    alignItems: 'flex-end',
  },
  energyFlux: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '0.5rem',
  },
  hudLabel: {
    fontSize: '0.55rem',
    letterSpacing: '0.2em',
    opacity: 0.4,
    fontWeight: 600,
  },
  fluxTrack: {
    width: '4px',
    height: '60px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '2px',
    position: 'relative',
    overflow: 'hidden',
  },
  fluxFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: '2px',
  },
  scrutinizer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '0.5rem',
  },
  scrutinizerCanvas: {
    opacity: 0.6,
  },
}
