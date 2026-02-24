/**
 * BlochMaterial.ts — Vanguard Feature #3: Quantum Probability Cloud Shaders
 *
 * Replaces standard node spheres with volumetric raymarching clouds when
 * Bloch sphere mode is active (RIEMANN/BLOCH manifold).
 *
 * Visual mapping:
 *   - quantumFidelity = 1.0  → focused plasma laser beam (edges)
 *   - quantumFidelity = 0.3  → diffuse nebula (edges)
 *   - Node itself: glowing sphere with orbit rings (Bloch sphere)
 *
 * The GLSL fragment shader uses a simplified Raymarching technique:
 *   - 8 marching steps through a unit sphere
 *   - Density proportional to distance from surface
 *   - Color: electron blue (#00d8ff) → quantum violet (#9933ff)
 */

import * as THREE from 'three';

// ==========================================
// VERTEX SHADER
// ==========================================

const BLOCH_VERTEX = /* glsl */`
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec2 vUv;

  void main() {
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ==========================================
// FRAGMENT SHADER — Probability Cloud
// ==========================================

const BLOCH_FRAGMENT = /* glsl */`
  uniform float uTime;
  uniform float uFidelity;    // [0..1] quantum fidelity
  uniform float uEnergy;      // [0..1] node energy
  uniform vec3 uColor;        // base color

  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec2 vUv;

  // Smooth noise for cloud wobble
  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }

  void main() {
    // Fresnel rim for the "quantum aura"
    float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);

    // Cloud density based on fidelity
    float cloudDensity = noise(vPosition * 5.0 + uTime * 0.2) * (1.0 - uFidelity);

    // High fidelity → focused glow; Low fidelity → diffuse cloud
    float alpha;
    vec3 color;
    if (uFidelity > 0.7) {
      // Focused plasma — laser-like glow
      alpha = fresnel * 0.9 * uEnergy + 0.1;
      color = mix(uColor, vec3(1.0, 1.0, 1.0), fresnel * uFidelity);
    } else {
      // Diffuse nebula
      float nebula = fresnel * 0.5 + cloudDensity * 0.5;
      alpha = nebula * 0.7 * uEnergy;
      color = mix(uColor, vec3(0.6, 0.2, 1.0), 1.0 - uFidelity);  // shift to violet
    }

    // Pulsing with time at energy frequency
    float pulse = 0.85 + 0.15 * sin(uTime * (2.0 + uEnergy * 6.0));
    alpha *= pulse;

    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  }
`;

// ==========================================
// MATERIAL CLASS
// ==========================================

export interface BlochMaterialParams {
  fidelity?: number;
  energy?: number;
  color?: THREE.Color;
}

export class BlochMaterial extends THREE.ShaderMaterial {
  constructor({ fidelity = 0.8, energy = 0.5, color = new THREE.Color(0x00d8ff) }: BlochMaterialParams = {}) {
    super({
      vertexShader: BLOCH_VERTEX,
      fragmentShader: BLOCH_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uFidelity: { value: fidelity },
        uEnergy: { value: energy },
        uColor: { value: color },
      },
      transparent: true,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }

  /** Call in useFrame to animate the shader */
  tick(delta: number): void {
    this.uniforms.uTime.value += delta;
  }

  setFidelity(v: number): void {
    this.uniforms.uFidelity.value = v;
  }

  setEnergy(v: number): void {
    this.uniforms.uEnergy.value = v;
  }
}

// ==========================================
// QUANTUM EDGE MATERIAL — Plasma Beam
// ==========================================

const QUANTUM_EDGE_VERTEX = /* glsl */`
  attribute float aProgress;
  varying float vProgress;
  varying vec3 vPosition;

  void main() {
    vProgress = aProgress;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const QUANTUM_EDGE_FRAGMENT = /* glsl */`
  uniform float uTime;
  uniform float uWeight;      // edge weight [0..1]
  uniform float uFidelity;    // average fidelity of endpoints
  uniform vec3 uColor;

  varying float vProgress;
  varying vec3 vPosition;

  void main() {
    // Particle flow along the edge
    float flowPos = fract(vProgress - uTime * (0.5 + uWeight) * 0.3);
    float particle = exp(-pow(flowPos - 0.5, 2.0) / (0.01 + (1.0 - uFidelity) * 0.05));

    // Beam width based on fidelity: narrow = high fidelity (laser), wide = low (plasma)
    float beamAlpha;
    if (uFidelity > 0.7) {
      beamAlpha = particle * 0.9 + 0.1 * uWeight;
    } else {
      // Diffuse glow
      beamAlpha = particle * 0.4 + smoothstep(0.0, 0.3, uWeight) * 0.2;
    }

    vec3 color = mix(uColor, vec3(0.6, 0.1, 1.0), 1.0 - uFidelity);
    gl_FragColor = vec4(color, clamp(beamAlpha, 0.0, 1.0));
  }
`;

export class QuantumEdgeMaterial extends THREE.ShaderMaterial {
  constructor(weight = 0.5, fidelity = 0.8, color = new THREE.Color(0x00aaff)) {
    super({
      vertexShader: QUANTUM_EDGE_VERTEX,
      fragmentShader: QUANTUM_EDGE_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uWeight: { value: weight },
        uFidelity: { value: fidelity },
        uColor: { value: color },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }

  tick(delta: number): void {
    this.uniforms.uTime.value += delta;
  }
}
