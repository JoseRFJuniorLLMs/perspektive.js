/**
 * DreamOverlay.tsx — Speculative graph evolution visualization
 *
 * Renders "ghost" nodes and dashed edges from NietzscheDB's Dream Engine.
 * Dream nodes appear semi-transparent with a golden glow.
 * Users can Apply or Reject dreams via callbacks.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line, Html } from '@react-three/drei';
import * as THREE from 'three';

export interface DreamNode {
  id: string;
  x: number;
  y: number;
  z: number;
  energy: number;
  node_type: string;
  event_type?: 'EnergySpike' | 'CurvatureAnomaly' | 'ClusterCollision' | 'Recurrence';
}

export interface DreamEdge {
  source: string;
  target: string;
  weight: number;
}

export interface DreamSession {
  id: string;
  seed_node_id: string;
  depth: number;
  noise: number;
  status: 'pending' | 'applied' | 'rejected';
  nodes: DreamNode[];
  edges: DreamEdge[];
}

export interface DreamOverlayProps {
  session: DreamSession | null;
  visible: boolean;
  onApply?: (dreamId: string) => void;
  onReject?: (dreamId: string) => void;
}

const EVENT_COLORS: Record<string, string> = {
  EnergySpike: '#ffd700',
  CurvatureAnomaly: '#ff6b6b',
  ClusterCollision: '#ff00ff',
  Recurrence: '#8b5cf6',
};

const DreamNodes = ({ nodes }: { nodes: DreamNode[] }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const time = clock.getElapsedTime();
    const pulse = Math.sin(time * 3) * 0.3 + 0.7;

    nodes.forEach((node, i) => {
      dummy.position.set(node.x, node.y, node.z);
      const radius = (0.015 + node.energy * 0.025) * pulse;
      dummy.scale.set(radius, radius, 1);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);

      const eventColor = node.event_type ? EVENT_COLORS[node.event_type] : '#ffd700';
      color.set(eventColor);
      color.multiplyScalar(2.0 + Math.sin(time * 5 + i) * 0.5);
      meshRef.current!.setColorAt(i, color);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, Math.max(nodes.length, 1)]}>
      <ringGeometry args={[0.7, 1, 32]} />
      <meshBasicMaterial toneMapped={false} transparent opacity={0.6} blending={THREE.AdditiveBlending} />
    </instancedMesh>
  );
};

const DreamEdges = ({ nodes, edges }: { nodes: DreamNode[]; edges: DreamEdge[] }) => {
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  const lines = useMemo(() => {
    return edges.map((edge, i) => {
      const p1 = nodeMap.get(edge.source);
      const p2 = nodeMap.get(edge.target);
      if (!p1 || !p2) return null;

      return (
        <Line
          key={`dream-edge-${i}`}
          points={[[p1.x, p1.y, p1.z], [p2.x, p2.y, p2.z]]}
          color="#ffd700"
          lineWidth={1.5}
          transparent
          opacity={0.3 + edge.weight * 0.3}
          dashed
          dashSize={0.02}
          gapSize={0.01}
          blending={THREE.AdditiveBlending}
        />
      );
    }).filter(Boolean);
  }, [edges, nodeMap]);

  return <group>{lines}</group>;
};

export const DreamOverlay = ({ session, visible, onApply, onReject }: DreamOverlayProps) => {
  if (!visible || !session || session.nodes.length === 0) return null;

  return (
    <group>
      <DreamNodes nodes={session.nodes} />
      <DreamEdges nodes={session.nodes} edges={session.edges} />

      {/* Dream info label at seed position */}
      {session.nodes[0] && (
        <Html
          position={[session.nodes[0].x, session.nodes[0].y + 0.1, session.nodes[0].z]}
          center
          style={{ pointerEvents: 'auto' }}
        >
          <div style={{
            background: 'rgba(255, 215, 0, 0.15)',
            border: '1px solid #ffd700',
            color: '#ffd700',
            padding: '8px 12px',
            borderRadius: '6px',
            fontFamily: 'monospace',
            fontSize: '10px',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 0 20px rgba(255, 215, 0, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            minWidth: '180px',
          }}>
            <div style={{ fontWeight: 'bold', fontSize: '11px' }}>
              DREAM SESSION
            </div>
            <div style={{ color: '#fffacd' }}>
              Depth: {session.depth} | Noise: {session.noise.toFixed(2)}
            </div>
            <div style={{ color: '#fffacd' }}>
              +{session.nodes.length} nodes | +{session.edges.length} edges
            </div>
            {session.status === 'pending' && (
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <button
                  onClick={() => onApply?.(session.id)}
                  style={{
                    background: 'rgba(0, 255, 102, 0.2)',
                    border: '1px solid #00ff66',
                    color: '#00ff66',
                    padding: '4px 10px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontFamily: 'monospace',
                    fontSize: '9px',
                    fontWeight: 'bold',
                  }}
                >
                  APPLY
                </button>
                <button
                  onClick={() => onReject?.(session.id)}
                  style={{
                    background: 'rgba(255, 0, 0, 0.2)',
                    border: '1px solid #ff4444',
                    color: '#ff4444',
                    padding: '4px 10px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontFamily: 'monospace',
                    fontSize: '9px',
                    fontWeight: 'bold',
                  }}
                >
                  REJECT
                </button>
              </div>
            )}
            {session.status !== 'pending' && (
              <div style={{
                color: session.status === 'applied' ? '#00ff66' : '#ff4444',
                fontWeight: 'bold',
              }}>
                {session.status.toUpperCase()}
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
};
