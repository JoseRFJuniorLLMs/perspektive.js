/**
 * PerspektiveEngine.tsx — O Dashboard completo (3D Edition)
 *
 * Manifold Switcher (4 lentes com projecao 3D real),
 * Raycaster Hover com Tooltip, Animacao Lerp 3D organica,
 * SSE streaming com fallback REST, Cones de Luz Minkowski.
 */

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber';
import { OrthographicCamera, OrbitControls, Line, Html } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { calculateGeodesic, getVisualRadius, type Point2D } from '../math/poincare';

// ==========================================
// TIPAGENS
// ==========================================

interface Point3D { x: number; y: number; z: number }

export interface NodeData extends Point2D {
  id: string;
  energy: number;
  node_type: string;
  embedding: number[];
  arousal?: number;
  valence?: number;
  z: number; // Coordenada Z para modos 3D
}

export interface EdgeData {
  source: string;
  target: string;
  weight: number;
}

export type ManifoldType = 'POINCARE' | 'RIEMANN' | 'MINKOWSKI' | 'EMOTION';

export interface PerspektiveEngineProps {
  collection?: string;
  apiBase?: string;
  limit?: number;
}

// ==========================================
// A FISICA DO MULTIVERSO (As 4 Lentes)
// ==========================================

function projectToManifold(n: { embedding: number[]; valence?: number; arousal?: number; energy: number }, manifold: ManifoldType): Point3D {
  if (!n.embedding || n.embedding.length < 2) return { x: 0, y: 0, z: 0.01 };

  // POINCARE: Hierarquia 2D (hack do raio)
  if (manifold === 'POINCARE') {
    let sumSq = 0;
    for (let i = 0; i < n.embedding.length; i++) sumSq += n.embedding[i] * n.embedding[i];
    const r = Math.min(Math.sqrt(sumSq), 0.99);
    const len = Math.sqrt(n.embedding[0] ** 2 + n.embedding[1] ** 2) || 1;
    return { x: (n.embedding[0] / len) * r, y: (n.embedding[1] / len) * r, z: 0.01 };
  }

  // EMOTION: Russell Circumplex (Valencia x Excitacao 2D)
  if (manifold === 'EMOTION') {
    return { x: n.valence || 0, y: (n.arousal || 0) * 2 - 1, z: 0.01 };
  }

  // RIEMANN: Esfera 3D (Projecao Estereografica Inversa)
  // Pega o disco 2D e "enrola" numa esfera. Opostos nos polos!
  if (manifold === 'RIEMANN') {
    const px = n.embedding[0] * 3; // Escala para esfera gorda
    const py = n.embedding[1] * 3;
    const denom = 1 + px * px + py * py;
    return {
      x: (2 * px) / denom,
      y: (2 * py) / denom,
      z: (px * px + py * py - 1) / denom,
    };
  }

  // MINKOWSKI: Espaco-Tempo Causal 3D
  // X e Z = espaco, Y = TEMPO (torre temporal)
  if (manifold === 'MINKOWSKI') {
    const timeY = (n.energy * 5) - 2.5; // Alta energia no topo do tempo
    return {
      x: n.embedding[0] * 2,
      y: timeY,
      z: n.embedding[1] * 2,
    };
  }

  return { x: 0, y: 0, z: 0.01 };
}

// ==========================================
// GEODESICAS NEON (Edges)
// ==========================================

function geodesicPoints(p1: Point2D, p2: Point2D, segments = 40): [number, number, number][] {
  const geo = calculateGeodesic(p1, p2);
  if (geo.type === 'line') {
    return [[p1.x, p1.y, 0], [p2.x, p2.y, 0]];
  }
  const curve = new THREE.EllipseCurve(
    geo.center.x, geo.center.y,
    geo.radius, geo.radius,
    -geo.startAngle, -geo.endAngle,
    !geo.ccw, 0
  );
  return curve.getPoints(segments).map(v => [v.x, v.y, 0]);
}

