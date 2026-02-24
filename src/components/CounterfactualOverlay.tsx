/**
 * CounterfactualOverlay.tsx — Pilar 1 da EVA: Manipulação Contrafactual
 *
 * Permite que o usuário arraste um nó X SOBRE um nó Y para criar um
 * emaranhamento "Hipótese/Sonho" temporário, visualizado como uma aresta
 * roxa pulsante. Invoca o callback `onCounterfactualCreate` para acionar
 * o endpoint /agency/counterfactual/add no backend.
 *
 * Funcionamento:
 * 1. Usuário inicia drag de um nó (detectado via useDrag em modo counterfactual).
 * 2. Durante o drag, verificamos proximidade com outros nós (< snapThreshold).
 * 3. Ao soltar sobre um nó alvo, criamos a aresta hipótese e disparamos o callback.
 * 4. A aresta hipótese é visualizada como ShadowGraph overlay (roxo pulsante).
 */

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { NodeData } from './PerspektiveEngine';

// ==========================================
// TYPES
// ==========================================

export interface CounterfactualEdge {
  sourceId: string;
  targetId: string;
  /** Confidence/strength of the hypothetical connection [0..1] */
  confidence: number;
  /** Whether this edge is confirmed (after backend ack) or still ephemeral */
  confirmed: boolean;
}

export interface CounterfactualOverlayProps {
  nodes: NodeData[];
  /** The ID of the node currently being dragged. null if none. */
  draggedNodeId: string | null;
  /** Current world position of the dragged node */
  dragPosition: THREE.Vector3 | null;
  /** Distance threshold in world units to snap to a target node */
  snapThreshold?: number;
  /** Active counterfactual edges to render */
  counterfactualEdges: CounterfactualEdge[];
  /** Fired when a new counterfactual link is created by the user */
  onCounterfactualCreate?: (sourceId: string, targetId: string) => void;
  /** Fired when a target node is highlighted (candidate for linking) */
  onTargetHighlight?: (targetId: string | null) => void;
}

// ==========================================
// SHADOW EDGE (aresta hipótese)
// ==========================================

const ShadowEdge: React.FC<{
  p1: THREE.Vector3;
  p2: THREE.Vector3;
  confirmed?: boolean;
}> = ({ p1, p2, confirmed = false }) => {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const t = useRef(0);

  useFrame((_, delta) => {
    t.current += delta;
    if (matRef.current) {
      // Pulsing purple glow
      const pulse = 0.4 + 0.6 * Math.sin(t.current * 4);
      matRef.current.opacity = confirmed ? 0.9 : pulse * 0.7;
    }
  });

  const points: [number, number, number][] = [
    [p1.x, p1.y, p1.z + 0.02],
    [p2.x, p2.y, p2.z + 0.02],
  ];

  return (
    <Line
      points={points}
      lineWidth={confirmed ? 3 : 2}
      color={confirmed ? '#cc77ff' : '#9933ff'}
    >
      <lineBasicMaterial
        ref={matRef}
        attach="material"
        color={confirmed ? '#cc77ff' : '#9933ff'}
        transparent
        opacity={0.7}
      />
    </Line>
  );
};

// ==========================================
// TARGET HIGHLIGHT RING
// ==========================================

const TargetHighlight: React.FC<{ position: THREE.Vector3 }> = ({ position }) => {
  const ref = useRef<THREE.Mesh>(null);
  const t = useRef(0);

  useFrame((_, delta) => {
    t.current += delta;
    if (ref.current) {
      ref.current.rotation.z = t.current * 2;
      const scale = 1 + 0.15 * Math.sin(t.current * 8);
      ref.current.scale.setScalar(scale);
    }
  });

  return (
    <mesh ref={ref} position={[position.x, position.y, position.z + 0.03]}>
      <ringGeometry args={[0.06, 0.09, 32]} />
      <meshBasicMaterial color="#9933ff" transparent opacity={0.8} side={THREE.DoubleSide} />
    </mesh>
  );
};

// ==========================================
// MAIN COMPONENT
// ==========================================

export const CounterfactualOverlay: React.FC<CounterfactualOverlayProps> = ({
  nodes,
  draggedNodeId,
  dragPosition,
  snapThreshold = 0.15,
  counterfactualEdges,
  onCounterfactualCreate,
  onTargetHighlight,
}) => {
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);
  const prevHoveredRef = useRef<string | null>(null);

  // Map nodeId → position for fast lookup
  const nodePositions = useMemo(
    () => new Map(nodes.map(n => [n.id, new THREE.Vector3(n.x, n.y, n.z)])),
    [nodes]
  );

  // During drag: find closest candidate node (not the dragged one)
  useFrame(() => {
    if (!draggedNodeId || !dragPosition) {
      if (hoveredTargetId !== null) {
        setHoveredTargetId(null);
        onTargetHighlight?.(null);
      }
      return;
    }

    let closestId: string | null = null;
    let closestDist = snapThreshold;

    for (const n of nodes) {
      if (n.id === draggedNodeId) continue;
      const pos = nodePositions.get(n.id);
      if (!pos) continue;
      const dist = dragPosition.distanceTo(pos);
      if (dist < closestDist) {
        closestDist = dist;
        closestId = n.id;
      }
    }

    if (closestId !== prevHoveredRef.current) {
      prevHoveredRef.current = closestId;
      setHoveredTargetId(closestId);
      onTargetHighlight?.(closestId);
    }
  });

  // When drag ends on a target node → fire counterfactual creation
  useEffect(() => {
    if (!draggedNodeId && hoveredTargetId && prevHoveredRef.current) {
      onCounterfactualCreate?.(draggedNodeId!, prevHoveredRef.current);
      prevHoveredRef.current = null;
    }
  }, [draggedNodeId, hoveredTargetId, onCounterfactualCreate]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <group name="counterfactual-overlay">
      {/* Live drag preview line */}
      {draggedNodeId && dragPosition && hoveredTargetId && (() => {
        const targetPos = nodePositions.get(hoveredTargetId);
        if (!targetPos) return null;
        return (
          <>
            <ShadowEdge p1={dragPosition} p2={targetPos} confirmed={false} />
            <TargetHighlight position={targetPos} />
          </>
        );
      })()}

      {/* Confirmed / persisted counterfactual edges */}
      {counterfactualEdges.map(edge => {
        const p1 = nodePositions.get(edge.sourceId);
        const p2 = nodePositions.get(edge.targetId);
        if (!p1 || !p2) return null;
        return (
          <group key={`cf-${edge.sourceId}-${edge.targetId}`}>
            <ShadowEdge p1={p1} p2={p2} confirmed={edge.confirmed} />
            <Html position={[
              (p1.x + p2.x) / 2,
              (p1.y + p2.y) / 2 + 0.05,
              (p1.z + p2.z) / 2 + 0.04,
            ]} center>
              <div style={{
                color: '#cc77ff',
                fontFamily: 'monospace',
                fontSize: 9,
                background: 'rgba(0,0,0,0.7)',
                padding: '1px 4px',
                borderRadius: 3,
                border: '1px solid #9933ff',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}>
                HYPOTHESIS {Math.round(edge.confidence * 100)}%
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
};

export default CounterfactualOverlay;
