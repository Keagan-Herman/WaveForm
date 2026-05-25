import { useRef, forwardRef, useCallback, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useVisualiserStore } from '@/stores/visualiserStore'
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
  }
}

const coreVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  uniform float uTime;
  uniform float uBass;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;

    // Subtle vertex displacement on bass
    vec3 newPos = position + normal * sin(uTime * 2.0 + position.y * 5.0) * uBass * 0.1;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
  }
`

const coreFragmentShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  uniform float uTime;
  uniform float uBass;
  uniform vec3 uColor;
  uniform vec3 uAccent;
  uniform float uOpacity;

  // Simple noise function
  float noise(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
  }

  void main() {
    // Dynamic plasma effect
    float n = noise(vPosition + uTime * 0.5);
    float pulse = sin(uTime * 3.0 + vPosition.y * 10.0) * 0.5 + 0.5;

    vec3 color = mix(uColor, uAccent, pulse * 0.5 + uBass * 0.5);

    // Rim lighting
    float rim = 1.0 - max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0);
    color += uAccent * pow(rim, 4.0) * (1.0 + uBass * 2.0);

    // Add some "inner fire"
    float fire = sin(vPosition.x * 10.0 + uTime) * sin(vPosition.y * 10.0 + uTime) * sin(vPosition.z * 10.0 + uTime);
    color += uAccent * max(0.0, fire) * 0.5 * (1.0 + uBass);

    gl_FragColor = vec4(color, uOpacity);
  }
`

export const AudioOrb = forwardRef<THREE.Mesh, { accent: AlbumColour }>(({ accent }, ref) => {
  const meshRef = useRef<THREE.Group>(null)
  const coreRef = useRef<THREE.Mesh>(null)
  const coreMaterialRef = useRef<THREE.ShaderMaterial>(null)
  const pointsMatRef = useRef<THREE.PointsMaterial>(null)

  const combinedRef = useCallback((node: THREE.Mesh | null) => {
    if (coreRef.current !== node) {
      (coreRef as React.MutableRefObject<THREE.Mesh | null>).current = node;
    }
    if (ref) {
      if (typeof ref === 'function') ref(node);
      else (ref as React.MutableRefObject<THREE.Mesh | null>).current = node;
    }
  }, [ref]);

  const orbOpacity = useVisualiserStore(state => state.orbOpacity)

  const smoothedBass = useRef(0)
  const smoothedRotation = useRef({ y: 0, z: 0 })
  const colorRef = useRef(new THREE.Color())

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uBass: { value: 0 },
    uColor: { value: new THREE.Color(accent.palette.primary) },
    uAccent: { value: new THREE.Color(accent.palette.accent) },
    uOpacity: { value: 1.0 },
  }), [accent.palette.primary, accent.palette.accent])

  useEffect(() => {
    if (coreMaterialRef.current) {
      coreMaterialRef.current.uniforms.uColor.value.set(accent.palette.primary)
      coreMaterialRef.current.uniforms.uAccent.value.set(accent.palette.accent)
    }
  }, [accent.palette.primary, accent.palette.accent])

  useFrame((state) => {
    const { bassPower, bpm } = useVisualiserStore.getState()
    const time = state.clock.elapsedTime

    // Inertia for bass reactivity
    smoothedBass.current += (bassPower - smoothedBass.current) * CONFIG.ANIMATION.BASS_SMOOTHING

    if (meshRef.current) {
      // Rotation with inertia
      const targetRotY = CONFIG.ANIMATION.BASE_ROT_Y + smoothedBass.current * CONFIG.ANIMATION.BASS_ROT_Y_MULT
      const targetRotZ = CONFIG.ANIMATION.BASE_ROT_Z + smoothedBass.current * CONFIG.ANIMATION.BASS_ROT_Z_MULT

      smoothedRotation.current.y += (targetRotY - smoothedRotation.current.y) * CONFIG.ANIMATION.ROTATION_SMOOTHING
      smoothedRotation.current.z += (targetRotZ - smoothedRotation.current.z) * CONFIG.ANIMATION.ROTATION_SMOOTHING

      meshRef.current.rotation.y += smoothedRotation.current.y
      meshRef.current.rotation.z += smoothedRotation.current.z
    }

    if (coreRef.current) {
      const { beat, beatConfidence } = useVisualiserStore.getState()

      // Organic breathing independent of beat
      const breathing = Math.sin(time * (bpm > 0 ? (bpm / 60) * Math.PI : 2)) * 0.05

      const baseScale = 1.0 + (smoothedBass.current * 0.4) + breathing
      const targetScale = baseScale + (beat ? beatConfidence * 0.3 : 0)

      // Lerp scale for "breathing" effect
      const currentScale = coreRef.current.scale.x
      const nextScale = THREE.MathUtils.lerp(currentScale, targetScale, 0.15)
      coreRef.current.scale.set(nextScale, nextScale, nextScale)
    }

    if (coreMaterialRef.current) {
      coreMaterialRef.current.uniforms.uTime.value = time
      coreMaterialRef.current.uniforms.uBass.value = smoothedBass.current
      coreMaterialRef.current.uniforms.uOpacity.value = orbOpacity * 0.8
    }

    if (pointsMatRef.current) {
      pointsMatRef.current.opacity = orbOpacity * (0.1 + smoothedBass.current * 0.6)

      // Reactive points scale based on bass
      const pointsScale = 1.0 + smoothedBass.current * 0.8
      pointsMatRef.current.size = 0.05 * pointsScale

      // Subtle color shift on bass
      colorRef.current.set(accent.palette.secondary)
      pointsMatRef.current.color.lerp(
        colorRef.current,
        smoothedBass.current * 0.2
      )
    }
  })

  return (
    <group ref={meshRef}>
      {/* Inner Core - Now the main sun source */}
      <mesh ref={combinedRef}>
        <sphereGeometry args={[CONFIG.GEOMETRY.CORE_RADIUS, 64, 64]} />
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
        <sphereGeometry args={[CONFIG.GEOMETRY.CORE_RADIUS, 32, 32]} />
        <meshBasicMaterial
          color={accent.palette.accent}
          transparent
          opacity={orbOpacity * 0.2}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Volumetric light rays (simulated with points) */}
      <points>
        <sphereGeometry args={[CONFIG.GEOMETRY.POINTS_RADIUS, 80, 80]} />
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
