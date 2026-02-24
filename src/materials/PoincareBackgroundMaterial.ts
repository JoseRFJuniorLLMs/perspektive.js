/**
 * PoincareBackgroundMaterial.ts
 *
 * Global background shader for the Poincaré Disk.
 * Implements the "Mathematical Synesthesia" gifted by the user.
 */

import * as THREE from 'three';

const VERTEX_SHADER = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

// Helper to load the fragment shader content
const FRAGMENT_SHADER = /* glsl */`
  // Gifted by the User - authentic hyperbolic breathing
  precision mediump float;

  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_audioAmplitude;

  void main() {
      // Screen-space coordinates normalized to [-1, 1]
      vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);
      float r = length(uv);
      
      if (r >= 1.0) {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
          return;
      }

      // d = ln((1+r)/(1-r)) -> Hyperbolic distance
      float d = log((1.0 + r) / (1.0 - r));

      float speed = 3.0;
      float frequency = 12.0;
      float wave = sin(d * frequency - u_time * speed);
      
      float intensity = smoothstep(0.0, 1.0, wave) * (u_audioAmplitude * 1.5);

      vec3 baseColor = vec3(0.05, 0.0, 0.1); 
      vec3 pulseColor = vec3(0.0, 1.0, 0.8); 
      
      vec3 finalColor = mix(baseColor, pulseColor, intensity);
      finalColor *= (1.0 - r); 

      gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export class PoincareBackgroundMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        u_time: { value: 0 },
        u_audioAmplitude: { value: 0 },
        u_resolution: { value: new THREE.Vector2(1024, 1024) },
      },
      depthWrite: false,
      depthTest: false,
    });
  }
}
