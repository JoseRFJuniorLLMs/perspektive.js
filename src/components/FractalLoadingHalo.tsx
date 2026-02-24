/**
 * FractalLoadingHalo.tsx — Visual feedback for fractal lazy loading
 *
 * Displays an animated ring at the edge of the Poincaré disk while
 * a new subgraph tile is being fetched from the API. The effect
 * resembles a "portal" opening in the hyperbolic space.
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { FractalRegion } from '../streaming/useFractalLoader';

interface FractalLoadingHaloProps {
  /** Whether a fetch is currently in progress */
  isLoading: boolean;
  /** The region being loaded */
  region: FractalRegion | null;
}

const FractalLoadingHalo: React.FC<FractalLoadingHaloProps> = ({ isLoading, region }) => {
  const ringRef = useRef<THREE.Mesh>(null);
  const outerRingRef = useRef<THREE.Mesh>(null);
  const t = useRef(0);

  useFrame((_, delta) => {
    if (!isLoading) return;
    t.current += delta;
    if (ringRef.current) {
      ringRef.current.rotation.z = t.current * 3;
      const scale = 1 + 0.1 * Math.sin(t.current * 8);
      ringRef.current.scale.setScalar(scale);
    }
    if (outerRingRef.current) {
      outerRingRef.current.rotation.z = -t.current * 1.5;
      const mat = outerRingRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.3 + 0.3 * Math.sin(t.current * 5);
    }
  });

  if (!isLoading || !region) return null;

  const { cx, cy, radius } = region;

  return (
    <group position={[cx, cy, 0.05]}>
      {/* Inner spinning ring */}
      <mesh ref={ringRef}>
        <ringGeometry args={[radius * 0.85, radius * 0.95, 64]} />
        <meshBasicMaterial
          color="#00f0ff"
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Outer slower ring */}
      <mesh ref={outerRingRef}>
        <ringGeometry args={[radius * 0.95, radius * 1.05, 64]} />
        <meshBasicMaterial
          color="#00aaff"
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Text label */}
      <Html center position={[0, 0, 0.01]}>
        <div style={{
          color: '#00f0ff',
          fontFamily: 'monospace',
          fontSize: 10,
          background: 'rgba(0,0,0,0.6)',
          padding: '2px 6px',
          borderRadius: 4,
          border: '1px solid #00f0ff22',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          animation: 'none',
        }}>
          ⟳ EXPANDING...
        </div>
      </Html>
    </group>
  );
};

export default FractalLoadingHalo;
