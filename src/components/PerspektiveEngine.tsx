/**
 * PerspektiveEngine.tsx — O Cockpit Completo (v0.3.0)
 *
 * Manifold Switcher (4 lentes), Raycaster Hover, Lerp 3D,
 * SSE + WebSocket streaming, Drag, Box-Select, Context Menu,
 * Selection Highlight, Export, Theme, Möbius Zoom,
 * Diffusion Heatmap, Energy Pulse, Reasoning Trace, GPU Layout,
 * Topological Analysis (β₀/β₁).
 */

import {
  useState, useMemo, useRef, useEffect, useCallback,
  useSyncExternalStore, type RefObject,
} from 'react';
import { Canvas, useFrame, useThree, ThreeEvent, extend } from '@react-three/fiber';
import { OrthographicCamera, OrbitControls, Line, Html } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { calculateGeodesic, getVisualRadius, type Point2D } from '../math/poincare';
import { ErrorBoundary } from './ErrorBoundary';
import { NodePayload, EdgePayload } from '../streaming/types';
import { SearchBar } from '../search/SearchBar';
import { FilterPanel } from '../search/FilterPanel';
import { useFilter } from '../search/useFilter';
import { NodeLabels } from '../search/NodeLabels';
import { WebGPULayoutRunner } from '../layouts/webgpu/compute-runner';
import { GraphStore } from '../streaming/GraphStore';
import { WebSocketClient } from '../streaming/WebSocketClient';
import { computeBetti0, computeBetti1 } from '../analysis/tda';
import { SemanticCameraAPI } from '../interaction/SemanticCamera';
import { SelectionHighlight, HoverHighlight } from '../interaction/SelectionHighlight';
import { BoxSelectOverlay } from '../interaction/BoxSelectOverlay';
import { useSelection } from '../interaction/useSelection';
import { ContextMenu } from '../interaction/ContextMenu';
import { useDrag } from '../interaction/useDrag';
import { useBoxSelect } from '../interaction/useBoxSelect';
import { MobiusZoom } from '../interaction/MobiusZoom';
import { PerspektiveThemeProvider, useTheme } from '../theme/ThemeContext';
import { presets as ThemePresets } from '../theme/presets';
import { ExportToolbar } from './overlays/ExportToolbar';
import { DiffusionHeatmap } from './overlays/DiffusionHeatmap';
import { EnergyPulse } from './overlays/EnergyPulse';
import { SchrodingerEdgeMaterial } from '../materials/SchrodingerEdgeMaterial';
import { KineticFlowEngine } from '../engine/KineticFlow';
import { DaemonRenderer, DaemonData } from '../agents/DaemonRenderer';
import { AudioPulse } from '../audio/AudioDecoder';
import { PoincareNodeMaterial } from '../materials/PoincareNodeMaterial';
import { PoincareBackgroundMaterial } from '../materials/PoincareBackgroundMaterial';
import { useWebXR } from '../xr/useWebXR';
import { EnterVRButton } from './EnterVRButton';
import type { InteractionCallbacks, ContextMenuItem } from '../interaction/types';
import { DreamOverlay } from './overlays/DreamOverlay';
import type { DreamSession } from './overlays/DreamOverlay';
import { CausalOverlay } from './overlays/CausalOverlay';
import type { CausalEdge, CausalChainResult } from './overlays/CausalOverlay';
import { ZaratustraWave } from './overlays/ZaratustraWave';
import type { ZaratustraResult } from './overlays/ZaratustraWave';
import { NarrativeTimeline } from './overlays/NarrativeTimeline';
import type { NarrativeArc } from './overlays/NarrativeTimeline';

extend({ SchrodingerEdgeMaterial, PoincareNodeMaterial, PoincareBackgroundMaterial });

declare global {
  namespace JSX {
    interface IntrinsicElements {
      schrodingerEdgeMaterial: any;
      poincareNodeMaterial: any;
      poincareBackgroundMaterial: any;
    }
  }
}

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
  z: number;
}

export interface EdgeData {
  source: string;
  target: string;
  weight: number;
}

export type ManifoldType = 'POINCARE' | 'RIEMANN' | 'MINKOWSKI' | 'EMOTION' | 'POINCARE_BALL';
export type StreamingMode = 'sse' | 'ws' | 'none';

export interface PerspektiveEngineProps {
  collection?: string;
  apiBase?: string;
  limit?: number;
  zoom?: number;
  bloomIntensity?: number;
  lerpRate?: number;
  /** 'sse' (default), 'ws', or 'none' */
  streamingMode?: StreamingMode;
  /** WebSocket URL — required when streamingMode='ws' */
  wsUrl?: string;
  /** Enable node drag. Default: true */
  enableDrag?: boolean;
  /** Enable box selection. Default: true */
  enableBoxSelect?: boolean;
  /** Enable context menu. Default: true */
  enableContextMenu?: boolean;
  /** Enable Möbius zoom in Poincaré mode. Default: true */
  enableMobiusZoom?: boolean;
  /** Custom context menu items */
  contextMenuItems?: ContextMenuItem[];
  /** Interaction callbacks */
  callbacks?: InteractionCallbacks;
  /** Active dream session to visualize ghost nodes/edges */
  dreamSession?: DreamSession | null;
  /** Callback when user applies/rejects a dream */
  onDreamAction?: (action: 'apply' | 'reject', dreamId: string) => void;
  /** Causal edges to overlay (from causal_chain API) */
  causalEdges?: CausalEdge[];
  /** Active causal chain path */
  causalChain?: CausalChainResult | null;
  /** Zaratustra cycle result to visualize */
  zaratustraResult?: ZaratustraResult | null;
  /** Narrative arcs for timeline display */
  narrativeArcs?: NarrativeArc[];
  /** Live daemon data from backend (replaces mock daemons when provided) */
  activeDaemons?: Array<{ id: string; x: number; y: number; type: 'entropy' | 'evolution' | 'patrol'; energy: number }>;
}

