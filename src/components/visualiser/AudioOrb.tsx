import { useRef, useMemo, useEffect, forwardRef, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { audioEngine } from '@/audio/AudioEngine'
import { useVisualiserStore } from '@/stores/visualiserStore'
import type { AlbumColour } from '@/hooks/useAlbumColour'

// Configuration constants
const CONFIG = {
  GEOMETRY: {
    SHELL_RADIUS: 2,
    SHELL_DETAIL: 20,
    CORE_RADIUS: 0.8,
    POINTS_RADIUS: 1.5,
  },
  ANIMATION: {
    BASS_SMOOTHING: 0.12,
    BEAT_SMOOTHING: 0.15,
    CRACK_SMOOTHING: 0.1,
    ROTATION_SMOOTHING: 0.1,
    COLOR_CYCLE_SPEED: 0.15,
    BASE_ROT_Y: 0.004,
    BASE_ROT_Z: 0.002,
    BASS_ROT_Y_MULT: 0.008,
    BASS_ROT_Z_MULT: 0.006,
  },
  SHADERS: {
    DISPLACEMENT_MULT: 0.12,
    CRACK_THRESHOLD: 0.8,
  }
}

const vertexShader = `
  varying vec2 vUv;
  varying float vDisplacement;
  varying vec3 vPosition;
  varying vec3 vNormal;
  uniform float uTime;
  uniform float uBass;
  uniform float uBeat;
  uniform sampler2D uFreq;

  //	Simplex 3D Noise 
  //	by Ian McEwan, Ashima Arts
  vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

  float snoise(vec3 v){ 
    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy) );
    vec3 x0 =   v - i + dot(i, C.xxx) ;

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );

    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

    i = mod(i, 289.0 ); 
    vec4 p = permute( permute( permute( 
               i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
             + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

    float n_ = 1.0/7.0; 
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z *ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                  dot(p2,x2), dot(p3,x3) ) );
  }

  void main() {
    vUv = uv;
    
    float freq = texture2D(uFreq, vec2(uv.x, 0.5)).r;
    
    // More organic and extreme morphing
    float noiseScale = 0.2 + uBass * 0.3;
    float noiseSpeed = 0.2 + uBass * 0.5;
    float noise = snoise(vec3(
      position.x * noiseScale + uTime * noiseSpeed,
      position.y * noiseScale + uTime * noiseSpeed * 1.1,
      position.z * noiseScale + uTime * noiseSpeed * 1.2
    ));

    // Stretchy distortions — subtle breathe
    float stretch = sin(position.y * 1.5 + uTime * 0.5) * uBass * 0.3;

    // Smoothed displacement
    float displacement = (noise * 2.0 * uBass) + (freq * 1.2) + (uBeat * 0.4) + stretch;
    vDisplacement = displacement;
    
    vec3 newPosition = position + normal * displacement;

    vPosition = newPosition;
    vNormal = normal;

    // Add some non-spherical expansion — more fluid
    newPosition.x += sin(uTime * 1.2 + position.y * 0.5) * uBass * 0.2;
    newPosition.z += cos(uTime * 1.2 + position.x * 0.5) * uBass * 0.2;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`

const fragmentShader = `
  varying vec2 vUv;
  varying float vDisplacement;
  varying vec3 vPosition;
  varying vec3 vNormal;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform float uColorMix;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uCrack;

  void main() {
    float intensity = vDisplacement * ${CONFIG.SHADERS.DISPLACEMENT_MULT.toFixed(2)};

    // Color cycling logic
    vec3 color;
    if (uColorMix < 1.0) {
      color = mix(uColor1, uColor2, uColorMix);
    } else if (uColorMix < 2.0) {
      color = mix(uColor2, uColor3, uColorMix - 1.0);
    } else {
      color = mix(uColor3, uColor1, uColorMix - 2.0);
    }

    color += vec3(intensity * 0.4, intensity * 0.2, intensity * 0.6);

    // Crack effect
    float crackPattern = sin(vUv.x * 50.0) * cos(vUv.y * 50.0);
    if (uCrack > 0.5 && crackPattern > 0.8) {
      color += vec3(1.0, 0.8, 0.5) * uCrack;
      discard; // Create literal holes
    }

    gl_FragColor = vec4(color, uOpacity);
  }
`

export const AudioOrb = forwardRef<THREE.Mesh, { accent: AlbumColour }>(({ accent }, ref) => {
  const meshRef = useRef<THREE.Group>(null)
  const shellRef = useRef<THREE.Mesh>(null)
  const coreRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const pointsMatRef = useRef<THREE.PointsMaterial>(null)
  const colorMixRef = useRef(0)

  const combinedRef = useCallback((node: THREE.Mesh | null) => {
    if (shellRef.current !== node) {
      (shellRef as React.MutableRefObject<THREE.Mesh | null>).current = node;
    }
    if (ref) {
      if (typeof ref === 'function') ref(node);
      else (ref as React.MutableRefObject<THREE.Mesh | null>).current = node;
    }
  }, [ref]);
  const orbOpacity = useVisualiserStore(state => state.orbOpacity)

  const freqDataRef = useRef(new Uint8Array(128))
  const freqTextureRef = useRef<THREE.DataTexture | null>(null)

  if (!freqTextureRef.current) {
    freqTextureRef.current = new THREE.DataTexture(freqDataRef.current, 128, 1, THREE.RedFormat)
    freqTextureRef.current.needsUpdate = true
  }

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBass: { value: 0 },
      uBeat: { value: 0 },
      uFreq: { value: freqTextureRef.current! },
      uColor1: { value: new THREE.Color(accent.palette.primary) },
      uColor2: { value: new THREE.Color(accent.palette.secondary) },
      uColor3: { value: new THREE.Color(accent.palette.accent) },
      uColorMix: { value: 0 },
      uOpacity: { value: 1.0 },
      uCrack: { value: 0 },
    }),
    [accent.palette.primary, accent.palette.secondary, accent.palette.accent]
  )

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uColor1.value.set(accent.palette.primary)
      materialRef.current.uniforms.uColor2.value.set(accent.palette.secondary)
      materialRef.current.uniforms.uColor3.value.set(accent.palette.accent)
    }
  }, [accent])

  const smoothedBass = useRef(0)
  const smoothedRotation = useRef({ y: 0, z: 0 })

  useFrame((state, delta) => {
    const { clock } = state
    const data = audioEngine.getFrequencyData()
    const { bassPower, beat } = useVisualiserStore.getState()

    // Inertia for bass reactivity
    smoothedBass.current += (bassPower - smoothedBass.current) * CONFIG.ANIMATION.BASS_SMOOTHING

    if (materialRef.current && freqTextureRef.current) {
      // Sub-sample frequency data for smoother texture
      freqDataRef.current.set(data.subarray(0, 128))
      freqTextureRef.current.needsUpdate = true

      materialRef.current.uniforms.uTime.value = clock.elapsedTime
      materialRef.current.uniforms.uBass.value = smoothedBass.current
      materialRef.current.uniforms.uOpacity.value = orbOpacity

      // Smoothly pulse uBeat with inertia
      const targetBeat = beat ? 1.0 : 0.0
      materialRef.current.uniforms.uBeat.value +=
        (targetBeat - materialRef.current.uniforms.uBeat.value) * CONFIG.ANIMATION.BEAT_SMOOTHING

      // Crack effect on drops/bass peaks
      const crackTarget = smoothedBass.current > 0.8 ? 1.0 : 0.0
      materialRef.current.uniforms.uCrack.value += (crackTarget - materialRef.current.uniforms.uCrack.value) * CONFIG.ANIMATION.CRACK_SMOOTHING

      // Cycle colors more gracefully
      colorMixRef.current =
        (colorMixRef.current + delta * (CONFIG.ANIMATION.COLOR_CYCLE_SPEED + smoothedBass.current * 0.3)) % 3.0
      materialRef.current.uniforms.uColorMix.value = colorMixRef.current
    }

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
      const s = 1.0 + smoothedBass.current * 0.5
      coreRef.current.scale.set(s, s, s)
    }

    if (pointsMatRef.current) {
      pointsMatRef.current.opacity = orbOpacity * smoothedBass.current
    }
  })

  return (
    <group ref={meshRef}>
      {/* Outer Shell */}
      <mesh ref={combinedRef}>
        <icosahedronGeometry args={[CONFIG.GEOMETRY.SHELL_RADIUS, CONFIG.GEOMETRY.SHELL_DETAIL]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent
          wireframe
        />
      </mesh>

      {/* Inner Core */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[CONFIG.GEOMETRY.CORE_RADIUS, 32, 32]} />
        <meshBasicMaterial
          color={accent.palette.accent}
          transparent
          opacity={orbOpacity * 0.8}
        />
      </mesh>

      {/* Volumetric light rays (simulated with points) */}
      <points>
        <sphereGeometry args={[CONFIG.GEOMETRY.POINTS_RADIUS, 64, 64]} />
        <pointsMaterial
          ref={pointsMatRef}
          color={accent.palette.accent}
          size={0.05}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  )
})
