/**
 * MinkowskiView.tsx — Spacetime manifold (Minkowski causal structure)
 *
 * Visualizes nodes in (x, t) space with:
 * - Light cones around elite nodes (energy > 0.8)
 * - Timeline axis (t = energy)
 * - Edge coloring by causal type (approximated from weight)
 */

import { useMemo } from 'react';
import { Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { NodeData, EdgeData } from '../components/PerspektiveEngine';

export interface MinkowskiViewProps {
  nodes: NodeData[];
  edges: EdgeData[];
}

const LIGHT_CONE_THRESHOLD = 0.75;

export function MinkowskiView({ nodes, edges }: MinkowskiViewProps) {
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  // Color edges by "causal type":
  //   weight > 0.7  => Timelike  (blue)
  //   weight < 0.3  => Spacelike (red)
  //   otherwise     => Lightlike (yellow)
  const coloredEdges = useMemo(() => {
    return edges.map(e => {
      const src = nodeMap.get(e.source);
      const tgt = nodeMap.get(e.target);
      if (!src || !tgt) return null;
      let color: string;
      if (e.weight > 0.7) color = '#00f0ff'; // Timelike
      else if (e.weight < 0.3) color = '#ef4444'; // Spacelike
      else color = '#f59e0b'; // Lightlike (null geodesic)

      return (
        <Line
          key={`${e.source}-${e.target}`}
          points={[[src.x, src.y, src.z], [tgt.x, tgt.y, tgt.z]]}
          color={new THREE.Color(color).multiplyScalar(1.5)}
          lineWidth={1.5}
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
        />
      );
    }).filter(Boolean);
  }, [edges, nodeMap]);

  const eliteNodes = useMemo(() => nodes.filter(n => n.energy > LIGHT_CONE_THRESHOLD), [nodes]);

  return (
    <group>
      {/* Timeline axis */}
      <Line
        points={[[0, -3, 0], [0, 3, 0]]}
        color="#334155"
        lineWidth={1}
        transparent
        opacity={0.4}
      />
      <Html position={[0.1, 3, 0]}>
        <div style={{ color: '#334155', fontFamily: 'monospace', fontSize: 9, pointerEvents: 'none' }}>t</div>
      </Html>

      {/* Causal spacetime grid */}
      <gridHelper args={[10, 20, 0x1e293b, 0x0f172a]} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} />

      {/* Light cones for elite nodes */}
      {eliteNodes.map(node => (
        <group key={`cone-${node.id}`} position={[node.x, node.y, node.z]}>
          {/* Future cone (up) */}
          <mesh position={[0, 1.2, 0]}>
            <coneGeometry args={[1.2, 2.4, 32, 1, true]} />
            <meshBasicMaterial
              color={new THREE.Color('#00f0ff').multiplyScalar(2)}
              transparent opacity={0.06}
              side={THREE.DoubleSide} depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          {/* Past cone (down) */}
          <mesh position={[0, -1.2, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[1.2, 2.4, 32, 1, true]} />
            <meshBasicMaterial
              color={new THREE.Color('#ff00ff').multiplyScalar(2)}
              transparent opacity={0.06}
              side={THREE.DoubleSide} depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          {/* Horizon ring */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.9, 1.0, 48]} />
            <meshBasicMaterial
              color={new THREE.Color('#f59e0b').multiplyScalar(2)}
              toneMapped={false} transparent opacity={0.4}
              side={THREE.DoubleSide} depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>
      ))}

      {/* Causal edges */}
      {coloredEdges}
    </group>
  );
}
