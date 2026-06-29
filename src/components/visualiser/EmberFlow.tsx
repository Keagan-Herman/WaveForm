import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useVisualiserStore } from '@/stores/visualiserStore'
import { SIMPLEX_NOISE_3D } from '@/utils/shaders'

const CONFIG = {
  COUNTS: {
    Low: 4000,
    Medium: 12000,
    Epic: 35000,
  },
  BOUNDS: 14,
  VISUALS: {
    SIZE: 18.0,
    OPACITY_MULT: 0.85,
    STREAK_LENGTH: 2.2,
  },
  GROWTH: {
    BASE: 0.35,
    BASS_MULT: 1.8,
    LERP_SPEED: 4.0,
  },
}

// Curl noise: finite-difference curl of the simplex field gives a
// divergence-free velocity, so particles advect in flowing strands
// rather than bobbing on a scalar height-map.
const vertexShader = `
  uniform float uTime;
  uniform float uGrowth;
  uniform float uMid;
  uniform float uTreble;
  uniform float uSize;
  uniform float uPixelRatio;

  attribute vec3 aSeed;
  attribute float aPhase;

  varying float vHeat;
  varying float vOpacity;
  varying vec2 vVelocityDir;

  ${SIMPLEX_NOISE_3D}

  const float EPS = 0.6;

  vec3 curl(vec3 p) {
    float n1 = snoise(p + vec3(0.0, EPS, 0.0));
    float n2 = snoise(p - vec3(0.0, EPS, 0.0));
    float n3 = snoise(p + vec3(0.0, 0.0, EPS));
    float n4 = snoise(p - vec3(0.0, 0.0, EPS));
    float n5 = snoise(p + vec3(EPS, 0.0, 0.0));
    float n6 = snoise(p - vec3(EPS, 0.0, 0.0));

    float x = (n1 - n2) - (n3 - n4);
    float y = (n3 - n4) - (n5 - n6);
    float z = (n5 - n6) - (n1 - n2);

    return normalize(vec3(x, y, z) + 1e-4);
  }

  void main() {
    float turbSpeed = 0.06 + uMid * 0.35;
    float t = uTime * turbSpeed + aPhase;

    // Stateless advection: sample the time-evolving field offset rather
    // than tracking a persistent position, so no per-frame CPU writes.
    vec3 p = aSeed * 0.18;
    vec3 sample = p + vec3(0.0, 0.0, t * 0.5);

    vec3 flow = vec3(0.0);
    flow += curl(sample) * 1.0;
    flow += curl(sample * 2.1 + 10.0) * 0.5;

    vec3 pos = aSeed + flow * uGrowth * 6.0;

    // Treble jitter: independent of main flow so it reads as energy, not displacement
    pos += curl(sample * 4.0 + 50.0) * uTreble * 0.8;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    float sizeBoost = 1.0 + uGrowth * 0.6 + uTreble * 0.8;
    gl_PointSize = uSize * uPixelRatio * sizeBoost * (1.0 / -mvPosition.z);

    vOpacity = clamp(1.0 / -mvPosition.z * 6.0, 0.0, 1.0);

    vHeat = clamp(length(flow) * (0.5 + uGrowth * 0.5) + uTreble * 0.6, 0.0, 1.0);
    vVelocityDir = normalize(flow.xy + 1e-4);

    gl_Position = projectionMatrix * mvPosition;
  }
`

