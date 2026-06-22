import { useRef, forwardRef, useCallback, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useVisualiserStore } from '@/stores/visualiserStore'
import { SIMPLEX_NOISE_3D } from '@/utils/shaders'
import type { AlbumColour } from '@/hooks/useAlbumColour'

// Configuration constants
const CONFIG = {
  GEOMETRY: {
    CORE_RADIUS: 0.8,
    POINTS_RADIUS: 1.5,
  },
  ANIMATION: {
    BASS_SMOOTHING: 0.12,
    ROTATION_SMOOTHING: 0.1,
    BASE_ROT_Y: 0.004,
    BASE_ROT_Z: 0.002,
    BASS_ROT_Y_MULT: 0.008,
    BASS_ROT_Z_MULT: 0.006,
  },
}

const coreVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vNoise;
  uniform float uTime;
  uniform float uBass;
  uniform float uTreble;
  uniform int uQuality;

  ${SIMPLEX_NOISE_3D}

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;

    float noise = 0.0;
    if (uQuality > 0) {
      noise = snoise(position * 2.0 + uTime * 0.5) * 0.5;
      if (uQuality > 1) {
        noise += snoise(position * 4.0 - uTime * 0.8) * 0.25;
      }
      // Treble adds fine-grain surface detail (skipped on Low quality)
      noise += snoise(position * 12.0 + uTime * 1.2) * uTreble * 0.08;
    } else {
      noise = sin(position.y * 5.0 + uTime * 2.0) * 0.2;
    }

    vNoise = noise;
    vec3 newPos = position + normal * noise * uBass * 0.3;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
  }
`

const coreFragmentShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vNoise;
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uTreble;
  uniform float uSpectralFlux;
  uniform vec3 uColor;
  uniform vec3 uAccent;
  uniform float uOpacity;
  uniform int uQuality;

  ${SIMPLEX_NOISE_3D}

  void main() {
    float intensity = vNoise * 0.5 + 0.5;

    float filaments = snoise(vPosition * 8.0 + uTime * 0.4) * 0.5 + 0.5;
    filaments *= snoise(vPosition * 16.0 - uTime * 0.6) * 0.5 + 0.5;

    // Mid-frequency warms the color mix (voice = warmer orb)
    float mixFactor = clamp(intensity + uBass * 0.4 + uMid * 0.15, 0.0, 1.0);
    vec3 color = mix(uColor * 0.4, uAccent, mixFactor);
    color = mix(color, uAccent * 1.5, filaments * intensity * (0.2 + uBass * 0.8));

    // Rim lighting — spectralFlux keeps glow alive between beats
    float rim = 1.0 - max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0);
    float rimPower = uQuality > 1 ? 6.0 : 4.0;
    color += uAccent * pow(rim, rimPower) * (1.5 + uBass * 3.0 + uSpectralFlux * 0.4);

    // Flare patterns
    if (uQuality > 0) {
      float flares = sin(vPosition.x * 20.0 + uTime) * cos(vPosition.y * 15.0 - uTime);
      if (uQuality > 1) {
        flares *= sin(vPosition.z * 10.0 + uTime * 0.5);
      }
      color += uAccent * max(0.0, flares) * 0.4 * (1.0 + uBass);

      // Treble sparkle: scattered bright flecks on cymbal hits
      float sparkleNoise = snoise(vPosition * 12.0 + uTime * 1.5) * 0.5 + 0.5;
      float sparkleMask = step(1.0 - uTreble * 0.2, sparkleNoise);
      color += uAccent * sparkleMask * uTreble * 1.5;
    }

    // Interior glow
    float interior = max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0);
    color += uColor * pow(interior, 2.5) * 0.5;

    // Organic pulse
    float pulse = sin(uTime * 2.0) * 0.5 + 0.5;
    color += uAccent * pulse * 0.1 * (1.0 + uBass);

    gl_FragColor = vec4(color, uOpacity);
  }
`

