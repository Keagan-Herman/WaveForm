import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useVisualiserStore } from '@/stores/visualiserStore'
import { FBM_2D } from '@/utils/shaders'
import type { AlbumColour } from '@/hooks/useAlbumColour'

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/**
 * FluidBackground Shader:
 * - Creates a "nebula-like" background using multiple layers of Simplex 2D Noise (FBM).
 * - One noise layer drives large-scale color shifts, while a second high-frequency
 *   layer is distorted by the audio bass power for reactive motion.
 * - Colors are derived from the current album's primary and secondary palette,
 *   heavily darkened to serve as a non-distracting backdrop.
 */
const fragmentShader = `
  uniform float uTime;
  uniform float uBass;
  uniform vec3 uColor;
  uniform vec3 uSecondary;
  varying vec2 vUv;

  ${FBM_2D}

  void main() {
    vec2 uv = vUv;

    // Multi-octave fbm for deep space feel
    float n = fbm(uv * 2.0 + uTime * 0.05);
    n = n * 0.5 + 0.5;

    float d = snoise(uv * 12.0 - uTime * 0.4 + uBass * 1.5) * 0.5 + 0.5;

    // Deep space colors
    vec3 baseColor = uColor * 0.02;
    vec3 nebulaColor = mix(uColor, uSecondary, d) * 0.15;

    // Star field simulation
    float stars = pow(abs(snoise(uv * 50.0)), 20.0) * 0.5;
    stars += pow(abs(snoise(uv * 80.0 + 10.0)), 30.0) * 0.8;
    stars *= (0.8 + uBass * 1.5);

    vec3 color = mix(baseColor, nebulaColor, n);
    color += stars * uSecondary;
    color += uBass * 0.03 * uSecondary;

    gl_FragColor = vec4(color, 1.0);
  }
`

interface FluidBackgroundProps {
  accent: AlbumColour
}

export function FluidBackground({ accent }: FluidBackgroundProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const { viewport } = useThree()

  const uniforms = useRef({
    uTime: { value: 0 },
    uBass: { value: 0 },
    uColor: { value: new THREE.Color(accent.hex) },
    uSecondary: { value: new THREE.Color(accent.palette.secondary) },
  })

  useEffect(() => {
    uniforms.current.uColor.value.set(accent.hex)
    uniforms.current.uSecondary.value.set(accent.palette.secondary)
  }, [accent.hex, accent.palette.secondary])

  useFrame(state => {
    if (!meshRef.current) return
    const { bassPower } = useVisualiserStore.getState()
    uniforms.current.uTime.value = state.clock.elapsedTime
    uniforms.current.uBass.value = THREE.MathUtils.lerp(uniforms.current.uBass.value, bassPower, 0.1)
  })

  return (
    <mesh ref={meshRef} scale={[viewport.width * 2, viewport.height * 2, 1]} position={[0, 0, -10]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        // eslint-disable-next-line react-hooks/refs
        uniforms={uniforms.current}
        transparent
      />
    </mesh>
  )
}
