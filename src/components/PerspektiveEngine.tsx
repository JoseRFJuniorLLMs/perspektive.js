/**
 * PerspektiveEngine.tsx — O Dashboard completo
 *
 * Manifold Switcher (4 lentes), Raycaster Hover com Tooltip,
 * Animacao Lerp organica, SSE streaming com fallback REST.
 * Tudo em 1 componente. Cyberpunk edition.
 */

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber';
import { OrthographicCamera, MapControls, Line, Html } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { calculateGeodesic, getVisualRadius, type Point2D } from '../math/poincare';

// ==========================================
// TIPAGENS
// ==========================================

export interface NodeData extends Point2D {
  id: string;
  energy: number;
  node_type: string;
  embedding: number[];
  arousal?: number;
  valence?: number;
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
// MATEMATICA: PROJECAO POR MANIFOLD
// ==========================================

function projectToManifold(n: { embedding: number[]; valence?: number; arousal?: number }, manifold: ManifoldType): Point2D {
  // Poincare: hack do raio (norma completa como raio, 2 primeiras dims como direcao)
  if (manifold === 'POINCARE') {
    if (!n.embedding || n.embedding.length < 2) return { x: 0, y: 0 };
    let sumSq = 0;
    for (let i = 0; i < n.embedding.length; i++) sumSq += n.embedding[i] * n.embedding[i];
    const r = Math.min(Math.sqrt(sumSq), 0.99);
    const len = Math.sqrt(n.embedding[0] ** 2 + n.embedding[1] ** 2) || 1;
    return { x: (n.embedding[0] / len) * r, y: (n.embedding[1] / len) * r };
  }

  // Emocao: Russell Circumplex (Valence no X, Arousal no Y)
  if (manifold === 'EMOTION') {
    return { x: n.valence || 0, y: (n.arousal || 0) * 2 - 1 };
  }

  // Riemann/Minkowski: fallback 2D (shaders 3D avancados virao depois)
  if (!n.embedding || n.embedding.length < 2) return { x: 0, y: 0 };
  return { x: n.embedding[0], y: n.embedding[1] };
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

const HyperbolicEdges = ({ nodes, edges }: { nodes: NodeData[], edges: EdgeData[] }) => {
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  const lines = useMemo(() => {
    return edges.map(edge => {
      const p1 = nodeMap.get(edge.source);
      const p2 = nodeMap.get(edge.target);
      if (!p1 || !p2) return null;

      const points = geodesicPoints(p1, p2, 40);
      const opacity = 0.1 + (edge.weight * 0.4);
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

// ==========================================
// NOS COM LERP + HOVER (InstancedMesh)
// ==========================================

const HyperbolicUniverse = ({ nodes, edges }: { nodes: NodeData[], edges: EdgeData[] }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const [hoveredNode, setHoveredNode] = useState<NodeData | null>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const targetPos = useMemo(() => new THREE.Vector3(), []);
  const currentPos = useMemo(() => new THREE.Vector3(), []);

  // Setup inicial: posiciona todos os nos
  useEffect(() => {
    if (!meshRef.current) return;

    nodes.forEach((node, i) => {
      dummy.position.set(node.x, node.y, 0.01);
      const baseRadius = 0.01 + (node.energy * 0.03);
      const renderRadius = getVisualRadius(node, baseRadius);
      dummy.scale.set(renderRadius, renderRadius, 1);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);

      // Paleta Neon Cyberpunk
      if (node.node_type === 'Pruned') color.setHex(0x1e293b);
      else if (node.node_type === 'Episodic') color.setHex(0x00f0ff);
      else if (node.node_type === 'Concept') color.setHex(0xf59e0b);
      else if (node.node_type === 'DreamSnapshot') color.setHex(0x8b5cf6);
      else color.setHex(0x00ff66); // Semantic = Esmeralda Matrix

      // Ubermensch: energy > 0.8 → magenta 4x (Bloom halo)
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
  }, [nodes, dummy, color]);

  // ANIMACAO LERP — 60fps, movimento organico
  useFrame(() => {
    if (!meshRef.current) return;
    let needsUpdate = false;

    nodes.forEach((node, i) => {
      meshRef.current!.getMatrixAt(i, dummy.matrix);
      currentPos.setFromMatrixPosition(dummy.matrix);
      targetPos.set(node.x, node.y, 0.01);

      // Se estiver longe, move 5% por frame (respiracao organica)
      if (currentPos.distanceTo(targetPos) > 0.001) {
        currentPos.lerp(targetPos, 0.05);
        const baseRadius = 0.01 + (node.energy * 0.03);
        const radius = getVisualRadius(node, baseRadius);
        dummy.position.copy(currentPos);
        dummy.scale.set(radius, radius, 1);
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
      <HyperbolicEdges nodes={nodes} edges={edges} />

      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, nodes.length]}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
      >
        <circleGeometry args={[1, 32]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* TOOLTIP CYBERPUNK (HTML injetado no WebGL) */}
      {hoveredNode && (
        <Html position={[hoveredNode.x, hoveredNode.y + 0.05, 0]} center style={{ pointerEvents: 'none' }}>
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
// BORDA DO DISCO
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
    // Fallback: fetch REST normal
    fetch(`${apiBase}/api/graph?collection=${collection}&limit=${limit}`)
      .then(res => res.json())
      .then(data => mapApiData(data))
      .catch(() => {}); // Silencioso se falhar

    // Tenta SSE streaming (se o backend suportar)
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

      {/* WEBGL CANVAS */}
      <Canvas>
        <OrthographicCamera makeDefault position={[0, 0, 5]} zoom={300} />
        <MapControls enableRotate={manifold === 'RIEMANN'} />

        {/* Disco de Poincare (fundo + borda) — so no modo Poincare */}
        {manifold === 'POINCARE' && (
          <>
            <mesh position={[0, 0, -0.1]}>
              <circleGeometry args={[1, 64]} />
              <meshBasicMaterial color="#050510" />
            </mesh>
            <DiskBorder />
          </>
        )}

        {/* Eixos do Circumplex — so no modo Emocao */}
        {manifold === 'EMOTION' && (
          <group>
            <Line points={[[-1, 0, 0], [1, 0, 0]]} color="#334155" transparent opacity={0.3} lineWidth={1} />
            <Line points={[[0, -1, 0], [0, 1, 0]]} color="#334155" transparent opacity={0.3} lineWidth={1} />
          </group>
        )}

        <HyperbolicUniverse nodes={graphData.nodes} edges={graphData.edges} />

        {/* BLOOM CYBERPUNK */}
        <EffectComposer enableNormalPass={false}>
          <Bloom luminanceThreshold={0.2} mipmapBlur intensity={1.5} radius={0.8} />
        </EffectComposer>
      </Canvas>

      {/* MANIFOLD SWITCHER — barra de botoes */}
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
