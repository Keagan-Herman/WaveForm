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
  // Particles sit along rays from the origin, biased toward one side
  // to match the reference's lopsided eruption rather than a symmetric starburst.
  RAY: {
    MAX_REACH: 16,
    ASYMMETRY_BIAS: [1.0, 0.4, 0.3] as [number, number, number],
  },
  VISUALS: {
    // gl_PointSize = SIZE * sizeBoost * (1/cameraDistance). Camera sits ~16
    // units out and particles collapse toward origin at rest, so they're
    // always at worst-case distance. 90 keeps resting particles visible
    // (~5px) and full-bass particles prominent (~14px) at that distance.
    SIZE: 90.0,
    OPACITY_MULT: 0.85,
    STREAK_LENGTH: 2.2,
  },
  GROWTH: {
    BASE: 0.12,
    BASS_MULT: 2.4,
    LERP_SPEED: 4.0,
  },
}

// Curl noise: finite-difference curl of the simplex field gives a
// divergence-free velocity, so particles advect in flowing strands
// rather than bobbing on a scalar height-map.
const vertexShader = `
  uniform float uTime;
  uniform float uGrowth;
  uniform float uGrowthMin;
  uniform float uGrowthRange;
  uniform float uMid;
  uniform float uTreble;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uMaxReach;

  attribute vec3 aSeed;
  attribute float aPhase;
  attribute float aDistance;

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

    // aSeed is a unit ray direction. Sampling the curl field along the ray
    // gives each strand its own turbulence orientation rather than all
    // strands sharing one global field and moving in lockstep.
    vec3 rayDir = aSeed;
    vec3 sample = rayDir * 1.4 + vec3(0.0, 0.0, t * 0.5);

    vec3 flow = vec3(0.0);
    flow += curl(sample) * 1.0;
    flow += curl(sample * 2.1 + 10.0) * 0.5;

    float growth = uGrowth;

    // Core position: particles travel outward along the ray by aDistance
    // (0..1) scaled to world units. At low growth everything collapses
    // toward the origin; at high growth particles reach further out —
    // that's what reads as strands "growing" on a bass hit.
    float reach = aDistance * uMaxReach;
    vec3 corePos = rayDir * reach * growth;

    // Curl bends the ray as a perpendicular-ish offset, scaled by how far
    // out the particle already is, so bending is subtle at the core and
    // pronounced at the tips — matching the reference's tapered, forking ends.
    float bendStrength = reach * growth * 0.35;
    vec3 pos = corePos + flow * bendStrength;

    // Treble jitter: independent of main flow so it reads as energy, not displacement
    pos += curl(sample * 4.0 + 50.0) * uTreble * 0.8;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    float sizeBoost = 1.0 + growth * 0.6 + uTreble * 0.8;
    gl_PointSize = uSize * uPixelRatio * sizeBoost * (1.0 / -mvPosition.z);

    vOpacity = clamp(1.0 / -mvPosition.z * 6.0, 0.0, 1.0);

    // Heat driven by audio scalars, not flow magnitude — curl() returns unit
    // vectors so length(flow) sits in a narrow ~0.5-1.5 band regardless of
    // audio and was saturating the ramp even at rest. growthNorm maps the
    // bass-driven range (BASE..BASE+BASS_MULT) to 0..1 via uniforms so
    // CONFIG changes can't silently drift out of sync with this formula.
    float growthNorm = clamp((growth - uGrowthMin) / uGrowthRange, 0.0, 1.0);
    // coreBoost: particles near the origin (low aDistance) run hotter,
    // giving the reference's concentrated white-hot center rather than
    // uniform brightness across the whole spread.
    float coreBoost = (1.0 - aDistance) * 0.25;
    vHeat = clamp(growthNorm * 0.75 + uTreble * 0.5 + coreBoost, 0.0, 1.0);
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

    vec3 color = heatRamp(vHeat);

    // Alpha scales with heat — without this, cold particles render at full
    // strength in a dark color, reading as a uniformly dim field rather than
    // particles that genuinely emerge and fade with the music.
    float heatAlpha = smoothstep(0.05, 0.4, vHeat);
    float alpha = smoothstep(0.5, 0.05, dist) * vOpacity * uOpacity * heatAlpha;

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

  const [seeds, phases, distances, initialPositions] = useMemo(() => {
    const seed = new Float32Array(actualCount * 3)
    const phase = new Float32Array(actualCount)
    const distance = new Float32Array(actualCount)
    // initialPos gives Three.js a bounding sphere that reflects the real
    // spatial extent (~MAX_REACH) so frustum culling works correctly.
    // Using the unit-direction seeds for attributes-position would produce
    // a bounding sphere of radius ~1 while particles render out to 16.
    const initialPos = new Float32Array(actualCount * 3)

    // Deterministic PRNG — avoids non-deterministic Math.random() in useMemo
    const prng = (i: number) => {
      let s = i + 911
      s = (s * 16807) % 2147483647
      return (s - 1) / 2147483646
    }

    const [bx, by, bz] = CONFIG.RAY.ASYMMETRY_BIAS

    for (let i = 0; i < actualCount; i++) {
      // Random direction on a unit sphere, stretched per-axis by the
      // asymmetry bias so the structure fans more along x than y/z —
      // matches the reference's lopsided, horizontally-dominant eruption.
      const theta = prng(i * 5) * Math.PI * 2
      const phi = Math.acos(2 * prng(i * 5 + 1) - 1)
      let dx = Math.sin(phi) * Math.cos(theta) * bx
      let dy = Math.sin(phi) * Math.sin(theta) * by
      let dz = Math.cos(phi) * bz
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1
      dx /= len
      dy /= len
      dz /= len

      seed[i * 3] = dx
      seed[i * 3 + 1] = dy
      seed[i * 3 + 2] = dz

      // Bias distance toward the core (pow skews toward 0) so particles
      // are denser near center and sparser toward tips, like real embers.
      const dist = Math.pow(prng(i * 5 + 2), 1.8)
      distance[i] = dist

      initialPos[i * 3] = dx * dist * CONFIG.RAY.MAX_REACH
      initialPos[i * 3 + 1] = dy * dist * CONFIG.RAY.MAX_REACH
      initialPos[i * 3 + 2] = dz * dist * CONFIG.RAY.MAX_REACH

      phase[i] = prng(i * 5 + 3) * Math.PI * 2
    }
    return [seed, phase, distance, initialPos]
  }, [actualCount])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uGrowth: { value: CONFIG.GROWTH.BASE },
      uGrowthMin: { value: CONFIG.GROWTH.BASE },
      uGrowthRange: { value: CONFIG.GROWTH.BASS_MULT },
      uMaxReach: { value: CONFIG.RAY.MAX_REACH },
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
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={actualCount}
          array={initialPositions}
          itemSize={3}
        />
        <bufferAttribute attach="attributes-aSeed" count={actualCount} array={seeds} itemSize={3} />
        <bufferAttribute
          attach="attributes-aPhase"
          count={actualCount}
          array={phases}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aDistance"
          count={actualCount}
          array={distances}
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
