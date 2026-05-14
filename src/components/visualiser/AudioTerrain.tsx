import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { audioEngine } from '@/audio/AudioEngine'
import { useVisualiserStore } from '@/stores/visualiserStore'
import type { AlbumColour } from '@/hooks/useAlbumColour'

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

  void main() {
    vUv = uv;
    
    float freq = texture2D(uFreq, vec2(uv.x, 0.5)).r;
    float noise = snoise(vec3(position.x * 0.1, position.y * 0.1 + uTime * 0.1, uTime * 0.1));
    
    float elevation = (noise * 1.5 * uBass) + (freq * 1.0);
    vElevation = elevation;
    
    vec3 newPosition = position;
    newPosition.z += elevation;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`

const fragmentShader = `
  varying vec2 vUv;
  varying float vElevation;
  uniform vec3 uColor;

  void main() {
    float mixFactor = clamp(vElevation * 0.2, 0.0, 1.0);
    vec3 color = mix(uColor * 0.3, uColor, mixFactor);
    gl_FragColor = vec4(color, 1.0);
  }
`

export function AudioTerrain({ accent }: { accent: AlbumColour }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)

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
      uFreq: { value: freqTextureRef.current! },
      uColor: { value: new THREE.Color(accent.hex) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accent.hex]
  )
  /* eslint-enable react-hooks/rules-of-hooks, react-hooks/refs */

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uColor.value.set(accent.hex)
    }
  }, [accent.hex])

  useFrame(state => {
    const { clock } = state
    const data = audioEngine.getFrequencyData()
    const { bassPower } = useVisualiserStore.getState()

    if (materialRef.current && freqTextureRef.current) {
      freqDataRef.current.set(data.subarray(0, 128)) // subarray = view, no allocation
      freqTextureRef.current.needsUpdate = true

      materialRef.current.uniforms.uTime.value = clock.elapsedTime
      materialRef.current.uniforms.uBass.value = bassPower
    }
  })

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
      {/* geometry and material must be children of mesh, not group */}
      <mesh>
        <planeGeometry args={[20, 20, 64, 64]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          wireframe
        />
      </mesh>
    </group>
  )
}
