/**
 * CausalOverlay.tsx — Minkowski causal chain visualization
 *
 * Renders real causal relationship data from NietzscheDB:
 * - Timelike edges (green): causal future/past
 * - Spacelike edges (blue): acausal, simultaneous
 * - Lightlike edges (yellow): boundary of light cone
 * - Causal chain paths highlighted with animated flow
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line, Html } from '@react-three/drei';
import * as THREE from 'three';

export type CausalType = 'timelike' | 'spacelike' | 'lightlike';
export type CausalDirection = 'WHY' | 'WHAT';

export interface CausalEdge {
  source: string;
  target: string;
  causal_type: CausalType;
  weight: number;
  temporal_delta?: number;
}

export interface CausalNeighborResult {
  node_id: string;
  neighbors: Array<{
    id: string;
    causal_type: CausalType;
    distance: number;
  }>;
}

export interface CausalChainResult {
  direction: CausalDirection;
  chain: Array<{
    node_id: string;
    depth: number;
    edge_type?: string;
  }>;
}

export interface CausalOverlayProps {
  /** All nodes with positions (from the main graph) */
  nodePositions: Map<string, { x: number; y: number; z: number }>;
  /** Causal edges to render */
  causalEdges: CausalEdge[];
  /** Active causal chain path */
  causalChain: CausalChainResult | null;
  /** Whether the overlay is visible */
  visible: boolean;
  /** Currently focused node ID */
  focusNodeId?: string;
}

const CAUSAL_COLORS: Record<CausalType, string> = {
  timelike: '#00ff66',
  spacelike: '#4488ff',
  lightlike: '#ffd700',
};

const CAUSAL_OPACITY: Record<CausalType, number> = {
  timelike: 0.7,
  spacelike: 0.4,
  lightlike: 0.6,
};

const CausalEdges = ({
  edges,
  nodePositions,
}: {
  edges: CausalEdge[];
  nodePositions: Map<string, { x: number; y: number; z: number }>;
}) => {
  const lines = useMemo(() => {
    return edges.map((edge, i) => {
      const p1 = nodePositions.get(edge.source);
      const p2 = nodePositions.get(edge.target);
      if (!p1 || !p2) return null;

      const color = CAUSAL_COLORS[edge.causal_type] || '#ffffff';
      const opacity = CAUSAL_OPACITY[edge.causal_type] || 0.5;

      return (
        <Line
          key={`causal-${i}`}
          points={[[p1.x, p1.y, p1.z], [p2.x, p2.y, p2.z]]}
          color={color}
          lineWidth={edge.causal_type === 'timelike' ? 2.5 : 1.5}
          transparent
          opacity={opacity * (0.5 + edge.weight * 0.5)}
          blending={THREE.AdditiveBlending}
        />
      );
    }).filter(Boolean);
  }, [edges, nodePositions]);

  return <group>{lines}</group>;
};

const CausalChainPath = ({
  chain,
  nodePositions,
}: {
  chain: CausalChainResult;
  nodePositions: Map<string, { x: number; y: number; z: number }>;
}) => {
  const lineRef = useRef<any>(null);

  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (const step of chain.chain) {
      const pos = nodePositions.get(step.node_id);
      if (pos) pts.push([pos.x, pos.y, pos.z]);
    }
    return pts;
  }, [chain, nodePositions]);

  useFrame(({ clock }) => {
    if (lineRef.current?.material) {
      const t = clock.getElapsedTime();
      lineRef.current.material.dashOffset = -t * 0.5;
    }
  });

  if (points.length < 2) return null;

  const isWhy = chain.direction === 'WHY';
  const color = isWhy ? '#ff6b6b' : '#00f0ff';

  return (
    <group>
      {/* Glow layer */}
      <Line
        points={points}
        color={color}
        lineWidth={4}
        transparent
        opacity={0.2}
        blending={THREE.AdditiveBlending}
      />
      {/* Main line with dash animation */}
      <Line
        ref={lineRef}
        points={points}
        color={color}
        lineWidth={2}
        transparent
        opacity={0.8}
        dashed
        dashSize={0.03}
        gapSize={0.015}
      />
      {/* Direction label */}
      {points.length > 0 && (
        <Html
          position={points[0]}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div style={{
            background: `rgba(${isWhy ? '255,107,107' : '0,240,255'}, 0.15)`,
            border: `1px solid ${color}`,
            color: color,
            padding: '3px 8px',
            borderRadius: '3px',
            fontFamily: 'monospace',
            fontSize: '9px',
            fontWeight: 'bold',
            backdropFilter: 'blur(4px)',
          }}>
            {isWhy ? 'WHY?' : 'WHAT?'} ({chain.chain.length} steps)
          </div>
        </Html>
      )}
      {/* Depth markers */}
      {chain.chain.map((step, i) => {
        const pos = nodePositions.get(step.node_id);
        if (!pos || i === 0) return null;
        return (
          <mesh key={`depth-${i}`} position={[pos.x, pos.y, pos.z]}>
            <ringGeometry args={[0.015, 0.025, 16]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.6}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        );
      })}
    </group>
  );
};

const LightConeOverlay = ({
  focusNodeId,
  nodePositions,
}: {
  focusNodeId: string;
  nodePositions: Map<string, { x: number; y: number; z: number }>;
}) => {
  const pos = nodePositions.get(focusNodeId);
  if (!pos) return null;

  return (
    <group position={[pos.x, pos.y, pos.z]}>
      {/* Future cone (green, upward) */}
      <mesh position={[0, 1.2, 0]}>
        <coneGeometry args={[1.2, 2.4, 32, 1, true]} />
        <meshBasicMaterial
          color="#00ff66"
          transparent
          opacity={0.06}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Past cone (red, downward) */}
      <mesh position={[0, -1.2, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[1.2, 2.4, 32, 1, true]} />
        <meshBasicMaterial
          color="#ff4444"
          transparent
          opacity={0.06}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Present plane indicator */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.05, 1.2, 32]} />
        <meshBasicMaterial
          color="#ffd700"
          transparent
          opacity={0.1}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
};

export const CausalOverlay = ({
  nodePositions,
  causalEdges,
  causalChain,
  visible,
  focusNodeId,
}: CausalOverlayProps) => {
  if (!visible) return null;

  return (
    <group>
      {/* Causal edges with type-based coloring */}
      <CausalEdges edges={causalEdges} nodePositions={nodePositions} />

      {/* Light cone around focused node */}
      {focusNodeId && (
        <LightConeOverlay focusNodeId={focusNodeId} nodePositions={nodePositions} />
      )}

      {/* Animated causal chain path */}
      {causalChain && (
        <CausalChainPath chain={causalChain} nodePositions={nodePositions} />
      )}
    </group>
  );
};