// Heat ramp: black → deep red → magenta → white, three lerp stages to
// avoid a texture upload for a 4-stop gradient.
const fragmentShader = `
  varying float vHeat;
  varying float vOpacity;
  varying vec2 vVelocityDir;
  uniform float uOpacity;

  vec3 heatRamp(float h) {
    vec3 black   = vec3(0.0, 0.0, 0.0);
    vec3 red     = vec3(0.65, 0.05, 0.08);
    vec3 magenta = vec3(0.95, 0.15, 0.85);
    vec3 white   = vec3(1.0, 0.97, 0.95);

    if (h < 0.33) {
      return mix(black, red, h / 0.33);
    } else if (h < 0.7) {
      return mix(red, magenta, (h - 0.33) / 0.37);
    } else {
      return mix(magenta, white, (h - 0.7) / 0.3);
    }
  }

  void main() {
    // Stretch soft circle along velocity for a motion-streak look without
    // an accumulation buffer.
    vec2 centered = gl_PointCoord - vec2(0.5);
    vec2 stretched = vec2(
      dot(centered, vVelocityDir),
      dot(centered, vec2(-vVelocityDir.y, vVelocityDir.x))
    );
    stretched.x /= 2.2;

    float dist = length(stretched);
    if (dist > 0.5) discard;

    float alpha = smoothstep(0.5, 0.05, dist) * vOpacity * uOpacity;
    vec3 color = heatRamp(vHeat);

    gl_FragColor = vec4(color, alpha);
  }
`

export function EmberFlow() {
  const pointsRef = useRef<THREE.Points>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const growthRef = useRef(CONFIG.GROWTH.BASE)
  const quality = useVisualiserStore(state => state.quality)

  const actualCount = useMemo(
    () => CONFIG.COUNTS[quality as keyof typeof CONFIG.COUNTS] ?? CONFIG.COUNTS.Medium,
    [quality]
  )

  const [seeds, phases] = useMemo(() => {
    const seed = new Float32Array(actualCount * 3)
    const phase = new Float32Array(actualCount)

    // Deterministic PRNG — avoids non-deterministic Math.random() in useMemo
    const prng = (i: number) => {
      let s = i + 911
      s = (s * 16807) % 2147483647
      return (s - 1) / 2147483646
    }

    for (let i = 0; i < actualCount; i++) {
      seed[i * 3] = (prng(i * 5) - 0.5) * CONFIG.BOUNDS * 2
      seed[i * 3 + 1] = (prng(i * 5 + 1) - 0.5) * CONFIG.BOUNDS * 2
      seed[i * 3 + 2] = (prng(i * 5 + 2) - 0.5) * CONFIG.BOUNDS * 2
      phase[i] = prng(i * 5 + 3) * Math.PI * 2
    }
    return [seed, phase]
  }, [actualCount])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uGrowth: { value: CONFIG.GROWTH.BASE },
      uMid: { value: 0 },
      uTreble: { value: 0 },
      uOpacity: { value: CONFIG.VISUALS.OPACITY_MULT },
      uSize: { value: CONFIG.VISUALS.SIZE },
      uPixelRatio: { value: typeof window !== 'undefined' ? window.devicePixelRatio : 1 },
    }),
    []
  )

  useFrame((state, delta) => {
    const { bassPower, midPower, treblePower, emberFlowOpacity } = useVisualiserStore.getState()

    // Critically-damped exponential lerp — strands "grow" and settle rather
    // than snapping on every transient.
    const target = CONFIG.GROWTH.BASE + bassPower * CONFIG.GROWTH.BASS_MULT
    growthRef.current +=
      (target - growthRef.current) * Math.min(1, delta * CONFIG.GROWTH.LERP_SPEED)

    if (materialRef.current) {
      const u = materialRef.current.uniforms
      u.uTime.value = state.clock.elapsedTime
      u.uGrowth.value = growthRef.current
      u.uMid.value = midPower
      u.uTreble.value = treblePower
      u.uOpacity.value = emberFlowOpacity * CONFIG.VISUALS.OPACITY_MULT
    }

    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.0008 + midPower * 0.002
    }
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={actualCount}
          array={seeds}
          itemSize={3}
        />
        <bufferAttribute attach="attributes-aSeed" count={actualCount} array={seeds} itemSize={3} />
        <bufferAttribute
          attach="attributes-aPhase"
          count={actualCount}
          array={phases}
          itemSize={1}
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
