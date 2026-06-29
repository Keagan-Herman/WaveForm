import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useVisualiserStore } from '@/stores/visualiserStore'
import { SIMPLEX_NOISE_3D } from '@/utils/shaders'
import type { AlbumColour } from '@/hooks/useAlbumColour'

// ─── config ──────────────────────────────────────────────────────────────────

const CONFIG = {
  COUNTS: { Low: 8000, Medium: 24000, Epic: 60000 },
  PHYSICS: {
    MAX_RADIUS: 10.0,
    THERMAL_LIFT: 0.48, // upward displacement per unit reach for core particles
    GRAVITY_PULL: 0.2, // downward droop at tips (aDistance^2 * reach * this)
    CURL_EPS: 0.55,
  },
  GROWTH: {
    BASE: 0.055, // near-invisible at rest — fire starts dead
    BASS_MULT: 3.2, // full extension at full bass
    LERP_NORMAL: 5.0,
    LERP_BEAT: 18.0, // snap-attack on beat
    BEAT_BOOST: 0.38, // growth jump on beat edge
  },
  BEAT: {
    PULSE_DECAY: 5.0, // beat-flash decay rate (per second)
  },
  VISUALS: {
    SIZE: 52.0, // base gl_PointSize numerator at camera distance 8
    OPACITY_PEAK: 0.9,
  },
} as const

// ─── shaders ─────────────────────────────────────────────────────────────────

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uGrowth;
  uniform float uGrowthMin;
  uniform float uGrowthRange;
  uniform float uMid;
  uniform float uTreble;
  uniform float uBeatPulse;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uMaxRadius;
  uniform float uOpacity;

  attribute vec3 aSeed;       // unit direction (Y-biased sphere)
  attribute float aPhase;     // per-particle time offset [0, 2π]
  attribute float aDistance;  // radial position in strand [0, 1], pow-biased toward 0
  attribute float aThermal;   // thermal lift weight [0, 1] — upward seeds near core

  varying float vHeat;
  varying float vBaseAlpha;
  varying vec2 vStreakDir;    // screen-space direction for calligraphic streak

  ${SIMPLEX_NOISE_3D}

  const float CURL_EPS = 0.55;

  vec3 curl(vec3 p) {
    float n1 = snoise(p + vec3(0.0, CURL_EPS, 0.0));
    float n2 = snoise(p - vec3(0.0, CURL_EPS, 0.0));
    float n3 = snoise(p + vec3(0.0, 0.0, CURL_EPS));
    float n4 = snoise(p - vec3(0.0, 0.0, CURL_EPS));
    float n5 = snoise(p + vec3(CURL_EPS, 0.0, 0.0));
    float n6 = snoise(p - vec3(CURL_EPS, 0.0, 0.0));
    float cx = (n1 - n2) - (n3 - n4);
    float cy = (n3 - n4) - (n5 - n6);
    float cz = (n5 - n6) - (n1 - n2);
    return normalize(vec3(cx, cy, cz) + 1e-4);
  }

  void main() {
    // Time-phase drives the curl field — mids increase turbulence speed
    float turbSpeed = 0.050 + uMid * 0.26;
    float t = uTime * turbSpeed + aPhase;

    float growth = uGrowth;
    float reach  = aDistance * uMaxRadius * growth;

    // ── core ray ──────────────────────────────────────────────────────────
    vec3 corePos = aSeed * reach;

    // ── thermal rise ──────────────────────────────────────────────────────
    // Upward seeds near the core get the most lift — produces the visible
    // "fire rises" character without a physics sim.
    vec3 thermalLift = vec3(0.0, aThermal * reach * 0.48, 0.0);

    // ── tip gravity ───────────────────────────────────────────────────────
    // aDistance^2 concentrates the droop at the tips, leaving the core stiff.
    float gravDroop = aDistance * aDistance * reach * 0.20;
    vec3 gravity = vec3(0.0, -gravDroop, 0.0);

    // ── curl turbulence ───────────────────────────────────────────────────
    vec3 ns = aSeed * 1.3 + vec3(0.0, 0.0, t * 0.40);
    // Two octaves: coarse structure + fine mid-range detail
    vec3 flow = curl(ns) * 0.88 + curl(ns * 2.6 + 8.3) * 0.36;

    // Turbulence amplitude scales with mids: quiet = laminar, loud = chaotic
    float turbAmp = reach * (0.16 + uMid * 0.55);
    vec3 pos = corePos + thermalLift + gravity + flow * turbAmp;

    // Treble micro-jitter at tips — high-freq scintillation, independent of main flow
    pos += curl(ns * 6.5 + 21.0) * uTreble * aDistance * 0.60;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    // ── point size ────────────────────────────────────────────────────────
    // Core particles run slightly larger (visible glow nucleus).
    float coreBonus = max(0.0, 1.0 - aDistance * 2.6) * 0.55;
    float sizeBoost = (1.0 + coreBonus) * (1.0 + growth * 0.42 + uBeatPulse * 0.52);
    gl_PointSize = uSize * uPixelRatio * sizeBoost * (1.0 / -mvPosition.z);

    // ── heat ──────────────────────────────────────────────────────────────
    // Mapped from audio scalars so the ramp is truly dark at rest.
    // growthNorm maps the bass-driven growth range to [0, 1] via uniforms —
    // CONFIG changes stay in sync automatically.
    float growthNorm    = clamp((growth - uGrowthMin) / uGrowthRange, 0.0, 1.0);
    float proximityHeat = max(0.0, 1.0 - aDistance * 1.75) * 0.26;
    float beatFlash     = uBeatPulse * max(0.0, 1.0 - aDistance * 0.85);
    vHeat = clamp(
      growthNorm * 0.72 + uTreble * 0.30 + proximityHeat + beatFlash * 0.52,
      0.0, 1.0
    );

    // ── streak direction ───────────────────────────────────────────────────
    // Project the vector from origin → particle into clip space.
    // Fire reads as directional because each spark's elongation tracks
    // its actual radial trajectory on screen.
    vec4 screenPos    = projectionMatrix * mvPosition;
    vec4 screenOrigin = projectionMatrix * modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec2 toParticle   = (screenPos.xy / screenPos.w) - (screenOrigin.xy / screenOrigin.w);
    vStreakDir = normalize(toParticle + 1e-4);

    vBaseAlpha = uOpacity;

    gl_Position = screenPos;
  }
