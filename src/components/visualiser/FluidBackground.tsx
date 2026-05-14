import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useVisualiserStore } from '@/stores/visualiserStore'
import type { AlbumColour } from '@/hooks/useAlbumColour'

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  uniform float uTime;
  uniform float uBass;
  uniform vec3 uColor;
  varying vec2 vUv;

  // Simplex 2D noise
  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
             -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
    + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
      dot(x12.zw,x12.zw)), 0.0);
    m = m*m ;
    m = m*m ;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    vec2 uv = vUv;
    float n = snoise(uv * 3.0 + uTime * 0.2) * 0.5 + 0.5;
    float d = snoise(uv * 10.0 - uTime * 0.5 + uBass * 2.0) * 0.5 + 0.5;

    vec3 color = mix(uColor * 0.2, uColor, n * d);
    color += uBass * 0.1 * uColor;

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
  })

  useEffect(() => {
    uniforms.current.uColor.value.set(accent.hex)
  }, [accent.hex])

  useFrame(state => {
    if (!meshRef.current) return
    const { bassPower } = useVisualiserStore.getState()
    uniforms.current.uTime.value = state.clock.elapsedTime
    uniforms.current.uBass.value = THREE.MathUtils.lerp(uniforms.current.uBass.value, bassPower, 0.1)
  })

  return (
    <mesh ref={meshRef} scale={[viewport.width, viewport.height, 1]}>
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