// ==========================================
// PROJECTION — As 4 Lentes
// ==========================================

function projectToManifold(
  n: { embedding: number[]; valence?: number; arousal?: number; energy: number },
  manifold: ManifoldType
): Point3D {
  if (!n.embedding || n.embedding.length < 2) return { x: 0, y: 0, z: 0.01 };

  if (manifold === 'POINCARE') {
    let sumSq = 0;
    for (let i = 0; i < n.embedding.length; i++) sumSq += n.embedding[i] * n.embedding[i];
    const r = Math.min(Math.sqrt(sumSq), 0.99);
    const len = Math.sqrt(n.embedding[0] ** 2 + n.embedding[1] ** 2) || 1;
    return { x: (n.embedding[0] / len) * r, y: (n.embedding[1] / len) * r, z: 0.01 };
  }
  if (manifold === 'POINCARE_BALL') {
    let sumSq = 0;
    for (let i = 0; i < Math.min(n.embedding.length, 3); i++) sumSq += n.embedding[i] * n.embedding[i];
    const r = Math.min(Math.sqrt(sumSq), 0.99);
    const len = Math.sqrt(n.embedding[0]**2 + n.embedding[1]**2 + (n.embedding[2]||0)**2) || 1;
    return { 
      x: (n.embedding[0] / len) * r, 
      y: (n.embedding[1] / len) * r, 
      z: ((n.embedding[2] || 0) / len) * r 
    };
  }
  if (manifold === 'EMOTION') {
    return { x: n.valence || 0, y: (n.arousal || 0) * 2 - 1, z: 0.01 };
  }
  if (manifold === 'RIEMANN') {
    const px = n.embedding[0] * 3;
    const py = n.embedding[1] * 3;
    const denom = 1 + px * px + py * py;
    return { x: (2 * px) / denom, y: (2 * py) / denom, z: (px * px + py * py - 1) / denom };
  }
  if (manifold === 'MINKOWSKI') {
    return { x: n.embedding[0] * 2, y: (n.energy * 5) - 2.5, z: n.embedding[1] * 2 };
  }
  return { x: 0, y: 0, z: 0.01 };
}

// ==========================================
// GEODESIC EDGES
// ==========================================

function geodesicPoints(p1: Point2D, p2: Point2D, segments = 40): [number, number, number][] {
  const geo = calculateGeodesic(p1, p2);
  if (geo.type === 'line') return [[p1.x, p1.y, 0], [p2.x, p2.y, 0]];
  const curve = new THREE.EllipseCurve(
    geo.center.x, geo.center.y, geo.radius, geo.radius,
    -geo.startAngle, -geo.endAngle, !geo.ccw, 0
  );
  return curve.getPoints(segments).map(v => [v.x, v.y, 0]);
}

const GraphEdges = ({ nodes, edges, manifold, probability = 0.8 }: { nodes: NodeData[], edges: EdgeData[], manifold: ManifoldType, probability?: number }) => {
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  const lines = useMemo(() => {
    return edges.map(edge => {
      const p1 = nodeMap.get(edge.source);
      const p2 = nodeMap.get(edge.target);
      if (!p1 || !p2) return null;
      
      const points: [number, number, number][] = manifold === 'POINCARE'
        ? geodesicPoints(p1, p2, 40)
        : [[p1.x, p1.y, p1.z], [p2.x, p2.y, p2.z]];

      return (
        <Line 
          key={`${edge.source}-${edge.target}`} 
          points={points} 
          lineWidth={1} 
          transparent 
          opacity={0.1 + edge.weight * 0.4}
        >
           <schrodingerEdgeMaterial attach="material" probability={probability} color={new THREE.Color(0x00d8ff).multiplyScalar(1.5)} />
        </Line>
      );
    }).filter(Boolean);
  }, [edges, nodeMap, manifold, probability]);

  return <group>{lines}</group>;
};

// ==========================================
// AGI OVERLAY COMPONENT
// ==========================================

