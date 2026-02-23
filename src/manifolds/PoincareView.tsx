/**
 * PoincareView.tsx — Motor WebGL do disco de Poincare (Cyberpunk Edition)
 *
 * InstancedMesh para nos (1 draw call = 100k+ esferas)
 * BufferGeometry para geodesicas (arcos ortogonais a borda)
 * AdditiveBlending para brilho em zonas de alta densidade
 * HDR Colors + Bloom para neon cyberpunk (Ubermensch = magenta 4x)
 */

import { useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera, MapControls, Line } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { calculateGeodesic, getVisualRadius, type Point2D } from '../math/poincare';
import { ErrorBoundary } from '../components/ErrorBoundary';
import type { SituationalModulatorState } from '../interaction/useSituationalModulator';

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

// --- BORDA DO ABISMO (with crisis pulse) ---
const DiskBorder = ({ crisisLevel = 0 }: { crisisLevel?: number }) => {
  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      pts.push([Math.cos(angle) * 1.005, Math.sin(angle) * 1.005, 0]);
    }
    return pts;
  }, []);

  // Crisis > 0.7 → the boundary pulses magenta (visual alarm)
  const borderColor = crisisLevel > 0.7 ? '#ff00ff' : '#1e293b';
  const opacity = crisisLevel > 0.7 ? 0.7 : 0.3;

  return <Line points={points} color={borderColor} transparent opacity={opacity} lineWidth={1} />;
};

// --- CAMERA CONTROL (auto-zoom toward crisis focus) ---
const CameraController = ({
  autoZoomTarget,
  crisisLevel,
}: {
  autoZoomTarget: [number, number] | null;
  crisisLevel: number;
}) => {
  const { camera } = useThree();

  useFrame(() => {
    if (!autoZoomTarget || crisisLevel < 0.3) return;

    const orth = camera as THREE.OrthographicCamera;
    const targetX = autoZoomTarget[0] * 0.5; // 50% toward focus
    const targetY = autoZoomTarget[1] * 0.5;
    const targetZoom = 300 + crisisLevel * 200; // zoom in on crisis

    // Smooth interpolation (0.03 per frame ≈ 1.5s at 60fps)
    orth.position.x += (targetX - orth.position.x) * 0.03;
    orth.position.y += (targetY - orth.position.y) * 0.03;
    orth.zoom += (targetZoom - orth.zoom) * 0.03;
    orth.updateProjectionMatrix();
  });

  return null;
};

// --- O PALCO PRINCIPAL ---
export const PoincareView = ({
  nodes,
  edges,
  situationData,
}: {
  nodes: NodeData[];
  edges: EdgeData[];
  /** Optional Situational Modulator data to drive dynamic space deformation. */
  situationData?: SituationalModulatorState;
}) => {
  const crisisLevel = situationData?.crisisLevel ?? 0;
  const autoZoomTarget = situationData?.autoZoomTarget ?? null;

  // Bloom intensity: 1.5 baseline, up to 4.0 at full crisis
  const bloomIntensity = 1.5 + crisisLevel * 2.5;

  return (
    <div style={{ width: '100%', height: '100vh', background: '#000000' }}>
      <ErrorBoundary>
      <Canvas>
        <OrthographicCamera makeDefault position={[0, 0, 5]} zoom={300} />
        <MapControls enableRotate={false} />

        {/* Situational Modulator: auto-zoom toward crisis focus */}
        <CameraController autoZoomTarget={autoZoomTarget} crisisLevel={crisisLevel} />

        {/* O Abismo: azul noite abissal */}
        <mesh position={[0, 0, -0.1]}>
          <circleGeometry args={[1, 64]} />
          <meshBasicMaterial color="#050510" />
        </mesh>

        <DiskBorder crisisLevel={crisisLevel} />

        {/* Geodesicas primeiro, nos por cima */}
        <HyperbolicEdges nodes={nodes} edges={edges} />
        <HyperbolicNodes nodes={nodes} />

        {/* POST-PROCESSING: GLOW CYBERPUNK (intensifies during crisis) */}
        <EffectComposer enableNormalPass={false}>
          <Bloom
            luminanceThreshold={0.2}
            mipmapBlur
            intensity={bloomIntensity}
            radius={0.8}
          />
        </EffectComposer>
      </Canvas>
      </ErrorBoundary>
    </div>
  );
};