export const AudioOrb = forwardRef<THREE.Mesh, { accent: AlbumColour }>(({ accent }, ref) => {
  const meshRef = useRef<THREE.Group>(null)
  const coreRef = useRef<THREE.Mesh>(null)
  const coreMaterialRef = useRef<THREE.ShaderMaterial>(null)
  const pointsMatRef = useRef<THREE.PointsMaterial>(null)

  const combinedRef = useCallback(
    (node: THREE.Mesh | null) => {
      if (coreRef.current !== node) {
        ;(coreRef as React.MutableRefObject<THREE.Mesh | null>).current = node
      }
      if (ref) {
        if (typeof ref === 'function') ref(node)
        else (ref as React.MutableRefObject<THREE.Mesh | null>).current = node
      }
    },
    [ref]
  )

  const orbOpacity = useVisualiserStore(state => state.orbOpacity)
  const quality = useVisualiserStore(state => state.quality)

  const qualityInt = useMemo(() => {
    if (quality === 'Epic') return 2
    if (quality === 'Medium') return 1
    return 0
  }, [quality])

  const smoothedBass = useRef(0)
  const smoothedRotation = useRef({ y: 0, z: 0 })
  const colorRef = useRef(new THREE.Color())

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uTreble: { value: 0 },
      uSpectralFlux: { value: 0 },
      uColor: { value: new THREE.Color(accent.palette.primary) },
      uAccent: { value: new THREE.Color(accent.palette.accent) },
      uOpacity: { value: 1.0 },
      uQuality: { value: qualityInt },
    }),
    [accent.palette.primary, accent.palette.accent, qualityInt]
  )

  useEffect(() => {
    if (coreMaterialRef.current) {
      coreMaterialRef.current.uniforms.uColor.value.set(accent.palette.primary)
      coreMaterialRef.current.uniforms.uAccent.value.set(accent.palette.accent)
      coreMaterialRef.current.uniforms.uQuality.value = qualityInt
    }
  }, [accent.palette.primary, accent.palette.accent, qualityInt])

  useFrame(state => {
    const { bassPower, bpm, beat, beatConfidence, midPower, treblePower, spectralFlux } =
      useVisualiserStore.getState()
    const time = state.clock.elapsedTime

    smoothedBass.current += (bassPower - smoothedBass.current) * CONFIG.ANIMATION.BASS_SMOOTHING

    if (meshRef.current) {
      const targetRotY =
        CONFIG.ANIMATION.BASE_ROT_Y + smoothedBass.current * CONFIG.ANIMATION.BASS_ROT_Y_MULT
      const targetRotZ =
        CONFIG.ANIMATION.BASE_ROT_Z + smoothedBass.current * CONFIG.ANIMATION.BASS_ROT_Z_MULT

      smoothedRotation.current.y +=
        (targetRotY - smoothedRotation.current.y) * CONFIG.ANIMATION.ROTATION_SMOOTHING
      smoothedRotation.current.z +=
        (targetRotZ - smoothedRotation.current.z) * CONFIG.ANIMATION.ROTATION_SMOOTHING

      meshRef.current.rotation.y += smoothedRotation.current.y
      meshRef.current.rotation.z += smoothedRotation.current.z
    }

    if (coreRef.current) {
      // BPM-synced breathing: Math.PI * 2 gives one breath per beat (was Math.PI = two beats)
      const breathing = Math.sin(time * (bpm > 0 ? (bpm / 60) * Math.PI * 2 : 2)) * 0.05
      const baseScale = 1.0 + smoothedBass.current * 0.4 + breathing
      const targetScale = baseScale + (beat ? beatConfidence * 0.3 : 0)
      const currentScale = coreRef.current.scale.x
      const nextScale = THREE.MathUtils.lerp(currentScale, targetScale, 0.15)
      coreRef.current.scale.set(nextScale, nextScale, nextScale)
    }

    if (coreMaterialRef.current) {
      coreMaterialRef.current.uniforms.uTime.value = time
      coreMaterialRef.current.uniforms.uBass.value = smoothedBass.current
      coreMaterialRef.current.uniforms.uMid.value = midPower
      coreMaterialRef.current.uniforms.uTreble.value = treblePower
      coreMaterialRef.current.uniforms.uSpectralFlux.value = spectralFlux
      coreMaterialRef.current.uniforms.uOpacity.value = orbOpacity * 0.8
    }

    if (pointsMatRef.current) {
      pointsMatRef.current.opacity = orbOpacity * (0.1 + smoothedBass.current * 0.6)

      // Reactive points scale based on bass
      const pointsScale = 1.0 + smoothedBass.current * 0.8
      pointsMatRef.current.size = 0.05 * pointsScale

      // Subtle color shift on bass
      colorRef.current.set(accent.palette.secondary)
      pointsMatRef.current.color.lerp(colorRef.current, smoothedBass.current * 0.2)
    }
  })

  // Quality based geometry detail
  const geometryDetail = useMemo(() => {
    if (quality === 'Epic') return 128
    if (quality === 'Medium') return 64
    return 32
  }, [quality])

  const pointsDetail = useMemo(() => {
    if (quality === 'Epic') return 100
    if (quality === 'Medium') return 60
    return 40
  }, [quality])

  return (
    <group ref={meshRef}>
      {/* Inner Core - Now the main sun source */}
      <mesh ref={combinedRef}>
        <sphereGeometry args={[CONFIG.GEOMETRY.CORE_RADIUS, geometryDetail, geometryDetail]} />
        <shaderMaterial
          ref={coreMaterialRef}
          vertexShader={coreVertexShader}
          fragmentShader={coreFragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={true}
        />
      </mesh>

      {/* Outer Glow */}
      <mesh scale={[1.1, 1.1, 1.1]}>
        <sphereGeometry
          args={[
            CONFIG.GEOMETRY.CORE_RADIUS,
            quality === 'Low' ? 16 : 32,
            quality === 'Low' ? 16 : 32,
          ]}
        />
        <meshBasicMaterial
          color={accent.palette.accent}
          transparent
          opacity={orbOpacity * 0.2}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Volumetric light rays (simulated with points) */}
      <points>
        <sphereGeometry args={[CONFIG.GEOMETRY.POINTS_RADIUS, pointsDetail, pointsDetail]} />
        <pointsMaterial
          ref={pointsMatRef}
          color={accent.palette.secondary}
          size={0.05}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation={true}
        />
      </points>
    </group>
  )
})
