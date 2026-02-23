import * as THREE from 'three';

const SchrodingerVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SchrodingerFragmentShader = `
  uniform float time;
  uniform float probability;
  uniform vec3 color;
  varying vec2 vUv;

  float noise(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    float edgeFactor = sin(vUv.x * 3.14159); // Suaviza as pontas
    float pulse = (sin(time * 10.0) * 0.5 + 0.5);
    float n = noise(vUv + time * 0.1);
    
    // Se a probabilidade for baixa, a linha "quebra" e falha
    if (n > probability + (pulse * 0.2)) {
      discard;
    }

    float alpha = probability * edgeFactor * (0.5 + pulse * 0.5);
    gl_FragColor = vec4(color, alpha);
  }
`;

export class SchrodingerEdgeMaterial extends THREE.ShaderMaterial {
  constructor(color = new THREE.Color('#00f0ff')) {
    super({
      uniforms: {
        time: { value: 0 },
        probability: { value: 0.5 },
        color: { value: color }
      },
      vertexShader: SchrodingerVertexShader,
      fragmentShader: SchrodingerFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
  }
}