/** Edges: geodesicas no Poincare, linhas retas nos outros modos */
const GraphEdges = ({ nodes, edges, manifold }: { nodes: NodeData[], edges: EdgeData[], manifold: ManifoldType }) => {
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  const lines = useMemo(() => {
    return edges.map(edge => {
      const p1 = nodeMap.get(edge.source);
      const p2 = nodeMap.get(edge.target);
      if (!p1 || !p2) return null;

      const opacity = 0.1 + (edge.weight * 0.4);
      const hdrColor = new THREE.Color(0x00d8ff).multiplyScalar(1.5);

      // Geodesicas hiperbolicas so no Poincare, linhas retas nos outros
      const points: [number, number, number][] = manifold === 'POINCARE'
        ? geodesicPoints(p1, p2, 40)
        : [[p1.x, p1.y, p1.z], [p2.x, p2.y, p2.z]];

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
  }, [edges, nodeMap, manifold]);

  return <group>{lines}</group>;
};

// ==========================================
// CONES DE LUZ DE MINKOWSKI
// ==========================================

const MinkowskiLightCones = ({ nodes, manifold }: { nodes: NodeData[], manifold: ManifoldType }) => {
  if (manifold !== 'MINKOWSKI') return null;

  // Cones translucidos nos nos elite (energy > 0.8)
  const eliteNodes = nodes.filter(n => n.energy > 0.8);

  return (
    <group>
      {eliteNodes.map(node => (
        <group key={`cone-${node.id}`} position={[node.x, node.y, node.z]}>
          {/* Cone do Futuro (ciano, apontando pra cima) */}
          <mesh position={[0, 1, 0]}>
            <coneGeometry args={[1, 2, 32, 1, true]} />
            <meshBasicMaterial
              color="#00f0ff" transparent opacity={0.08}
              side={THREE.DoubleSide} depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          {/* Cone do Passado (magenta, apontando pra baixo) */}
          <mesh position={[0, -1, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[1, 2, 32, 1, true]} />
            <meshBasicMaterial
              color="#ff00ff" transparent opacity={0.08}
              side={THREE.DoubleSide} depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>
      ))}
      {/* Grid de espaco-tempo */}
      <gridHelper args={[10, 20, 0x334155, 0x1e293b]} position={[0, -2.5, 0]} />
    </group>
  );
};

// ==========================================
// NOS COM LERP 3D + HOVER (InstancedMesh)
// ==========================================

const GraphNodes = ({ nodes, manifold }: { nodes: NodeData[], manifold: ManifoldType }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const [hoveredNode, setHoveredNode] = useState<NodeData | null>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const targetPos = useMemo(() => new THREE.Vector3(), []);
  const currentPos = useMemo(() => new THREE.Vector3(), []);

  // Setup inicial
  useEffect(() => {
    if (!meshRef.current) return;

    nodes.forEach((node, i) => {
      dummy.position.set(node.x, node.y, node.z);
      const baseRadius = 0.01 + (node.energy * 0.03);
      const renderRadius = manifold === 'POINCARE' ? getVisualRadius(node, baseRadius) : baseRadius;
      dummy.scale.set(renderRadius, renderRadius, 1);

      // No Riemann, nos olham pro centro da esfera
      if (manifold === 'RIEMANN') dummy.lookAt(0, 0, 0);

      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);

      // Paleta Neon Cyberpunk
      if (node.node_type === 'Pruned') color.setHex(0x1e293b);
      else if (node.node_type === 'Episodic') color.setHex(0x00f0ff);
      else if (node.node_type === 'Concept') color.setHex(0xf59e0b);
      else if (node.node_type === 'DreamSnapshot') color.setHex(0x8b5cf6);
      else color.setHex(0x00ff66);

      if (node.energy > 0.8) {
        color.setHex(0xff00ff);
        color.multiplyScalar(4.0);
      } else if (node.energy > 0.5) {
        color.multiplyScalar(2.0);
      }

      meshRef.current!.setColorAt(i, color);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [nodes, dummy, color, manifold]);

  // LERP 3D — 60fps, movimento organico em X/Y/Z
  useFrame(() => {
    if (!meshRef.current) return;
    let needsUpdate = false;

    nodes.forEach((node, i) => {
      meshRef.current!.getMatrixAt(i, dummy.matrix);
      currentPos.setFromMatrixPosition(dummy.matrix);
      targetPos.set(node.x, node.y, node.z);

      if (currentPos.distanceTo(targetPos) > 0.001) {
        currentPos.lerp(targetPos, 0.05);
        const baseRadius = 0.01 + (node.energy * 0.03);
        const radius = manifold === 'POINCARE' ? getVisualRadius(node, baseRadius) : baseRadius;
        dummy.position.copy(currentPos);
        dummy.scale.set(radius, radius, 1);

        if (manifold === 'RIEMANN') dummy.lookAt(0, 0, 0);

        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(i, dummy.matrix);
        needsUpdate = true;
      }
    });

    if (needsUpdate) meshRef.current.instanceMatrix.needsUpdate = true;
  });

  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.instanceId !== undefined && e.instanceId < nodes.length) {
      document.body.style.cursor = 'crosshair';
      setHoveredNode(nodes[e.instanceId]);
    }
  }, [nodes]);

  const handlePointerOut = useCallback(() => {
    document.body.style.cursor = 'auto';
    setHoveredNode(null);
  }, []);

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, nodes.length]}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
      >
        <circleGeometry args={[1, 32]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* TOOLTIP CYBERPUNK */}
      {hoveredNode && (
        <Html position={[hoveredNode.x, hoveredNode.y + 0.05, hoveredNode.z]} center style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(2, 6, 23, 0.9)',
            border: '1px solid #00f0ff',
            color: '#fff',
            padding: '10px',
            borderRadius: '4px',
            fontFamily: 'monospace',
            width: '220px',
            backdropFilter: 'blur(4px)',
            boxShadow: '0 0 10px rgba(0, 240, 255, 0.5)',
          }}>
            <div style={{ color: '#00f0ff', fontWeight: 'bold', marginBottom: 4 }}>
              {hoveredNode.node_type}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              ID: {hoveredNode.id.substring(0, 12)}...
            </div>
            <div style={{ fontSize: 11, color: '#ff00ff' }}>
              Energy: {(hoveredNode.energy * 100).toFixed(1)}%
            </div>
            {hoveredNode.valence !== undefined && (
              <div style={{ fontSize: 11, color: '#00ff66' }}>
                Valence: {hoveredNode.valence.toFixed(2)} | Arousal: {(hoveredNode.arousal || 0).toFixed(2)}
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
};

// ==========================================
// BORDA DO DISCO (so Poincare)
// ==========================================

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

// ==========================================
// WIREFRAME DA ESFERA DE RIEMANN (so Riemann)
// ==========================================

const RiemannWireframe = ({ manifold }: { manifold: ManifoldType }) => {
  if (manifold !== 'RIEMANN') return null;
  return (
    <mesh>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial color="#1e293b" wireframe transparent opacity={0.15} />
    </mesh>
  );
};

// ==========================================
// O PALCO PRINCIPAL
// ==========================================

export const PerspektiveEngine = ({
  collection = 'default',
  apiBase = '',
  limit = 2000,
}: PerspektiveEngineProps) => {
  const [manifold, setManifold] = useState<ManifoldType>('POINCARE');
  const [graphData, setGraphData] = useState<{ nodes: NodeData[]; edges: EdgeData[] }>({ nodes: [], edges: [] });
  const [streaming, setStreaming] = useState(false);

  const is2D = manifold === 'POINCARE' || manifold === 'EMOTION';

  // Mapeia dados da API para o manifold ativo
  const mapApiData = useCallback((data: { nodes: NodeData[]; edges: EdgeData[] }) => {
    const mappedNodes = data.nodes.map(n => {
      const pos = projectToManifold(n, manifold);
      return { ...n, ...pos };
    });
    const mappedEdges = data.edges.map(e => ({
      source: e.source,
      target: e.target,
      weight: e.weight || 0.5,
    }));
    setGraphData({ nodes: mappedNodes, edges: mappedEdges });
  }, [manifold]);

  // SSE STREAMING com fallback REST
  useEffect(() => {
    fetch(`${apiBase}/api/graph?collection=${collection}&limit=${limit}`)
      .then(res => res.json())
      .then(data => mapApiData(data))
      .catch(() => {});

    const sseUrl = `${apiBase}/api/graph/stream?collection=${collection}`;
    const eventSource = new EventSource(sseUrl);

    eventSource.onopen = () => setStreaming(true);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        mapApiData(data);
      } catch { /* ignora parse errors */ }
    };

    eventSource.onerror = () => {
      setStreaming(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
      setStreaming(false);
    };
  }, [collection, apiBase, limit, mapApiData]);

  // Remapeia quando troca de manifold
  useEffect(() => {
    if (graphData.nodes.length > 0) {
      const remapped = graphData.nodes.map(n => {
        const pos = projectToManifold(n, manifold);
        return { ...n, ...pos };
      });
      setGraphData(prev => ({ ...prev, nodes: remapped }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifold]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', background: '#000' }}>

      <Canvas>
        {/* Camera: Ortografica pro 2D, Perspectiva implícita pro 3D */}
        {is2D && <OrthographicCamera makeDefault position={[0, 0, 5]} zoom={300} />}

        {/* OrbitControls: rotacao travada nos modos 2D, livre nos 3D */}
        <OrbitControls
          enableRotate={!is2D}
          enablePan={true}
          enableZoom={true}
        />

        {/* POINCARE: disco + borda */}
        {manifold === 'POINCARE' && (
          <>
            <mesh position={[0, 0, -0.1]}>
              <circleGeometry args={[1, 64]} />
              <meshBasicMaterial color="#050510" />
            </mesh>
            <DiskBorder />
          </>
        )}

        {/* EMOTION: eixos do Circumplex */}
        {manifold === 'EMOTION' && (
          <group>
            <Line points={[[-1, 0, 0], [1, 0, 0]]} color="#334155" transparent opacity={0.3} lineWidth={1} />
            <Line points={[[0, -1, 0], [0, 1, 0]]} color="#334155" transparent opacity={0.3} lineWidth={1} />
          </group>
        )}

        {/* RIEMANN: wireframe da esfera */}
        <RiemannWireframe manifold={manifold} />

        {/* MINKOWSKI: cones de luz + grid */}
        <MinkowskiLightCones nodes={graphData.nodes} manifold={manifold} />

        {/* Edges + Nos */}
        <GraphEdges nodes={graphData.nodes} edges={graphData.edges} manifold={manifold} />
        <GraphNodes nodes={graphData.nodes} manifold={manifold} />

        {/* BLOOM CYBERPUNK */}
        <EffectComposer enableNormalPass={false}>
          <Bloom luminanceThreshold={0.2} mipmapBlur intensity={1.5} radius={0.8} />
        </EffectComposer>
      </Canvas>

      {/* MANIFOLD SWITCHER */}
      <div style={{
        position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 15, background: 'rgba(0,0,0,0.8)', padding: '10px 20px',
        border: '1px solid #334155', borderRadius: 8, backdropFilter: 'blur(10px)',
      }}>
        {(['POINCARE', 'RIEMANN', 'MINKOWSKI', 'EMOTION'] as ManifoldType[]).map(m => (
          <button
            key={m}
            onClick={() => setManifold(m)}
            style={{
              background: manifold === m ? '#00f0ff' : 'transparent',
              color: manifold === m ? '#000' : '#94a3b8',
              border: `1px solid ${manifold === m ? '#00f0ff' : '#334155'}`,
              padding: '8px 16px', borderRadius: 4, cursor: 'pointer',
              fontFamily: 'monospace', fontWeight: 'bold', fontSize: 13,
              textShadow: manifold === m ? 'none' : '0 0 5px rgba(0,240,255,0.3)',
              transition: 'all 0.3s ease',
            }}
          >
            {m}
          </button>
        ))}
      </div>

      {/* STATUS HUD */}
      <div style={{
        position: 'absolute', top: 20, left: 20,
        color: '#00f0ff', fontFamily: 'monospace', pointerEvents: 'none',
        textShadow: '0 0 5px #00f0ff',
      }}>
        <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
          NietzscheDB // Perspektive.js
        </div>
        <div style={{ color: streaming ? '#00ff66' : '#f59e0b' }}>
          {streaming ? '● STREAMING ACTIVE (SSE)' : '● POLLING (REST)'}
        </div>
        <div>COLECAO: {collection.toUpperCase()}</div>
        <div>NOS: {graphData.nodes.length} | EDGES: {graphData.edges.length}</div>
        <div>MANIFOLD: {manifold} {manifold === 'POINCARE' ? 'K < 0' : manifold === 'RIEMANN' ? 'K > 0' : manifold === 'MINKOWSKI' ? 'ds²' : 'V×A'}</div>
      </div>
    </div>
  );
};
