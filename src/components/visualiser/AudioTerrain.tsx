import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { audioEngine } from '@/audio/AudioEngine'
import { useVisualiserStore } from '@/stores/visualiserStore'
import type { AlbumColour } from '@/hooks/useAlbumColour'

const CONFIG = {
  GEOMETRY: {
    SIZE: 20,
    DETAIL: 64,
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

/**
 * AudioTerrain Shader Logic:
 *
 * Vertex Shader:
 * - Uses Simplex 3D Noise for base organic movement.
 * - Samples a frequency DataTexture (uFreq) along the X-axis to drive local elevation.
 * - Elevation = (Noise * Bass) + FrequencyData.
 * - Displaces the Z-position of plane vertices based on the combined elevation.
 */
const vertexShader = `
  varying vec2 vUv;
  varying float vElevation;
  uniform float uTime;
  uniform float uBass;
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

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 4; i++) {
      value += amplitude * snoise(p * frequency);
      p.y += 10.0; // Shift to reduce directional artifacts
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return value;
  }

  void main() {
    vUv = uv;
    
    // Sample frequency with a sharpening curve
    float freqRaw = texture2D(uFreq, vec2(uv.x, 0.5)).r;
    float freq = pow(freqRaw, 1.5) * ${CONFIG.ANIMATION.FREQ_MULT.toFixed(1)};

    // Multi-octave noise for organic terrain
    vec3 noisePos = vec3(
      position.x * ${CONFIG.ANIMATION.NOISE_SCALE.toFixed(1)},
      position.y * ${CONFIG.ANIMATION.NOISE_SCALE.toFixed(1)} + uTime * ${CONFIG.ANIMATION.NOISE_SPEED.toFixed(1)},
      uTime * ${CONFIG.ANIMATION.NOISE_SPEED.toFixed(2)}
    );
    float noise = fbm(noisePos) * ${CONFIG.ANIMATION.BASS_MULT.toFixed(1)} * uBass;

    // Combine noise and frequency for complex displacement
    // We multiply frequency by a distance-from-center mask to keep edges cleaner
    float dist = distance(uv, vec2(0.5));
    float mask = smoothstep(0.5, 0.2, dist);
    
    float elevation = noise + (freq * mask * 2.5);
    vElevation = elevation;
    
    vec3 newPosition = position;
    newPosition.z += elevation;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`

/**
 * Fragment Shader:
 * - Mixes between a dark base color and the album's accent color based on elevation.
 * - Adds a sharper exponential glow effect on high peaks.
 * - Improved rim lighting and slope-based shading.
 */
const fragmentShader = `
  varying vec2 vUv;
  varying float vElevation;
  uniform vec3 uColor;
  uniform vec3 uAccent;
  uniform float uOpacity;

  void main() {
    // Calculate color based on elevation
    float mixFactor = clamp(vElevation * ${CONFIG.COLOR.MIX_MULT.toFixed(1)}, 0.0, 1.0);

    // Dynamic slope calculation for lighting
    float dx = dFdx(vElevation);
    float dy = dFdy(vElevation);
    float slope = sqrt(dx*dx + dy*dy) * 12.0;

    // Deep space base color
    vec3 baseColor = mix(uColor * 0.02, uAccent * 0.4, mixFactor);
    vec3 color = baseColor;

    // Sharp highlights on ridges
    color += uAccent * smoothstep(0.3, 1.0, slope) * 0.4;

    // Sharper exponential glow on peaks
    color += pow(mixFactor, 4.0) * 1.2 * uAccent;

    // Enhanced rim lighting from front-facing normal approximation
    vec3 normal = normalize(vec3(-dx, -dy, 1.0));
    float rim = 1.0 - max(dot(normal, vec3(0.0, 0.0, 1.0)), 0.0);
    color += uAccent * pow(rim, 3.0) * 0.6;

    gl_FragColor = vec4(color, uOpacity);
  }
`

export function AudioTerrain({ accent }: { accent: AlbumColour }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const terrainOpacity = useVisualiserStore(state => state.terrainOpacity)

  const freqDataRef = useRef(new Uint8Array(128))
  const freqTextureRef = useRef<THREE.DataTexture | null>(null)

  /* eslint-disable react-hooks/refs */
  if (!freqTextureRef.current) {
    freqTextureRef.current = new THREE.DataTexture(freqDataRef.current, 128, 1, THREE.RedFormat)
    freqTextureRef.current.needsUpdate = true
  }

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBass: { value: 0 },
      uFreq: { value: freqTextureRef.current! },
      uColor: { value: new THREE.Color(accent.hex) },
      uAccent: { value: new THREE.Color(accent.palette.accent) },
      uOpacity: { value: 1.0 },
    }),
    [accent.hex, accent.palette.accent]
  )
  /* eslint-enable react-hooks/refs */

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uColor.value.set(accent.hex)
      materialRef.current.uniforms.uAccent.value.set(accent.palette.accent)
    }
  }, [accent.hex, accent.palette.accent])

  useEffect(() => {
    return () => {
      freqTextureRef.current?.dispose()
    }
  }, [])

  useFrame(state => {
    const { clock } = state
    const data = audioEngine.getFrequencyData()
    const { bassPower } = useVisualiserStore.getState()

    if (materialRef.current && freqTextureRef.current) {
      freqDataRef.current.set(data.subarray(0, 128)) // subarray = view, no allocation
      freqTextureRef.current.needsUpdate = true

      materialRef.current.uniforms.uTime.value = clock.elapsedTime
      materialRef.current.uniforms.uBass.value = bassPower
      materialRef.current.uniforms.uOpacity.value = terrainOpacity
    }
  })

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
      {/* Terrain Mesh */}
      <mesh>
        <planeGeometry args={[CONFIG.GEOMETRY.SIZE, CONFIG.GEOMETRY.SIZE, CONFIG.GEOMETRY.DETAIL, CONFIG.GEOMETRY.DETAIL]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent
          wireframe
        />
      </mesh>

      {/* Reflective Floor */}
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
