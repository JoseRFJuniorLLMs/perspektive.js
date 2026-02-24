/**
 * PoincareNodeMaterial.ts
 *
 * Custom ShaderMaterial for nodes in the Poincaré Disk.
 * Implements "Hyperbolic Breathing" and "Echo of the Abyss" shockwaves.
 */

import * as THREE from 'three';

const POINCARE_NODE_VERTEX = /* glsl */`
  varying vec3 vPosition;
  varying vec2 vUv;
  
  uniform float uTime;
  uniform float uAudioAmplitude;
  uniform float uEnergy;

  void main() {
    vPosition = position;
    vUv = uv;

    // Hyperbolic Breathing: modulate scale based on audio amplitude + node energy
    float pulse = 1.0 + (uAudioAmplitude * 0.3) * (0.5 + uEnergy * 0.5);
    vec3 animatedPos = position * pulse;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(animatedPos, 1.0);
  }
`;

const POINCARE_NODE_FRAGMENT = /* glsl */`
  varying vec3 vPosition;
  varying vec2 vUv;

  uniform vec3 uColor;
  uniform float uTime;
  uniform float uAudioAmplitude;
  uniform float uEnergy;

  void main() {
    float d = length(vUv - 0.5) * 2.0; // Distance from center of the node [0, 1]
    
    // Core glow
    float glow = exp(-d * 3.0) * (0.8 + uAudioAmplitude * 0.5);
    
    // Echo of the Abyss: Concentric shockwaves emitting from the center
    float wave = sin(d * 10.0 - uTime * 5.0) * 0.5 + 0.5;
    float shockwave = smoothstep(0.45, 0.5, wave) * smoothstep(0.55, 0.5, wave) * uAudioAmplitude;
    
    vec3 finalColor = uColor * (glow + shockwave * 2.0);
    
    // Add extra energy flare
    if (uEnergy > 0.8) {
      finalColor += vec3(1.0, 0.0, 1.0) * uAudioAmplitude * 0.5;
    }

    float alpha = smoothstep(1.0, 0.8, d) * (glow + shockwave);
    gl_FragColor = vec4(finalColor, clamp(alpha, 0.0, 1.0));
  }
`;

export interface PoincareNodeMaterialParams {
  color?: THREE.Color;
  energy?: number;
}

export class PoincareNodeMaterial extends THREE.ShaderMaterial {
  constructor({ color = new THREE.Color(0x00d8ff), energy = 0.5 }: PoincareNodeMaterialParams = {}) {
    super({
      vertexShader: POINCARE_NODE_VERTEX,
      fragmentShader: POINCARE_NODE_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uAudioAmplitude: { value: 0 },
        uColor: { value: color },
        uEnergy: { value: energy },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }

  tick(delta: number, amplitude: number): void {
    this.uniforms.uTime.value += delta;
    this.uniforms.uAudioAmplitude.value = amplitude;
  }
}
