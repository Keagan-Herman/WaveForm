import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { audioEngine } from '@/audio/AudioEngine'
import { useVisualiserStore } from '@/stores/visualiserStore'
import { SIMPLEX_NOISE_3D } from '@/utils/shaders'
import type { AlbumColour } from '@/hooks/useAlbumColour'

const CONFIG = {
  GEOMETRY: {
    SIZE: 20,
  },
  ANIMATION: {
    NOISE_SCALE: 0.1,
    NOISE_SPEED: 0.1,
    BASS_MULT: 1.5,
    FREQ_MULT: 1.0,
  },
  COLOR: {
    MIX_MULT: 0.2,
  }
}

const vertexShader = `
  varying vec2 vUv;
  varying float vElevation;
  varying float vShock;
  uniform float uTime;
  uniform float uBass;
  uniform float uBeat;
  uniform float uBeatTime;
  uniform sampler2D uFreq;
  uniform int uQuality;

  ${SIMPLEX_NOISE_3D}

  void main() {
    vUv = uv;
    
    float freqRaw = texture2D(uFreq, vec2(uv.x, 0.5)).r;
    float freq = pow(freqRaw, 1.5) * ${CONFIG.ANIMATION.FREQ_MULT.toFixed(1)};

    vec3 noisePos = vec3(
      position.x * ${CONFIG.ANIMATION.NOISE_SCALE.toFixed(1)},
      position.y * ${CONFIG.ANIMATION.NOISE_SCALE.toFixed(1)} + uTime * ${CONFIG.ANIMATION.NOISE_SPEED.toFixed(1)},
      uTime * ${CONFIG.ANIMATION.NOISE_SPEED.toFixed(2)}
    );

    float noise = 0.0;
    if (uQuality > 0) {
      noise = snoise(noisePos) * ${CONFIG.ANIMATION.BASS_MULT.toFixed(1)} * uBass;
      if (uQuality > 1) {
        noise += snoise(noisePos * 2.0) * 0.5 * uBass;
      }
    } else {
      noise = sin(position.x * 0.5 + uTime) * uBass * 0.5;
    }

    // Beat shockwave
    float distFromCenter = distance(uv, vec2(0.5));
    float shockwave = 0.0;
    if (uQuality > 0) {
       float waveTime = mod(uTime - uBeatTime, 2.0);
       float waveFront = waveTime * 1.5;
       shockwave = sin(max(0.0, waveFront - distFromCenter * 5.0) * 10.0) * exp(-waveTime * 2.0) * uBeat * 2.0;
    }
    vShock = shockwave;

    float dist = distance(uv, vec2(0.5));
    float mask = smoothstep(0.5, 0.2, dist);
    
    float elevation = noise + (freq * mask * 2.5) + shockwave;
    vElevation = elevation;
    
    vec3 newPosition = position;
    newPosition.z += elevation;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`

const fragmentShader = `
  varying vec2 vUv;
  varying float vElevation;
  varying float vShock;
  uniform vec3 uColor;
  uniform vec3 uAccent;
  uniform float uOpacity;
  uniform int uQuality;

  void main() {
    float mixFactor = clamp(vElevation * ${CONFIG.COLOR.MIX_MULT.toFixed(1)}, 0.0, 1.0);

    float dx = dFdx(vElevation);
    float dy = dFdy(vElevation);
    float slope = sqrt(dx*dx + dy*dy) * 12.0;

    vec3 baseColor = mix(uColor * 0.02, uAccent * 0.4, mixFactor);
    vec3 color = baseColor;

    // High fidelity highlights
    if (uQuality > 0) {
      color += uAccent * smoothstep(0.3, 1.0, slope) * 0.4;
      color += pow(mixFactor, 4.0) * 1.2 * uAccent;

      // Shockwave glow
      color += uAccent * vShock * 0.5;
    } else {
      color += uAccent * mixFactor * 0.5;
    }

    vec3 normal = normalize(vec3(-dx, -dy, 1.0));
    float rim = 1.0 - max(dot(normal, vec3(0.0, 0.0, 1.0)), 0.0);
    color += uAccent * pow(rim, 3.0) * 0.6;

    gl_FragColor = vec4(color, uOpacity);
  }
`

export function AudioTerrain({ accent }: { accent: AlbumColour }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const terrainOpacity = useVisualiserStore(state => state.terrainOpacity)
  const quality = useVisualiserStore(state => state.quality)

  const qualityInt = useMemo(() => {
    if (quality === 'Epic') return 2
    if (quality === 'Medium') return 1
    return 0
  }, [quality])

  const freqDataRef = useRef(new Uint8Array(128))
  const freqTextureRef = useRef<THREE.DataTexture | null>(null)
  const lastBeatTime = useRef(0)

  /* eslint-disable react-hooks/refs */
  if (!freqTextureRef.current) {
    freqTextureRef.current = new THREE.DataTexture(freqDataRef.current, 128, 1, THREE.RedFormat)
    freqTextureRef.current.needsUpdate = true
  }

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBass: { value: 0 },
      uBeat: { value: 0 },
      uBeatTime: { value: 0 },
      uFreq: { value: freqTextureRef.current! },
      uColor: { value: new THREE.Color(accent.hex) },
      uAccent: { value: new THREE.Color(accent.palette.accent) },
      uOpacity: { value: 1.0 },
      uQuality: { value: qualityInt }
    }),
    [accent.hex, accent.palette.accent, qualityInt]
  )
  /* eslint-enable react-hooks/refs */

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uColor.value.set(accent.hex)
      materialRef.current.uniforms.uAccent.value.set(accent.palette.accent)
      materialRef.current.uniforms.uQuality.value = qualityInt
    }
  }, [accent.hex, accent.palette.accent, qualityInt])

  useEffect(() => {
    return () => {
      freqTextureRef.current?.dispose()
    }
  }, [])

  useFrame(state => {
    const { clock } = state
    const data = audioEngine.getFrequencyData()
    const visualState = useVisualiserStore.getState()
    const { bassPower, beat, beatConfidence } = visualState

    if (beat) {
      lastBeatTime.current = clock.elapsedTime
    }

    if (materialRef.current && freqTextureRef.current) {
      freqDataRef.current.set(data.subarray(0, 128))
      freqTextureRef.current.needsUpdate = true

      materialRef.current.uniforms.uTime.value = clock.elapsedTime
      materialRef.current.uniforms.uBass.value = bassPower
      materialRef.current.uniforms.uBeat.value = beat ? beatConfidence : materialRef.current.uniforms.uBeat.value * 0.95
      materialRef.current.uniforms.uBeatTime.value = lastBeatTime.current
      materialRef.current.uniforms.uOpacity.value = terrainOpacity
    }
  })

  const detail = useMemo(() => {
    if (quality === 'Epic') return 128
    if (quality === 'Medium') return 64
    return 32
  }, [quality])

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
      <mesh>
        <planeGeometry args={[CONFIG.GEOMETRY.SIZE, CONFIG.GEOMETRY.SIZE, detail, detail]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent
          wireframe
        />
      </mesh>

      <mesh position={[0, 0, -0.1]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial
          color={accent.palette.background}
          metalness={0.9}
          roughness={0.1}
          transparent
          opacity={terrainOpacity * 0.5}
        />
      </mesh>
    </group>
  )
}
