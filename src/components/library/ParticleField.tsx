import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useVisualiserStore } from '@/stores/visualiserStore'

const CONFIG = {
  COUNTS: {
    Low: 5000,
    Medium: 15000,
    Epic: 50000,
  },
  BOUNDS: {
    X: 40,
    Y: 20,
    Z: 20,
  },
  VISUALS: {
    SIZE: 15.0, // Base size in shader
    OPACITY_MULT: 0.6,
  }
}

const vertexShader = `
  uniform float uTime;
  uniform float uBass;
  uniform float uSize;
  uniform float uPixelRatio;

  attribute vec3 aVelocity;
  attribute vec3 aOriginalPos;
  attribute vec3 aColor;

  varying vec3 vColor;
  varying float vOpacity;

  void main() {
    vColor = aColor;

    // Calculate position with physics on GPU
    vec3 pos = aOriginalPos;

    // Add audio-reactive drift
    float driftX = sin(uTime * 0.2 + aOriginalPos.z * 0.1) * 2.0 * uBass;
    float driftY = cos(uTime * 0.2 + aOriginalPos.x * 0.1) * 2.0 * uBass;
    pos.x += driftX;
    pos.y += driftY;

    // Continuous movement based on velocity and time
    pos += aVelocity * uTime * 5.0;

    // Wrap positions within bounds
    float limitX = ${CONFIG.BOUNDS.X.toFixed(1)};
    float limitY = ${CONFIG.BOUNDS.Y.toFixed(1)};
    float limitZ = ${CONFIG.BOUNDS.Z.toFixed(1)};

    pos.x = mod(pos.x + limitX, limitX * 2.0) - limitX;
    pos.y = mod(pos.y + limitY, limitY * 2.0) - limitY;
    pos.z = mod(pos.z + limitZ, limitZ * 2.0) - limitZ;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    // Scale particles based on distance and uSize
    gl_PointSize = uSize * uPixelRatio * (1.0 / -mvPosition.z);

    // Boost size on bass
    gl_PointSize *= (1.0 + uBass * 0.5);

    vOpacity = clamp(1.0 / -mvPosition.z * 5.0, 0.0, 1.0);

    gl_Position = projectionMatrix * mvPosition;
  }
`

const fragmentShader = `
  varying vec3 vColor;
  varying float vOpacity;
  uniform float uOpacity;

  void main() {
    // Round particle shape
    float dist = distance(gl_PointCoord, vec2(0.5));
    if (dist > 0.5) discard;

    // Soft edges
    float alpha = smoothstep(0.5, 0.2, dist) * vOpacity * uOpacity;

    gl_FragColor = vec4(vColor, alpha);
  }
`

interface ParticleFieldProps {
  color?: string
  accent?: string
  secondary?: string
}

export function ParticleField({ color = '#ffffff', accent, secondary }: ParticleFieldProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const { quality } = useVisualiserStore.getState()

  const actualCount = useMemo(() => {
    return CONFIG.COUNTS[quality as keyof typeof CONFIG.COUNTS] || CONFIG.COUNTS.Medium
  }, [quality])

  const [positions, velocities, colors] = useMemo(() => {
    const pos = new Float32Array(actualCount * 3)
    const vel = new Float32Array(actualCount * 3)
    const col = new Float32Array(actualCount * 3)

    const baseColor = new THREE.Color(color)
    const accentColor = accent ? new THREE.Color(accent) : baseColor
    const secondaryColor = secondary ? new THREE.Color(secondary) : baseColor

    // Simple deterministic random for React purity rule compliance
    // We only need a fixed set of random numbers once per actualCount change
    const prng = (i: number) => {
      let s = i + 123
      s = (s * 16807) % 2147483647
      return (s - 1) / 2147483646
    }

    for (let i = 0; i < actualCount; i++) {
      // Original positions
      pos[i * 3] = (prng(i * 7) - 0.5) * CONFIG.BOUNDS.X * 2
      pos[i * 3 + 1] = (prng(i * 7 + 1) - 0.5) * CONFIG.BOUNDS.Y * 2
      pos[i * 3 + 2] = (prng(i * 7 + 2) - 0.5) * CONFIG.BOUNDS.Z * 2

      // Velocities
      vel[i * 3] = (prng(i * 7 + 3) - 0.5) * 0.02
      vel[i * 3 + 1] = (prng(i * 7 + 4) - 0.5) * 0.02
      vel[i * 3 + 2] = (prng(i * 7 + 5) - 0.5) * 0.02

      // Distribute colors across the palette
      const r = prng(i * 7 + 6)
      const targetCol = r > 0.7 ? accentColor : r > 0.4 ? secondaryColor : baseColor

      col[i * 3] = targetCol.r
      col[i * 3 + 1] = targetCol.g
      col[i * 3 + 2] = targetCol.b
    }
    return [pos, vel, col]
  }, [actualCount, color, accent, secondary])

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uBass: { value: 0 },
    uOpacity: { value: CONFIG.VISUALS.OPACITY_MULT },
    uSize: { value: CONFIG.VISUALS.SIZE },
    uPixelRatio: { value: typeof window !== 'undefined' ? window.devicePixelRatio : 1 },
  }), [])

  useFrame((state) => {
    const { bassPower, particlesOpacity } = useVisualiserStore.getState()
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime
      materialRef.current.uniforms.uBass.value = bassPower
      materialRef.current.uniforms.uOpacity.value = particlesOpacity * CONFIG.VISUALS.OPACITY_MULT
    }

    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.001 + bassPower * 0.005
    }
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={actualCount}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aOriginalPos"
          count={actualCount}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aVelocity"
          count={actualCount}
          array={velocities}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aColor"
          count={actualCount}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}