`

const fragmentShader = /* glsl */ `
  varying float vHeat;
  varying float vBaseAlpha;
  varying vec2 vStreakDir;

  uniform vec3 uColorWarm;   // dark accent — barely-lit embers
  uniform vec3 uColorHot;    // full accent — energised fire
  uniform vec3 uColorSear;   // near-white tinted by accent — white-hot core

  // 4-stop ramp: black → warm → hot → searing
  // Stops at 0, 0.35, 0.72, 1.0 give perceptually even brightness steps.
  vec3 heatRamp(float h) {
    if (h < 0.35) return mix(vec3(0.0),    uColorWarm, h / 0.35);
    if (h < 0.72) return mix(uColorWarm,   uColorHot,  (h - 0.35) / 0.37);
    return               mix(uColorHot,    uColorSear, (h - 0.72) / 0.28);
  }

  void main() {
    // Calligraphic streak — project point-coord onto the streak axis
    // and compress the perpendicular axis to produce an ink-stroke shape.
    vec2 c    = gl_PointCoord - 0.5;
    vec2 perp = vec2(-vStreakDir.y, vStreakDir.x);
    float along  = dot(c, vStreakDir);
    float across = dot(c, perp);
    // 2.8× elongation along motion; perpendicular stays circular
    vec2 shaped = vec2(along / 2.8, across);
    float dist = length(shaped);
    if (dist > 0.5) discard;

    vec3 color = heatRamp(vHeat);

    // Cold-gate: cold particles exit cleanly rather than fogging the scene
    // as a dim uniform haze.
    float heatGate = smoothstep(0.05, 0.38, vHeat);
    float softEdge = smoothstep(0.5, 0.08, dist);
    float alpha    = softEdge * vBaseAlpha * heatGate;

    gl_FragColor = vec4(color, alpha);
  }