const AGIOverlay = ({
  nodes, edges, showFlow, showDaemons, flowEngineRef, daemonRendererRef, activeDaemons
}: {
  nodes: NodeData[],
  edges: EdgeData[],
  showFlow: boolean,
  showDaemons: boolean,
  flowEngineRef: React.MutableRefObject<KineticFlowEngine | null>,
  daemonRendererRef: React.MutableRefObject<DaemonRenderer | null>,
  activeDaemons?: DaemonData[],
}) => {
  const { scene } = useThree();
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  useEffect(() => {
    if (showFlow && !flowEngineRef.current) {
      flowEngineRef.current = new KineticFlowEngine(scene);
    }
    if (showDaemons && !daemonRendererRef.current) {
      daemonRendererRef.current = new DaemonRenderer(scene);
    }
  }, [showFlow, showDaemons, scene, flowEngineRef, daemonRendererRef]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (showFlow && flowEngineRef.current) {
      // Mock activation based on energy
      const activeEdges = edges.map(e => ({
        source: nodeMap.get(e.source),
        target: nodeMap.get(e.target),
        activation: e.weight * 0.8
      })).filter(e => e.source && e.target);
      flowEngineRef.current.update(activeEdges, time);
    }
    if (showDaemons && daemonRendererRef.current) {
      if (activeDaemons && activeDaemons.length > 0) {
        // Use real daemon data from backend
        daemonRendererRef.current.syncDaemons(activeDaemons);
      } else {
        // Fallback: derive daemons from high-energy nodes
        const elite = nodes.filter(n => n.energy > 0.85).slice(0, 5);
        const fallbackDaemons: DaemonData[] = elite.map(n => ({
          id: `daemon-${n.id}`,
          x: n.x,
          y: n.y,
          type: n.energy > 0.9 ? 'evolution' : 'patrol',
          energy: n.energy
        }));
        daemonRendererRef.current.syncDaemons(fallbackDaemons);
      }
    }
  });

  return null;
};

// ==========================================
// MINKOWSKI LIGHT CONES
// ==========================================

