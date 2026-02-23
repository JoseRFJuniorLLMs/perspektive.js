/**
 * EnergyPulse.tsx — Animated pulse rings for Übermensch nodes
 *
 * Renders expanding ring halos around high-energy nodes (energy > threshold).
 * Each ring oscillates sinusoidally and fades as it expands.
 *
 * Lives INSIDE the R3F Canvas.
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getVisualRadius } from '../../math/poincare';
import type { NodeData, ManifoldType } from '../PerspektiveEngine';

// ==========================================
// TYPES
// ==========================================

export interface EnergyPulseProps {
  nodes: NodeData[];
  manifold: ManifoldType;
  /** Energy threshold above which nodes get a pulse. Default: 0.8 */
  threshold?: number;
  /** Max number of pulsing nodes. Default: 20 */
  maxPulsing?: number;
}

// ==========================================
// SINGLE PULSE RING (for one node)
// ==========================================

const PulseRing = ({
  node,
  manifold,
  phaseOffset,
}: {
  node: NodeData;
  manifold: ManifoldType;
  phaseOffset: number;
}) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const baseRadius = useMemo(() => {
    const br = 0.01 + node.energy * 0.03;
    return manifold === 'POINCARE' ? getVisualRadius(node, br) : br;
  }, [node, manifold]);

  const hdrColor = useMemo(() => {
    return new THREE.Color('#ff00ff').multiplyScalar(3.0);
  }, []);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const t = (clock.getElapsedTime() * 2.5 + phaseOffset) % 1.0;
    // t: 0 → 1, ring starts at baseRadius, expands and fades
    const scale = baseRadius * (1.5 + t * 6.0);
    const opacity = Math.pow(1.0 - t, 1.5) * 0.6;

    mesh.scale.set(scale, scale, 1);
    mesh.position.set(node.x, node.y, node.z + 0.003);

    const mat = mesh.material as THREE.MeshBasicMaterial;
    mat.opacity = opacity;

    if (manifold === 'RIEMANN') mesh.lookAt(0, 0, 0);
  });

  return (
    <mesh
      ref={meshRef}
      position={[node.x, node.y, node.z + 0.003]}
      scale={[baseRadius, baseRadius, 1]}
    >
      <ringGeometry args={[0.85, 1.0, 48]} />
      <meshBasicMaterial
        color={hdrColor}
        toneMapped={false}
        transparent
        opacity={0.5}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
};

// ==========================================
// MAIN COMPONENT
// ==========================================

export const EnergyPulse = ({
  nodes,
  manifold,
  threshold = 0.8,
  maxPulsing = 20,
}: EnergyPulseProps) => {
  const eliteNodes = useMemo(() => {
    return nodes
      .filter(n => n.energy >= threshold)
      .sort((a, b) => b.energy - a.energy)
      .slice(0, maxPulsing);
  }, [nodes, threshold, maxPulsing]);

  if (eliteNodes.length === 0) return null;

  return (
    <group>
      {eliteNodes.map((node, i) => (
        // Each elite node gets TWO staggered rings for depth
        <>
          <PulseRing key={`${node.id}-a`} node={node} manifold={manifold} phaseOffset={i * 0.2} />
          <PulseRing key={`${node.id}-b`} node={node} manifold={manifold} phaseOffset={i * 0.2 + 0.5} />
        </>
      ))}
    </group>
  );
};