`

// ─── component ───────────────────────────────────────────────────────────────

interface EmberFlowProps {
  accent: AlbumColour
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  // Guard against missing album art — fall back to system-idle blue-grey
  if (isNaN(r) || isNaN(g) || isNaN(b)) return [0.44, 0.51, 0.63]
  return [r, g, b]
}

// Variant of the Murmur3 finalizer — gives a good distribution even for
// sequential small integers, avoiding the clustering the linear prng had.
function prng(seed: number): number {
  let x = seed + 1
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b)
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b)
  x = x ^ (x >>> 16)
  return (x >>> 0) / 0xffffffff
}

export function EmberFlow({ accent }: EmberFlowProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const growthRef = useRef<number>(CONFIG.GROWTH.BASE)
  const beatPulseRef = useRef<number>(0)
  const prevBeatRef = useRef(false)

  const quality = useVisualiserStore(state => state.quality)
  const actualCount = useMemo(
    () => CONFIG.COUNTS[quality as keyof typeof CONFIG.COUNTS] ?? CONFIG.COUNTS.Medium,
    [quality]
  )

  // ── geometry buffers ────────────────────────────────────────────────────
  const [seeds, phases, distances, thermals, initialPositions] = useMemo(() => {
    const seed = new Float32Array(actualCount * 3)
    const phase = new Float32Array(actualCount)
    const dist = new Float32Array(actualCount)
    const therm = new Float32Array(actualCount)
    const initPos = new Float32Array(actualCount * 3)

    const p = (n: number) => prng(n)

    for (let i = 0; i < actualCount; i++) {
      const base = i * 7

      // Direction — 45 % upper-hemisphere, 55 % full sphere.
      // The mix gives the asymmetric upward lean of real fire without
      // looking like a cone or starburst.
      const phi = p(base) * Math.PI * 2
      const cosTheta =
        p(base + 1) < 0.45
          ? Math.sqrt(p(base + 2)) // uniform upper hemisphere (cosθ ∈ [0, 1])
          : 2 * p(base + 2) - 1 // uniform full sphere (cosθ ∈ [-1, 1])
      const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta))

      // Compress Z so the fire reads as a 2-D shape from the front camera
      let dx = sinTheta * Math.cos(phi)
      let dy = cosTheta
      let dz = sinTheta * Math.sin(phi) * 0.5
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1
      dx /= len
      dy /= len
      dz /= len

      seed[i * 3] = dx
      seed[i * 3 + 1] = dy
      seed[i * 3 + 2] = dz

      // Distance — cubic bias packs particles toward the core so the nucleus
      // glows brighter from density, matching the luminance structure of fire.
      const d = Math.pow(p(base + 3), 2.4)
      dist[i] = d

      // Thermal — upward seeds near the core get the most buoyancy lift.
      // dy * 0.65 + 0.35 maps [-1,1] → [-0.30, 1.0]; max(0,…) zeroes downward seeds.
      therm[i] = Math.max(0, dy * 0.65 + 0.35) * (1 - d * 0.42)

      phase[i] = p(base + 4) * Math.PI * 2

      // Initial positions at max extension — sets a correct bounding sphere
      // so Three.js frustum culling doesn't clip the system on bass-heavy frames.
      initPos[i * 3] = dx * d * CONFIG.PHYSICS.MAX_RADIUS
      initPos[i * 3 + 1] = dy * d * CONFIG.PHYSICS.MAX_RADIUS
      initPos[i * 3 + 2] = dz * d * CONFIG.PHYSICS.MAX_RADIUS
    }

    return [seed, phase, dist, therm, initPos]
  }, [actualCount])

  // ── uniforms ─────────────────────────────────────────────────────────────
  // Color stops are initialized to system-idle defaults; the useEffect below
  // applies the real accent immediately and on every subsequent change.
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uGrowth: { value: CONFIG.GROWTH.BASE },
      uGrowthMin: { value: CONFIG.GROWTH.BASE },
      uGrowthRange: { value: CONFIG.GROWTH.BASS_MULT },
      uMaxRadius: { value: CONFIG.PHYSICS.MAX_RADIUS },
      uMid: { value: 0 },
      uTreble: { value: 0 },
      uBeatPulse: { value: 0 },
      uOpacity: { value: CONFIG.VISUALS.OPACITY_PEAK },
      uSize: { value: CONFIG.VISUALS.SIZE },
      uPixelRatio: { value: typeof window !== 'undefined' ? window.devicePixelRatio : 1 },
      uColorWarm: { value: new THREE.Color(0.09, 0.1, 0.13) },
      uColorHot: { value: new THREE.Color(0.44, 0.51, 0.63) },
      uColorSear: { value: new THREE.Color(0.84, 0.86, 0.89) },
    }),
    []
  )

  // Sync album-art colors into shader whenever the accent changes.
  // In-place THREE.Color.setRGB avoids reallocating the uniform object
  // (which would force ShaderMaterial recompile).
  useEffect(() => {
    if (!materialRef.current) return
    const [r, g, b] = hexToRgb(accent.hex)
    const u = materialRef.current.uniforms
    // warm  = 14 % brightness of accent  → barely-lit ember
    u.uColorWarm.value.setRGB(r * 0.14, g * 0.14, b * 0.14)
    // hot   = full accent
    u.uColorHot.value.setRGB(r, g, b)
    // sear  = 70 % white + 30 % accent → white-hot with hue tint
    u.uColorSear.value.setRGB(r * 0.3 + 0.7, g * 0.3 + 0.7, b * 0.3 + 0.7)
  }, [accent.hex])

  // ── frame loop ────────────────────────────────────────────────────────────
  useFrame((state, delta) => {
    const { bassPower, midPower, treblePower, beat, emberFlowOpacity } =
      useVisualiserStore.getState()

    // Edge-detect rising beat: jump growth up and trigger the flash.
    if (beat && !prevBeatRef.current) {
      beatPulseRef.current = 1.0
      growthRef.current = Math.min(
        growthRef.current + CONFIG.GROWTH.BEAT_BOOST,
        CONFIG.GROWTH.BASE + CONFIG.GROWTH.BASS_MULT
      )
    }
    prevBeatRef.current = beat

    beatPulseRef.current = Math.max(0, beatPulseRef.current - delta * CONFIG.BEAT.PULSE_DECAY)

    // Growth tracks bass with a fast attack on beat, smooth release otherwise
    const target = CONFIG.GROWTH.BASE + bassPower * CONFIG.GROWTH.BASS_MULT
    const lerpRate = beat ? CONFIG.GROWTH.LERP_BEAT : CONFIG.GROWTH.LERP_NORMAL
    growthRef.current += (target - growthRef.current) * Math.min(1, delta * lerpRate)

    if (materialRef.current) {
      const u = materialRef.current.uniforms
      u.uTime.value = state.clock.elapsedTime
      u.uGrowth.value = growthRef.current
      u.uMid.value = midPower
      u.uTreble.value = treblePower
      u.uBeatPulse.value = beatPulseRef.current
      u.uOpacity.value = emberFlowOpacity * CONFIG.VISUALS.OPACITY_PEAK
    }

    // Slow rotation — mids increase spin so energetic passages feel more alive
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.00055 + midPower * 0.0015
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
        <bufferAttribute
          attach="attributes-aThermal"
          count={actualCount}
          array={thermals}
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