const MinkowskiLightCones = ({ nodes, manifold }: { nodes: NodeData[], manifold: ManifoldType }) => {
  if (manifold !== 'MINKOWSKI') return null;
  const eliteNodes = nodes.filter(n => n.energy > 0.8);
  return (
    <group>
      {eliteNodes.map(node => (
        <group key={`cone-${node.id}`} position={[node.x, node.y, node.z]}>
          <mesh position={[0, 1, 0]}>
            <coneGeometry args={[1, 2, 32, 1, true]} />
            <meshBasicMaterial color="#00f0ff" transparent opacity={0.08}
              side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
          <mesh position={[0, -1, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[1, 2, 32, 1, true]} />
            <meshBasicMaterial color="#ff00ff" transparent opacity={0.08}
              side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        </group>
      ))}
      <gridHelper args={[10, 20, 0x334155, 0x1e293b]} position={[0, -2.5, 0]} />
    </group>
  );
};

// ==========================================
// RENDERER REF GRABBER (inside Canvas)
// ==========================================

const RendererGrabber = ({ rendererRef }: { rendererRef: RefObject<THREE.WebGLRenderer | null> }) => {
  const { gl } = useThree();
  useEffect(() => {
    (rendererRef as any).current = gl;
  }, [gl, rendererRef]);
  return null;
};

// ==========================================
// NODES — InstancedMesh + Drag + Hover
// ==========================================

const GraphNodes = ({
  nodes, manifold, lerpRate = 0.05,
  controlsRef, enableDrag,
  callbacks,
  overlayEmotion,
  audioAmplitude = 0
}: {
  nodes: NodeData[];
  manifold: ManifoldType;
  lerpRate?: number;
  controlsRef: RefObject<any>;
  enableDrag: boolean;
  callbacks?: InteractionCallbacks;
  overlayEmotion?: boolean;
  audioAmplitude?: number;
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const [hoveredNode, setHoveredNode] = useState<NodeData | null>(null);

  const { matchedIds, isActive: filterActive } = useFilter();
  const { selectedIds } = useSelection();

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const targetPos = useMemo(() => new THREE.Vector3(), []);
  const currentPos = useMemo(() => new THREE.Vector3(), []);

  // Drag hook
  const { handlePointerDown, handlePointerMove, handlePointerUp } = useDrag({
    nodes,
    manifold,
    orbitControlsRef: controlsRef,
    onUpdatePositions: (updates) => {
      // Mutate raw node positions directly (store picks up via subscription)
      const nodeById = new Map(nodes.map(n => [n.id, n]));
      updates.forEach(({ id, x, y, z }) => {
        const n = nodeById.get(id);
        if (n) { n.x = x; n.y = y; n.z = z; }
      });
    },
    callbacks,
  });

  // Attach drag listeners to window
  useEffect(() => {
    if (!enableDrag) return;
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [enableDrag, handlePointerMove, handlePointerUp]);

  // Setup initial matrices
  useEffect(() => {
    if (!meshRef.current) return;
    nodes.forEach((node, i) => {
      dummy.position.set(node.x, node.y, node.z);
      const baseRadius = 0.01 + (node.energy * 0.03);
      const renderRadius = manifold === 'POINCARE' ? getVisualRadius(node, baseRadius) : baseRadius;
      dummy.scale.set(renderRadius, renderRadius, 1);
      if (manifold === 'RIEMANN') dummy.lookAt(0, 0, 0);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);

      setNodeColor(node, color);
      meshRef.current!.setColorAt(i, color);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [nodes, dummy, color, manifold]);

  // LERP + filter dimming
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
          ? getVisualRadius(node, isHighlighted ? baseRadius : baseRadius * 0.3)
          : (isHighlighted ? baseRadius : baseRadius * 0.3);

        dummy.position.copy(currentPos);
        dummy.scale.set(radius, radius, 1);
        if (manifold === 'RIEMANN') dummy.lookAt(0, 0, 0);
        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(i, dummy.matrix);

        if (isHighlighted) {
           if (overlayEmotion && (node as any).agColor) {
             color.copy((node as any).agColor);
           } else {
             setNodeColor(node, color);
           }
        } else {
           color.setHex(0x0f172a);
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

  const handlePointerMoveR3F = useCallback((e: ThreeEvent<PointerEvent>) => {
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
        onPointerMove={handlePointerMoveR3F}
        onPointerOut={handlePointerOut}
        onPointerDown={enableDrag ? (e: any) => handlePointerDown(e) : undefined}
      >
        <circleGeometry args={[1, 32]} />
        {manifold === 'POINCARE' 
          ? <poincareNodeMaterial attach="material" uAudioAmplitude={audioAmplitude} />
          : <meshBasicMaterial toneMapped={false} />
        }
      </instancedMesh>

      {/* Selection rings inside Canvas */}
      <SelectionHighlight nodes={nodes} manifold={manifold} />
      <HoverHighlight hoveredNode={hoveredNode} manifold={manifold} />

      {/* SDF Labels for elite nodes */}
      <NodeLabels nodes={nodes} manifold={manifold} />

      {/* Tooltip */}
      {hoveredNode && (
        <Html position={[hoveredNode.x, hoveredNode.y + 0.05, hoveredNode.z]} center style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(2,6,23,0.9)', border: '1px solid #00f0ff', color: '#fff',
            padding: '10px', borderRadius: '4px', fontFamily: 'monospace', width: '220px',
            backdropFilter: 'blur(4px)', boxShadow: '0 0 10px rgba(0,240,255,0.5)',
          }}>
            <div style={{ color: '#00f0ff', fontWeight: 'bold', marginBottom: 4 }}>{hoveredNode.node_type}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>ID: {hoveredNode.id.substring(0, 12)}...</div>
            <div style={{ fontSize: 11, color: '#ff00ff' }}>Energy: {(hoveredNode.energy * 100).toFixed(1)}%</div>
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
// HELPERS
// ==========================================

function setNodeColor(node: NodeData, color: THREE.Color) {
  if (node.node_type === 'Pruned') color.setHex(0x1e293b);
  else if (node.node_type === 'Episodic') color.setHex(0x00f0ff);
  else if (node.node_type === 'Concept') color.setHex(0xf59e0b);
  else if (node.node_type === 'DreamSnapshot') color.setHex(0x8b5cf6);
  else color.setHex(0x00ff66);

  if (node.energy > 0.8) { color.setHex(0xff00ff); color.multiplyScalar(4.0); }
  else if (node.energy > 0.5) color.multiplyScalar(2.0);
}

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

const RiemannWireframe = ({ manifold }: { manifold: ManifoldType }) => {
  if (manifold !== 'RIEMANN') return null;
  return (
    <mesh>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial color="#1e293b" wireframe transparent opacity={0.15} />
    </mesh>
  );
};

const ReasoningTrace = ({ nodes, traceIds, manifold }: { nodes: NodeData[], traceIds: string[], manifold: ManifoldType }) => {
  if (traceIds.length < 2) return null;
  const points = useMemo(() => {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const pts: [number, number, number][] = [];
    traceIds.forEach(id => {
      const node = nodeMap.get(id);
      if (node) pts.push([node.x, node.y, node.z]);
    });
    return pts;
  }, [nodes, traceIds]);
  return (
    <group>
      <Line points={points} color="#00f0ff" lineWidth={3} transparent opacity={0.8} />
      <Line points={points} color="#ff00ff" lineWidth={1} transparent opacity={0.5} />
    </group>
  );
};

// ==========================================
// THEME SWITCHER
// ==========================================

const ThemeSwitcher = () => {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const themeNames = Object.keys(ThemePresets) as (keyof typeof ThemePresets)[];

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ ...btnStyle, fontSize: 10, color: '#8b5cf6', borderColor: '#8b5cf6' }}
      >
        🎨 {theme.name.toUpperCase()}
      </button>
      {open && (
        <div style={{
          position: 'absolute', bottom: '100%', right: 0, marginBottom: 4,
          background: 'rgba(2,6,23,0.95)', border: '1px solid #334155',
          borderRadius: 4, overflow: 'hidden', zIndex: 200,
        }}>
          {themeNames.map(name => (
            <button
              key={name.toString()}
              onClick={() => { setTheme(ThemePresets[name] as any); setOpen(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: theme.name === name ? 'rgba(139,92,246,0.2)' : 'transparent',
                border: 'none', color: theme.name === name ? '#8b5cf6' : '#94a3b8',
                fontFamily: 'monospace', fontSize: 11, padding: '6px 14px', cursor: 'pointer',
              }}
            >
              {name.toString()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ==========================================
// MAIN ENGINE
// ==========================================

const PerspektiveEngineInner = ({
  collection = 'default',
  apiBase = '',
  limit = 2000,
  zoom = 300,
  bloomIntensity = 1.5,
  lerpRate = 0.05,
  streamingMode = 'sse',
  wsUrl,
  enableDrag = true,
  enableBoxSelect = true,
  enableContextMenu = true,
  enableMobiusZoom = true,
  contextMenuItems,
  callbacks,
  dreamSession,
  onDreamAction,
  causalEdges,
  causalChain,
  zaratustraResult,
  narrativeArcs,
  activeDaemons,
}: PerspektiveEngineProps) => {
  const [manifold, setManifold] = useState<ManifoldType>('POINCARE');
  const [streaming, setStreaming] = useState(false);
  const [wsStatus, setWsStatus] = useState<string>('');
  const [gpuActive, setGpuActive] = useState(false);
  const [activeTrace, setActiveTrace] = useState<string[]>([]);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showPulse, setShowPulse] = useState(true);
  const [showFlow, setShowFlow] = useState(true);
  const [showDaemons, setShowDaemons] = useState(true);
  const [overlayEmotion, setOverlayEmotion] = useState(false); // A 5ª Lente
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; position: { x: number; y: number }; targetIds: string[] }>({ visible: false, position: { x: 0, y: 0 }, targetIds: [] });

  // Möbius zoom
  const mobiusRef = useRef(new MobiusZoom());

  // Graph store
  const storeRef = useRef(new GraphStore());
  const gpuRunnerRef = useRef<WebGPULayoutRunner | null>(null);
  const semanticCameraRef = useRef<SemanticCameraAPI | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  const audioPulseRef = useRef(new AudioPulse());
  const [audioAmplitude, setAudioAmplitude] = useState(0);

  const controlsRef = useRef<any>(null);
  const cameraRef = useRef<THREE.OrthographicCamera>(null);

  const flowEngineRef = useRef<KineticFlowEngine | null>(null);
  const daemonRendererRef = useRef<DaemonRenderer | null>(null);

  // WebXR Portal
  const [glContext, setGlContext] = useState<WebGLRenderingContext | WebGL2RenderingContext | null>(null);
  const { isSupported, xrSession, enterVR } = useWebXR(glContext);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (rendererRef.current) {
        setGlContext(rendererRef.current.getContext());
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const { nodes: graphNodes, edges: graphEdges, nodeCount, edgeCount } =
    useSyncExternalStore(
      (l: any) => storeRef.current.subscribe(l),
      () => storeRef.current.getSnapshot()
    );

  const { setNodes } = useFilter();
  const { deselectAll } = useSelection();

  const is2D = manifold === 'POINCARE' || manifold === 'EMOTION';
  const is3D = manifold === 'POINCARE_BALL' || manifold === 'RIEMANN' || manifold === 'MINKOWSKI';

  // Betti numbers: offload to server for large graphs (>5k nodes)
  const { betti0, betti1 } = useMemo(() => {
    if (graphNodes.length > 5000) {
      // Skip client-side computation for large graphs to avoid UI freeze.
      // Server-side WCC (β₀) and TriangleCount (β₁) are available via /api/algo/*.
      return { betti0: -1, betti1: -1 };
    }
    const b0 = computeBetti0(graphNodes, graphEdges);
    const b1 = computeBetti1(graphNodes, graphEdges, b0);
    return { betti0: b0, betti1: b1 };
  }, [graphNodes, graphEdges]);

  // Project graph onto chosen manifold, applying Möbius if needed
  const graphData = useMemo(() => {
    const nodes = graphNodes.map((n: NodePayload) => {
      const pos = projectToManifold(n, manifold);
      let projected = { ...n, ...pos } as NodeData;
      // Apply Möbius transform in Poincaré mode
      if (manifold === 'POINCARE' && enableMobiusZoom) {
        const mp = mobiusRef.current.project({ x: projected.x, y: projected.y });
        projected = { ...projected, x: mp.x, y: mp.y };
      }

      // Mix Manifolds (A 5ª Lente)
      if (overlayEmotion && (manifold === 'POINCARE' || manifold === 'MINKOWSKI')) {
        const emotionColor = new THREE.Color().setHSL(
          (projected.valence! + 1) / 2 * 0.4, 
          projected.arousal! || 0.5, 
          0.5
        );
        // We inject a special color prop for the renderer to pick up
        (projected as any).agColor = emotionColor;
      }

      return projected;
    });
    const edges = graphEdges.map((e: EdgePayload) => ({
      source: e.source, target: e.target, weight: e.weight || 0.5,
    }));
    return { nodes, edges };
  }, [graphNodes, graphEdges, manifold, enableMobiusZoom]);

  // Streaming: SSE or WebSocket
  useEffect(() => {
    import('../math/wasm-bridge').then(m => m.initWasm());

    gpuRunnerRef.current = new WebGPULayoutRunner();
    gpuRunnerRef.current.init()
      .then(() => console.log('🛡️ WebGPU Layout Engine Ready'))
      .catch(e => console.warn('WebGPU not available:', e.message));

    // Initial REST fetch
    fetch(`${apiBase}/api/graph?collection=${collection}&limit=${limit}`)
      .then(res => res.json())
      .then(data => { if (data?.nodes) storeRef.current.loadFull(data.nodes, data.edges || []); })
      .catch(() => {});

    if (streamingMode === 'sse') {
      const sseUrl = `${apiBase}/api/graph/stream?collection=${collection}`;
      const eventSource = new EventSource(sseUrl);
      eventSource.onopen = () => setStreaming(true);
      eventSource.onmessage = (event) => {
        try {
          if (event.data.startsWith('bin:')) {
            const binary = Uint8Array.from(atob(event.data.substring(4)), c => c.charCodeAt(0));
            storeRef.current.applyBinaryBatch(binary, Date.now());
            return;
          }
          const data = JSON.parse(event.data);
          if (data?.nodes || data?.edges) storeRef.current.applyDelta(data);
        } catch { /* ignore */ }
      };
      eventSource.onerror = () => { setStreaming(false); eventSource.close(); };
      return () => { eventSource.close(); setStreaming(false); gpuRunnerRef.current?.destroy(); };

    } else if (streamingMode === 'ws' && wsUrl) {
      const wsClient = new WebSocketClient({ url: wsUrl, store: storeRef.current });
      const unsub = wsClient.subscribe(status => {
        setStreaming(status === 'open');
        setWsStatus(status);
      });
      wsClient.connect();
      return () => { unsub(); wsClient.destroy(); gpuRunnerRef.current?.destroy(); };
    }

    return () => { gpuRunnerRef.current?.destroy(); };
  }, [collection, apiBase, limit, streamingMode, wsUrl]);

  // WebGPU layout loop
  useEffect(() => {
    if (!gpuActive || !gpuRunnerRef.current || graphNodes.length === 0) return;
    const ncount = graphNodes.length;
    const initialData = new Float32Array(ncount * 6);
    graphNodes.forEach((node: NodePayload, i: number) => {
      initialData[i * 6 + 0] = node.x ?? 0; initialData[i * 6 + 1] = node.y ?? 0;
      initialData[i * 6 + 2] = 0; initialData[i * 6 + 3] = 0;
      initialData[i * 6 + 4] = node.energy ?? 0.5; initialData[i * 6 + 5] = 1.0;
    });
    gpuRunnerRef.current.setupBuffers(initialData);
    let frameId: number;
    const tick = async () => {
      if (!gpuRunnerRef.current) return;
      gpuRunnerRef.current.updateParams({ nodeCount: ncount, deltaTime: 0.016, viscosity: 0.9, repulsionStrength: 0.001, gravityStrength: 0.05, centerX: 0, centerY: 0 });
      const results = await gpuRunnerRef.current.step(ncount);
      graphNodes.forEach((n: NodePayload, i: number) => { n.x = results[i * 6]; n.y = results[i * 6 + 1]; });
      storeRef.current.handleMutation();
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [gpuActive, graphNodes.length]);

  // Audio uniform update loop + WebXR Matrix Injection
  useFrame((state) => {
    const amp = audioPulseRef.current.getAmplitude();
    if (amp !== audioAmplitude) setAudioAmplitude(amp);

    const time = state.clock.getElapsedTime();

    // Auto-switch to Poincaré Ball 3D when entering VR
    if (xrSession && manifold !== 'POINCARE_BALL') {
       setManifold('POINCARE_BALL');
    }

    // Update uniforms only on materials that have them (skip non-shader objects)
    state.scene.traverse((obj: any) => {
      const mat = obj.material;
      if (!mat || !mat.uniforms) return;
      if (mat.uniforms.uAudioAmplitude) mat.uniforms.uAudioAmplitude.value = amp;
      if (mat.uniforms.u_audioAmplitude) mat.uniforms.u_audioAmplitude.value = amp;
      if (mat.uniforms.uTime) mat.uniforms.uTime.value = time;
      if (mat.uniforms.u_time) mat.uniforms.u_time.value = time;
      if (mat.uniforms.u_resolution) {
         mat.uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
      }
    });
  });

  useEffect(() => { setNodes(graphNodes); }, [graphNodes, setNodes]);

  // Camera controls
  const handleZoom = (factor: number) => {
    if (cameraRef.current) { cameraRef.current.zoom *= factor; cameraRef.current.updateProjectionMatrix(); }
  };
  const handleFitView = () => {
    if (controlsRef.current && cameraRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      cameraRef.current.position.set(0, 0, 5);
      cameraRef.current.zoom = zoom;
      cameraRef.current.updateProjectionMatrix();
      controlsRef.current.update();
      mobiusRef.current.reset();
    }
  };

  // Möbius wheel handler (Poincaré only)
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (manifold !== 'POINCARE' || !enableMobiusZoom) return;
    // Convert mouse position to world coordinates
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    const cam = cameraRef.current;
    if (!cam) return;
    const worldPos = new THREE.Vector3(ndcX, ndcY, 0).unproject(cam);
    mobiusRef.current.translate({ x: worldPos.x, y: worldPos.y }, e.deltaY);
    // Trigger a re-render by forcing store notification
    storeRef.current.handleMutation();
  }, [manifold, enableMobiusZoom]);

  // Context menu setup
  const defaultContextItems: ContextMenuItem[] = useMemo(() => [
    { label: '🔍 Focus', action: (ids) => { callbacks?.onFocus?.(ids[0]); }, icon: '🔍' },
    { label: '📡 Expand Neighbors', action: (ids) => { callbacks?.onExpandNeighbors?.(ids[0]); }, icon: '📡', separator: true },
    { label: '📌 Toggle Pin', action: (ids) => { callbacks?.onTogglePin?.(ids, true); }, icon: '📌' },
    { label: '🚫 Hide', action: (ids) => { const s = useSelection.getState(); s.hideNodes(ids); callbacks?.onHide?.(ids); }, icon: '🚫', separator: true },
    { label: '✖ Deselect All', action: () => deselectAll(), icon: '✖' },
  ], [callbacks, deselectAll]);

  const streamLabel = streamingMode === 'ws'
    ? (streaming ? '🔌 WS STREAMING' : `🔌 WS ${wsStatus.toUpperCase()}`)
    : (streaming ? '● SSE STREAMING' : '● POLLING');

  return (
    <div
      style={{ position: 'relative', width: '100%', height: '100vh', background: '#000' }}
      onWheel={enableMobiusZoom ? handleWheel : undefined}
      onContextMenu={(e) => {
        if (!enableContextMenu) return;
        e.preventDefault();
        const { selectedIds } = useSelection.getState();
        const ids = selectedIds.size > 0 ? Array.from(selectedIds) : [];
        setContextMenu({ visible: ids.length > 0, position: { x: e.clientX, y: e.clientY }, targetIds: ids });
      }}
      role="application"
      aria-label="Perspektive Graph Engine"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Tab') {
          // Future: node-to-node focus cycle
        }
        if (e.key === 'f') handleFitView();
        if (e.key === 'm') setManifold(prev => {
          const m: ManifoldType[] = ['POINCARE', 'RIEMANN', 'MINKOWSKI', 'EMOTION'];
          return m[(m.indexOf(prev) + 1) % m.length];
        });
      }}
    >
      <ErrorBoundary>
        <Canvas>
          <RendererGrabber rendererRef={rendererRef} />

          {is2D && <OrthographicCamera ref={cameraRef} makeDefault position={[0, 0, 5]} zoom={zoom} />}
          <OrbitControls
            ref={controlsRef}
            enableRotate={!is2D}
            enablePan={true}
            enableZoom={!enableMobiusZoom || manifold !== 'POINCARE'}
          />

          {/* Poincaré: background disk + border */}
          {manifold === 'POINCARE' && (
            <>
              <mesh position={[0, 0, -0.1]}>
                <planeGeometry args={[20, 20]} />
                <poincareBackgroundMaterial 
                  attach="material" 
                  u_audioAmplitude={audioAmplitude} 
                />
              </mesh>
              <DiskBorder />
            </>
          )}

          {/* Emotion: Circumplex axes */}
          {manifold === 'EMOTION' && (
            <group>
              <Line points={[[-1.2, 0, 0], [1.2, 0, 0]]} color="#334155" transparent opacity={0.4} lineWidth={1} />
              <Line points={[[0, -1.2, 0], [0, 1.2, 0]]} color="#334155" transparent opacity={0.4} lineWidth={1} />
              {[['ALEGRIA', 0.6, 0.6], ['RAIVA', -0.6, 0.6], ['CALMA', 0.6, -0.6], ['TRISTEZA', -0.6, -0.6]].map(([label, x, y]) => (
                <Html key={label as string} position={[x as number, y as number, 0]}>
                  <div style={{ color: '#334155', fontFamily: 'monospace', fontSize: 9, pointerEvents: 'none' }}>{label}</div>
                </Html>
              ))}
            </group>
          )}

          <RiemannWireframe manifold={manifold} />
          <MinkowskiLightCones nodes={graphData.nodes} manifold={manifold} />

          {/* Overlays */}
          <DiffusionHeatmap nodes={graphData.nodes} visible={showHeatmap && manifold === 'POINCARE'} />
          {showPulse && <EnergyPulse nodes={graphData.nodes} manifold={manifold} />}

          <GraphEdges nodes={graphData.nodes} edges={graphData.edges} manifold={manifold} />
          
          {/* AGI Overlay Logic */}
          <AGIOverlay
            nodes={graphData.nodes}
            edges={graphData.edges}
            showFlow={showFlow}
            showDaemons={showDaemons}
            flowEngineRef={flowEngineRef}
            daemonRendererRef={daemonRendererRef}
            activeDaemons={activeDaemons}
          />

          <GraphNodes
            nodes={graphData.nodes}
            manifold={manifold}
            lerpRate={lerpRate}
            controlsRef={controlsRef}
            enableDrag={enableDrag}
            callbacks={callbacks}
            overlayEmotion={overlayEmotion}
          />

          <ReasoningTrace nodes={graphData.nodes} traceIds={activeTrace} manifold={manifold} />

          {/* NietzscheDB Overlays */}
          {dreamSession && (
            <DreamOverlay
              session={dreamSession}
              onApply={() => onDreamAction?.('apply', dreamSession.dreamId)}
              onReject={() => onDreamAction?.('reject', dreamSession.dreamId)}
            />
          )}
          {causalEdges && causalEdges.length > 0 && (
            <CausalOverlay
              edges={causalEdges}
              chain={causalChain ?? undefined}
            />
          )}
          {zaratustraResult && (
            <ZaratustraWave
              result={zaratustraResult}
              nodes={graphData.nodes}
            />
          )}

          <EffectComposer enableNormalPass={false}>
            <Bloom luminanceThreshold={0.2} mipmapBlur intensity={bloomIntensity} radius={0.8} />
          </EffectComposer>
        </Canvas>
      </ErrorBoundary>

      {/* WebXR Portal Button */}
      <EnterVRButton isSupported={isSupported} onClick={enterVR} inSession={!!xrSession} />

      {/* Box select overlay */}
      {enableBoxSelect && <BoxSelectOverlay />}

      {/* Context Menu */}
      {enableContextMenu && (
        <ContextMenu
          visible={contextMenu.visible}
          position={contextMenu.position}
          targetIds={contextMenu.targetIds}
          nodes={graphData.nodes}
          customItems={contextMenuItems || defaultContextItems}
          onClose={() => setContextMenu(prev => ({ ...prev, visible: false }))}
        />
      )}

      {/* Narrative Timeline */}
      {narrativeArcs && narrativeArcs.length > 0 && (
        <div style={{ position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
          <NarrativeTimeline arcs={narrativeArcs} />
        </div>
      )}

      {/* ── HUD TOP-LEFT ── */}
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10 }}>
        <h2 style={{ color: '#00f0ff', margin: '0 0 10px 0', fontFamily: 'monospace', textShadow: '0 0 5px #00f0ff' }}>
          NietzscheDB // Perspektive
        </h2>
        <SearchBar totalNodes={graphData.nodes.length} />
        <FilterPanel />

        <div style={{ color: '#94a3b8', fontFamily: 'monospace', marginTop: '130px', fontSize: '12px', pointerEvents: 'none' }}>
          <span style={{ color: streaming ? '#00ff66' : '#f59e0b' }}>
            {streamLabel}
          </span>
          {' | '}NOS: {nodeCount} | EDGES: {edgeCount}
          {' | '}β₀: {betti0 < 0 ? '...' : betti0} | β₁: {betti1 < 0 ? '...' : betti1}
        </div>
      </div>

      {/* ── HUD TOP-RIGHT ── */}
      <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 10 }}>
        {/* Camera controls */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.8)', padding: 5, borderRadius: 6, border: '1px solid #334155' }}>
          <button onClick={() => handleZoom(1.2)} style={btnStyle}>➕</button>
          <button onClick={() => handleZoom(0.8)} style={btnStyle}>➖</button>
          <button onClick={handleFitView} style={btnStyle}>[ FIT ]</button>
        </div>

        {/* Overlay toggles */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.8)', padding: 5, borderRadius: 6, border: '1px solid #334155' }}>
          <button
            onClick={() => setShowHeatmap(h => !h)}
            style={{ ...btnStyle, color: showHeatmap ? '#00f0ff' : '#94a3b8', borderColor: showHeatmap ? '#00f0ff' : '#334155' }}
            title="Toggle Diffusion Heatmap"
          >🌡️</button>
          <button
            onClick={() => setShowPulse(p => !p)}
            style={{ ...btnStyle, color: showPulse ? '#ff00ff' : '#94a3b8', borderColor: showPulse ? '#ff00ff' : '#334155' }}
            title="Toggle Energy Pulse"
          >💫</button>
          <button
            onClick={() => setShowFlow(f => !f)}
            style={{ ...btnStyle, color: showFlow ? '#ff00ff' : '#94a3b8', borderColor: showFlow ? '#ff00ff' : '#334155' }}
            title="Toggle Kinetic Heat Flow"
          >⚡</button>
          <button
            onClick={() => setShowDaemons(d => !d)}
            style={{ ...btnStyle, color: showDaemons ? '#ff9900' : '#94a3b8', borderColor: showDaemons ? '#ff9900' : '#334155' }}
            title="Toggle Daemons"
          >🛡️</button>
          <button
            onClick={() => setOverlayEmotion(e => !e)}
            style={{ ...btnStyle, color: overlayEmotion ? '#00ff66' : '#94a3b8', borderColor: overlayEmotion ? '#00ff66' : '#334155' }}
            title="Toggle Emotion Overlay (5th Lens)"
          >👁️</button>
        </div>

        {/* Export */}
        <ExportToolbar rendererRef={rendererRef} nodes={graphData.nodes} edges={graphData.edges} />

        {/* Theme switcher */}
        <ThemeSwitcher />
      </div>

      {/* ── MANIFOLD SWITCHER (bottom center) ── */}
      <div style={{
        position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 12, background: 'rgba(0,0,0,0.8)', padding: '10px 20px',
        border: '1px solid #334155', borderRadius: 8, backdropFilter: 'blur(10px)',
      }}>
        {(['POINCARE', 'POINCARE_BALL', 'RIEMANN', 'MINKOWSKI', 'EMOTION'] as ManifoldType[]).map(m => (
          <button key={m} onClick={() => setManifold(m)} style={{
            background: manifold === m ? '#00f0ff' : 'transparent',
            color: manifold === m ? '#000' : '#94a3b8',
            border: `1px solid ${manifold === m ? '#00f0ff' : '#334155'}`,
            padding: '8px 16px', borderRadius: 4, cursor: 'pointer',
            fontFamily: 'monospace', fontWeight: 'bold', fontSize: 13,
            transition: 'all 0.3s ease',
          }}>{m}</button>
        ))}
      </div>

      {/* ── GPU TOGGLE (bottom right) ── */}
      <div style={{ position: 'absolute', bottom: 30, right: 30, zIndex: 10 }}>
        <button onClick={() => setGpuActive(!gpuActive)} style={{
          ...btnStyle,
          borderColor: gpuActive ? '#00ff66' : '#334155',
          color: gpuActive ? '#00ff66' : '#fff',
          background: gpuActive ? 'rgba(0,255,102,0.1)' : 'rgba(0,0,0,0.8)',
        }}>
          {gpuActive ? '🚀 GPU ACTIVE' : '📡 USE GPU LAYOUT'}
        </button>
      </div>
    </div>
  );
};

// ==========================================
// EXPORT — Wrapped in ThemeProvider
// ==========================================

export const PerspektiveEngine = (props: PerspektiveEngineProps) => (
  <PerspektiveThemeProvider>
    <PerspektiveEngineInner {...props} />
  </PerspektiveThemeProvider>
);

const btnStyle: React.CSSProperties = {
  background: 'transparent', color: '#fff', border: '1px solid #334155',
  padding: '6px 12px', borderRadius: '4px', cursor: 'pointer',
  fontFamily: 'monospace', fontWeight: 'bold',
};
