/**
 * EmotionView.tsx — Russell Circumplex (Valence × Arousal)
 *
 * Renders the 2D emotional circumplex inside R3F Canvas:
 * - Axes: X = Valence [-1, 1], Y = Arousal [-1, 1]
 * - Quadrant labels: Alegria (joy), Raiva (anger), Calma (calm), Tristeza (sadness)
 * - Circumference ring at radius 1
 * - Density heatmap by quadrant (blended colored regions)
 * - Bidirectional selection sync via useSelection
 */

import { useMemo, useCallback } from 'react';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useSelection } from '../interaction/useSelection';
import type { NodeData, EdgeData } from '../components/PerspektiveEngine';

// ==========================================
// TYPES
// ==========================================

export interface EmotionViewProps {
  nodes: NodeData[];
  edges?: EdgeData[];
}

// ==========================================
// CONSTANTS
// ==========================================

const QUADRANTS = [
  { label: 'ALEGRIA',  x:  0.55,  y:  0.55, color: '#f59e0b' },
  { label: 'RAIVA',    x: -0.55,  y:  0.55, color: '#ef4444' },
  { label: 'CALMA',    x:  0.55,  y: -0.55, color: '#00ff66' },
  { label: 'TRISTEZA', x: -0.55,  y: -0.55, color: '#8b5cf6' },
] as const;

const TYPE_COLORS: Record<string, number> = {
  Episodic:      0x00f0ff,
  Concept:       0xf59e0b,
  DreamSnapshot: 0x8b5cf6,
  Pruned:        0x1e293b,
};

// ==========================================
// CIRCUMFERENCE RING
// ==========================================

const CircumplexRing = () => {
  const points = useMemo<[number, number, number][]>(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      pts.push([Math.cos(a), Math.sin(a), 0]);
    }
    return pts;
  }, []);

  return (
    <Line
      points={points}
      color={new THREE.Color('#334155').multiplyScalar(1.5)}
      lineWidth={1}
      transparent
      opacity={0.5}
    />
  );
};

// ==========================================
// MAIN COMPONENT
// ==========================================

export function EmotionView({ nodes, edges: _edges = [] }: EmotionViewProps) {
  const { selectNode, selectedIds } = useSelection();

  // Quadrant density: count nodes per quadrant
  const quadrantDensity = useMemo(() => {
    const counts = { q1: 0, q2: 0, q3: 0, q4: 0 };
    for (const n of nodes) {
      const v = n.valence ?? 0;
      const a = (n.arousal ?? 0.5) * 2 - 1;
      if (v >= 0 && a >= 0) counts.q1++;
      else if (v < 0 && a >= 0) counts.q2++;
      else if (v >= 0 && a < 0) counts.q3++;
      else counts.q4++;
    }
    const max = Math.max(1, ...Object.values(counts));
    return {
      q1: counts.q1 / max,
      q2: counts.q2 / max,
      q3: counts.q3 / max,
      q4: counts.q4 / max,
    };
  }, [nodes]);

  const handleNodeClick = useCallback((nodeId: string) => {
    selectNode(nodeId);
  }, [selectNode]);

  return (
    <group>
      {/* Density heatmap by quadrant */}
      {[
        { offset: [0.5, 0.5], density: quadrantDensity.q1, color: 0xf59e0b },
        { offset: [-0.5, 0.5], density: quadrantDensity.q2, color: 0xef4444 },
        { offset: [0.5, -0.5], density: quadrantDensity.q3, color: 0x00ff66 },
        { offset: [-0.5, -0.5], density: quadrantDensity.q4, color: 0x8b5cf6 },
      ].map(({ offset, density, color }, i) => (
        <mesh key={`quad-${i}`} position={[offset[0], offset[1], -0.05]}>
          <planeGeometry args={[1.05, 1.05]} />
          <meshBasicMaterial
            color={new THREE.Color(color)}
            transparent
            opacity={density * 0.12}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}

      {/* Axes */}
      <Line points={[[-1.1, 0, 0], [1.1, 0, 0]]} color="#334155" transparent opacity={0.6} lineWidth={1} />
      <Line points={[[0, -1.1, 0], [0, 1.1, 0]]} color="#334155" transparent opacity={0.6} lineWidth={1} />

      {/* Circumference ring */}
      <CircumplexRing />

      {/* Quadrant labels */}
      {QUADRANTS.map(({ label, x, y, color }) => (
        <Html key={label} position={[x, y, 0]} center>
          <div style={{
            color,
            fontFamily: 'monospace',
            fontSize: 10,
            fontWeight: 'bold',
            textShadow: `0 0 8px ${color}`,
            pointerEvents: 'none',
            letterSpacing: 1,
          }}>
            {label}
          </div>
        </Html>
      ))}

      {/* Axis labels */}
      <Html position={[1.15, 0, 0]} center>
        <div style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 9, pointerEvents: 'none' }}>VALENCE +</div>
      </Html>
      <Html position={[0, 1.15, 0]} center>
        <div style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 9, pointerEvents: 'none' }}>AROUSAL +</div>
      </Html>

      {/* Nodes */}
      {nodes.map(node => {
        const v = node.valence ?? 0;
        const a = (node.arousal ?? 0.5) * 2 - 1;

        // Skip nodes outside the disk
        if (Math.sqrt(v * v + a * a) > 1.1) return null;

        const selected = selectedIds.has(node.id);
        const radius = 0.012 + node.energy * 0.025;
        const colorHex = TYPE_COLORS[node.node_type] ?? 0x00ff66;
        const color = new THREE.Color(colorHex).multiplyScalar(node.energy > 0.8 ? 3.0 : 1.5);

        return (
          <group key={node.id}>
            <mesh
              position={[v, a, 0.01]}
              onClick={() => handleNodeClick(node.id)}
            >
              <circleGeometry args={[radius, 16]} />
              <meshBasicMaterial color={color} toneMapped={false} />
            </mesh>
            {/* Selection ring */}
            {selected && (
              <mesh position={[v, a, 0.02]}>
                <ringGeometry args={[radius * 1.4, radius * 2.0, 16]} />
                <meshBasicMaterial
                  color={new THREE.Color('#ff00ff').multiplyScalar(3)}
                  toneMapped={false} transparent opacity={0.8}
                  side={THREE.DoubleSide} depthWrite={false}
                  blending={THREE.AdditiveBlending}
                />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}
