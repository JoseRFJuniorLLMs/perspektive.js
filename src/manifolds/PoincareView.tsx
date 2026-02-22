/**
 * PoincareView.tsx — Motor WebGL do disco de Poincare (Cyberpunk Edition)
 *
 * InstancedMesh para nos (1 draw call = 100k+ esferas)
 * BufferGeometry para geodesicas (arcos ortogonais a borda)
 * AdditiveBlending para brilho em zonas de alta densidade
 * HDR Colors + Bloom para neon cyberpunk (Ubermensch = magenta 4x)
 */

import { useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrthographicCamera, MapControls, Line } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { calculateGeodesic, getVisualRadius, type Point2D } from '../math/poincare';

export interface NodeData extends Point2D {
  id: string;
  energy: number;
  node_type: string;
}

export interface EdgeData {
  source: string;
  target: string;
  weight: number;
}

/** Gera array de pontos [x,y,z] para uma geodesica hiperbolica */
function geodesicPoints(p1: Point2D, p2: Point2D, segments = 40): [number, number, number][] {
  const geo = calculateGeodesic(p1, p2);

  if (geo.type === 'line') {
    return [[p1.x, p1.y, 0], [p2.x, p2.y, 0]];
  }

  const curve = new THREE.EllipseCurve(
    geo.center.x, geo.center.y,
    geo.radius, geo.radius,
    -geo.startAngle, -geo.endAngle,
    !geo.ccw,
    0
  );
  return curve.getPoints(segments).map(v => [v.x, v.y, 0]);
}

// --- GEODESICAS NEON (Edges) ---
const HyperbolicEdges = ({ nodes, edges }: { nodes: NodeData[], edges: EdgeData[] }) => {
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  const lines = useMemo(() => {
    return edges.map(edge => {
      const p1 = nodeMap.get(edge.source);
      const p2 = nodeMap.get(edge.target);
      if (!p1 || !p2) return null;

      const points = geodesicPoints(p1, p2, 40);
      const opacity = 0.1 + (edge.weight * 0.4);

      // Cor HDR: Ciano multiplicado por 1.5 para acender o Bloom
      const hdrColor = new THREE.Color(0x00d8ff).multiplyScalar(1.5);

      return (
        <Line
          key={`${edge.source}-${edge.target}`}
          points={points}
          color={hdrColor}
          lineWidth={1}
          transparent
          opacity={opacity}
          blending={THREE.AdditiveBlending}
        />
      );
    }).filter(Boolean);
  }, [edges, nodeMap]);

  return <group>{lines}</group>;
};

// --- NOS HDR (InstancedMesh: 1 draw call para todos) ---
const HyperbolicNodes = ({ nodes }: { nodes: NodeData[] }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    if (!meshRef.current) return;

    nodes.forEach((node, i) => {
      dummy.position.set(node.x, node.y, 0.01);

      const baseRadius = 0.01 + (node.energy * 0.03);
      const renderRadius = getVisualRadius(node, baseRadius);
      dummy.scale.set(renderRadius, renderRadius, 1);

      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);

      // --- PALETA NEON CYBERPUNK ---
      if (node.node_type === 'Pruned') {
        color.setHex(0x1e293b);          // Cinza apagado (dead nodes nao brilham)
      } else if (node.node_type === 'Episodic') {
        color.setHex(0x00f0ff);          // Ciano Eletrico
      } else if (node.node_type === 'Concept') {
        color.setHex(0xf59e0b);          // Amber
      } else if (node.node_type === 'DreamSnapshot') {
        color.setHex(0x8b5cf6);          // Violeta
      } else {
        color.setHex(0x00ff66);          // Esmeralda Matrix (Semantic)
      }

      // Ubermensch: energy > 0.8 → Magenta puro, brilho 4x (halo via Bloom)
      if (node.energy > 0.8) {
        color.setHex(0xff00ff);
        color.multiplyScalar(4.0);
      } else if (node.energy > 0.5) {
        color.multiplyScalar(2.0);       // Nos normais brilham um pouco
      }

      meshRef.current!.setColorAt(i, color);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [nodes, dummy, color]);

  // Respiracao biologica: pulso sutil no eixo Z
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.position.z = Math.sin(clock.getElapsedTime() * 2) * 0.005;
    }
  });

  // toneMapped={false} OBRIGATORIO: impede Three.js de achatar cores HDR
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, nodes.length]}>
      <circleGeometry args={[1, 32]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
};

// --- BORDA DO ABISMO ---
const DiskBorder = () => {
  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      pts.push([Math.cos(angle) * 1.005, Math.sin(angle) * 1.005, 0]);
    }
    return pts;
  }, []);

  return <Line points={points} color="#1e293b" transparent opacity={0.3} lineWidth={1} />;
};

// --- O PALCO PRINCIPAL ---
export const PoincareView = ({ nodes, edges }: { nodes: NodeData[], edges: EdgeData[] }) => {
  return (
    <div style={{ width: '100%', height: '100vh', background: '#000000' }}>
      <Canvas>
        <OrthographicCamera makeDefault position={[0, 0, 5]} zoom={300} />
        <MapControls enableRotate={false} />

        {/* O Abismo: azul noite abissal */}
        <mesh position={[0, 0, -0.1]}>
          <circleGeometry args={[1, 64]} />
          <meshBasicMaterial color="#050510" />
        </mesh>

        <DiskBorder />

        {/* Geodesicas primeiro, nos por cima */}
        <HyperbolicEdges nodes={nodes} edges={edges} />
        <HyperbolicNodes nodes={nodes} />

        {/* POST-PROCESSING: GLOW CYBERPUNK */}
        <EffectComposer enableNormalPass={false}>
          <Bloom
            luminanceThreshold={0.2}
            mipmapBlur
            intensity={1.5}
            radius={0.8}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
};
