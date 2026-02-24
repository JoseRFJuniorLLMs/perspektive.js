/**
 * PathHighlight.tsx — P2: A* Path Visualization
 *
 * Animates the result of the A* (or any shortest-path) algorithm
 * as a pulsing highlighted trail through the graph.
 *
 * Visual: A bright pulse travels along the path edges,
 * nodes along the path glow with a sequential brightening effect.
 */

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { NodeData } from './PerspektiveEngine';

// ==========================================
// TYPES
// ==========================================

export interface PathHighlightProps {
  nodes: NodeData[];
  /** Ordered list of node IDs forming the path (from A* or BFS) */
  pathIds: string[];
  /** Color of the highlight */
  color?: string;
  /** Whether to show distance labels along the path */
  showDistances?: boolean;
}

// ==========================================
// ANIMATED PULSE EDGE
// ==========================================

const PulseEdge: React.FC<{
  from: THREE.Vector3;
  to: THREE.Vector3;
  edgeIndex: number;
  totalEdges: number;
  color: THREE.Color;
}> = ({ from, to, edgeIndex, totalEdges, color }) => {
  const matRef = useRef<THREE.LineBasicMaterial>(null);
  const t = useRef(0);

  useFrame((_, delta) => {
    t.current += delta;
    if (matRef.current) {
      // Each edge pulses with a phase offset based on its position in path
      const phase = (edgeIndex / Math.max(totalEdges, 1)) * Math.PI * 2;
      const pulse = 0.3 + 0.7 * Math.max(0, Math.sin(t.current * 3 - phase));
      matRef.current.opacity = pulse;
    }
  });

  const points = [from, to];

  return (
    <line>
      <bufferGeometry setFromPoints={points} />
      <lineBasicMaterial
        ref={matRef}
        color={color}
        transparent
        opacity={0.8}
        linewidth={3}
      />
    </line>
  );
};

// ==========================================
// HIGHLIGHTED NODE
// ==========================================

const PathNode: React.FC<{
  position: THREE.Vector3;
  nodeIndex: number;
  totalNodes: number;
  color: THREE.Color;
  label?: string;
}> = ({ position, nodeIndex, totalNodes, color, label }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const t = useRef(0);

  useFrame((_, delta) => {
    t.current += delta;
    if (meshRef.current) {
      const phase = (nodeIndex / Math.max(totalNodes, 1)) * Math.PI * 2;
      const pulse = 1.0 + 0.3 * Math.sin(t.current * 3 - phase);
      meshRef.current.scale.setScalar(pulse);
    }
  });

  const isStart = nodeIndex === 0;
  const isEnd = nodeIndex === totalNodes - 1;

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.025 * (isStart || isEnd ? 1.8 : 1.2), 16, 16]} />
        <meshBasicMaterial
          color={isStart ? '#00ff66' : isEnd ? '#ff3366' : color}
          transparent
          opacity={0.9}
        />
      </mesh>
      {/* Outer glow ring */}
      <mesh>
        <ringGeometry args={[0.03, 0.045, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      {/* Label */}
      {label && (
        <Html position={[0, 0.05, 0]} center>
          <div style={{
            color: isStart ? '#00ff66' : isEnd ? '#ff3366' : '#fff',
            fontSize: 10,
            fontFamily: 'monospace',
            background: 'rgba(0,0,0,0.7)',
            padding: '1px 4px',
            borderRadius: 3,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}>
            {label}
          </div>
        </Html>
      )}
    </group>
  );
};

// ==========================================
// MAIN COMPONENT
// ==========================================

export const PathHighlight: React.FC<PathHighlightProps> = ({
  nodes,
  pathIds,
  color = '#ffcc00',
  showDistances = true,
}) => {
  const threeColor = useMemo(() => new THREE.Color(color), [color]);

  const nodeMap = useMemo(
    () => new Map(nodes.map(n => [n.id, new THREE.Vector3(n.x ?? 0, n.y ?? 0, (n.z ?? 0) + 0.05)])),
    [nodes]
  );

  const pathPositions = useMemo(
    () => pathIds.map(id => ({ id, pos: nodeMap.get(id) })).filter(p => p.pos !== undefined),
    [pathIds, nodeMap]
  );

  if (pathPositions.length < 2) return null;

  return (
    <group name="path-highlight">
      {/* Edges */}
      {pathPositions.slice(0, -1).map(({ pos }, i) => {
        const nextPos = pathPositions[i + 1].pos!;
        return (
          <PulseEdge
            key={`pe-${i}`}
            from={pos!}
            to={nextPos}
            edgeIndex={i}
            totalEdges={pathPositions.length - 1}
            color={threeColor}
          />
        );
      })}

      {/* Nodes */}
      {pathPositions.map(({ id, pos }, i) => {
        const label = showDistances
          ? (i === 0 ? 'START' : i === pathPositions.length - 1 ? 'END' : `+${i}`)
          : undefined;
        return (
          <PathNode
            key={`pn-${id}`}
            position={pos!}
            nodeIndex={i}
            totalNodes={pathPositions.length}
            color={threeColor}
            label={label}
          />
        );
      })}
    </group>
  );
};

export default PathHighlight;
