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
import { ErrorBoundary } from './ErrorBoundary';
import { SearchBar } from '../search/SearchBar';
import { FilterPanel } from '../search/FilterPanel';
import { useFilter } from '../search/useFilter';

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
  zoom?: number;
  bloomIntensity?: number;
  lerpRate?: number;
}

interface RawNode {
  id: string;
  node_type: string;
  energy: number;
  embedding: number[];
  arousal?: number;
  valence?: number;
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

const GraphNodes = ({ nodes, manifold, lerpRate = 0.05 }: { nodes: NodeData[], manifold: ManifoldType, lerpRate?: number }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const [hoveredNode, setHoveredNode] = useState<NodeData | null>(null);

  const { matchedIds, isActive: filterActive } = useFilter();

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

      const isHighlighted = !filterActive || matchedIds.has(node.id);

      if (currentPos.distanceTo(targetPos) > 0.001 || filterActive) {
        currentPos.lerp(targetPos, lerpRate);
        const baseRadius = 0.01 + (node.energy * 0.03);
        const radius = manifold === 'POINCARE' 
          ? getVisualRadius(node, isHighlighted ? baseRadius : baseRadius * 0.4) 
          : (isHighlighted ? baseRadius : baseRadius * 0.4);
        
        dummy.position.copy(currentPos);
        dummy.scale.set(radius, radius, 1);

        if (manifold === 'RIEMANN') dummy.lookAt(0, 0, 0);

        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(i, dummy.matrix);

        // Update color for dimming
        if (isHighlighted) {
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
        } else {
          color.setHex(0x0f172a); // Dimmed color
        }
        meshRef.current!.setColorAt(i, color);
        
        needsUpdate = true;
      }
    });

    if (needsUpdate) {
      meshRef.current.instanceMatrix.needsUpdate = true;
      if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    }
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

      {/* LABELS SDF DE ALTA PERFORMANCE */}
      <NodeLabels nodes={nodes} manifold={manifold} />

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
  zoom = 300,
  bloomIntensity = 1.5,
  lerpRate = 0.05,
}: PerspektiveEngineProps) => {
  const [manifold, setManifold] = useState<ManifoldType>('POINCARE');
  const [rawData, setRawData] = useState<{ nodes: RawNode[]; edges: EdgeData[] }>({ nodes: [], edges: [] });
  const [streaming, setStreaming] = useState(false);

  const controlsRef = useRef<any>(null);
  const cameraRef = useRef<THREE.OrthographicCamera>(null);

  const { setNodes } = useFilter();

  const is2D = manifold === 'POINCARE' || manifold === 'EMOTION';

  // Projeção reativa: recalcula quando rawData ou manifold muda (sem reconectar SSE)
  const graphData = useMemo(() => {
    const nodes = rawData.nodes.map(n => {
      const pos = projectToManifold(n, manifold);
      return { ...n, ...pos } as NodeData;
    });
    const edges = rawData.edges.map(e => ({
      source: e.source,
      target: e.target,
      weight: e.weight || 0.5,
    }));
    return { nodes, edges };
  }, [rawData, manifold]);

  // SSE STREAMING com fallback REST (não depende de manifold)
  useEffect(() => {
    fetch(`${apiBase}/api/graph?collection=${collection}&limit=${limit}`)
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.nodes) && Array.isArray(data.edges)) {
          setRawData(data);
        }
      })
      .catch(() => {});

    const sseUrl = `${apiBase}/api/graph/stream?collection=${collection}`;
    const eventSource = new EventSource(sseUrl);

    eventSource.onopen = () => setStreaming(true);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && Array.isArray(data.nodes) && Array.isArray(data.edges)) {
          setRawData(data);
        }
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
  }, [collection, apiBase, limit]);

  useEffect(() => {
    setNodes(rawData.nodes);
  }, [rawData.nodes, setNodes]);

  // FUNÇÕES DE CÂMERA (Fit View e Zoom)
  const handleZoom = (factor: number) => {
    if (cameraRef.current) {
      cameraRef.current.zoom *= factor;
      cameraRef.current.updateProjectionMatrix();
    }
  };

  const handleFitView = () => {
    if (controlsRef.current && cameraRef.current) {
      controlsRef.current.target.set(0, 0, 0); // Reseta o centro
      cameraRef.current.position.set(0, 0, 5); // Reseta a distância
      cameraRef.current.zoom = zoom;           // Zoom padrão
      cameraRef.current.updateProjectionMatrix();
      controlsRef.current.update();
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', background: '#000' }}>

      <ErrorBoundary>
      <Canvas>
        {/* Camera: Ortografica pro 2D, Perspectiva implícita pro 3D */}
        {is2D && <OrthographicCamera ref={cameraRef} makeDefault position={[0, 0, 5]} zoom={zoom} />}

        {/* OrbitControls: rotacao travada nos modos 2D, livre nos 3D */}
        <OrbitControls
          ref={controlsRef}
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
        <GraphNodes nodes={graphData.nodes} manifold={manifold} lerpRate={lerpRate} />

        {/* BLOOM CYBERPUNK */}
        <EffectComposer enableNormalPass={false}>
          <Bloom luminanceThreshold={0.2} mipmapBlur intensity={bloomIntensity} radius={0.8} />
        </EffectComposer>
      </Canvas>
      </ErrorBoundary>

      {/* HUD SUPERIOR: SEARCH E STATUS */}
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10 }}>
        <h2 style={{ color: '#00f0ff', margin: '0 0 10px 0', fontFamily: 'monospace', textShadow: '0 0 5px #00f0ff' }}>
          NietzscheDB // Perspektive
        </h2>
        <SearchBar totalNodes={graphData.nodes.length} />
        <FilterPanel />
        
        <div style={{ color: '#94a3b8', fontFamily: 'monospace', marginTop: '130px', fontSize: '12px', pointerEvents: 'none' }}>
          <span style={{ color: streaming ? '#00ff66' : '#f59e0b' }}>
            ● {streaming ? 'SSE STREAMING' : 'POLLING'}
          </span> | 
          NOS: {graphData.nodes.length} | EDGES: {graphData.edges.length}
        </div>
      </div>

      {/* HUD LATERAL DIREITO: CONTROLES DE CÂMERA */}
      <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 10 }}>
        <div style={{ display: 'flex', gap: '5px', background: 'rgba(0,0,0,0.8)', padding: '5px', borderRadius: '6px', border: '1px solid #334155' }}>
          <button onClick={() => handleZoom(1.2)} style={btnStyle}>➕</button>
          <button onClick={() => handleZoom(0.8)} style={btnStyle}>➖</button>
          <button onClick={handleFitView} style={btnStyle}>[ FIT ]</button>
        </div>
      </div>

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
    </div>
  );
};

// Estilo auxiliar para botões do HUD
const btnStyle = {
  background: 'transparent', color: '#fff', border: '1px solid #334155', 
  padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontFamily: 'monospace', fontWeight: 'bold'
};
