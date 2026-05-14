import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { audioEngine } from '@/audio/AudioEngine'
import { useVisualiserStore } from '@/stores/visualiserStore'
import type { AlbumColour } from '@/hooks/useAlbumColour'

const vertexShader = `
  varying vec2 vUv;
  varying float vDisplacement;
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

    // Add some non-spherical expansion — more fluid
    newPosition.x += sin(uTime * 1.2 + position.y * 0.5) * uBass * 0.2;
    newPosition.z += cos(uTime * 1.2 + position.x * 0.5) * uBass * 0.2;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`

const fragmentShader = `
  varying vec2 vUv;
  varying float vDisplacement;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform float uColorMix;
  uniform float uTime;

  void main() {
    float intensity = vDisplacement * 0.12;

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
    gl_FragColor = vec4(color, 0.85);
  }
`

export function AudioOrb({ accent }: { accent: AlbumColour }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const colorMixRef = useRef(0)

  const freqDataRef = useRef(new Uint8Array(128))
  const freqTextureRef = useRef<THREE.DataTexture | null>(null)

  /* eslint-disable react-hooks/rules-of-hooks, react-hooks/refs */
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
    }),
    [accent.palette.primary, accent.palette.secondary, accent.palette.accent]
  )
  /* eslint-enable react-hooks/rules-of-hooks, react-hooks/refs */

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
    smoothedBass.current += (bassPower - smoothedBass.current) * 0.12

    if (materialRef.current && freqTextureRef.current) {
      // Sub-sample frequency data for smoother texture
      freqDataRef.current.set(data.subarray(0, 128))
      freqTextureRef.current.needsUpdate = true

      materialRef.current.uniforms.uTime.value = clock.elapsedTime
      materialRef.current.uniforms.uBass.value = smoothedBass.current

      // Smoothly pulse uBeat with inertia
      const targetBeat = beat ? 1.0 : 0.0
      materialRef.current.uniforms.uBeat.value +=
        (targetBeat - materialRef.current.uniforms.uBeat.value) * 0.15

      // Cycle colors more gracefully
      colorMixRef.current =
        (colorMixRef.current + delta * (0.15 + smoothedBass.current * 0.3)) % 3.0
      materialRef.current.uniforms.uColorMix.value = colorMixRef.current
    }

    if (meshRef.current) {
      // Rotation with inertia
      const targetRotY = 0.004 + smoothedBass.current * 0.008
      const targetRotZ = 0.002 + smoothedBass.current * 0.006

      smoothedRotation.current.y += (targetRotY - smoothedRotation.current.y) * 0.1
      smoothedRotation.current.z += (targetRotZ - smoothedRotation.current.z) * 0.1

      meshRef.current.rotation.y += smoothedRotation.current.y
      meshRef.current.rotation.z += smoothedRotation.current.z
    }
  })

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[2, 20]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        wireframe
      />
    </mesh>
  )
}
