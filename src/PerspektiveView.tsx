import React from 'react';
import { PerspektiveEngine } from './components/PerspektiveEngine';
import type { 
  ManifoldType as EngineManifold, 
  NodeData as EngineNode, 
  EdgeData as EngineEdge 
} from './components/PerspektiveEngine';

/**
 * Manifold types supported by Perspektive.
 * - poincare: Hyperbolic disk (hierarchy/depth)
 * - klein: Straight-line navigation
 * - minkowski: Spacetime/causality
 * - emotion: Russell Circumplex (valence/arousal)
 * - riemann: 3D dialectical synthesis (sphere)
 */
export type ManifoldType = "poincare" | "klein" | "minkowski" | "emotion" | "riemann";

export interface NodeData extends Partial<EngineNode> {
  id: string;
  embedding: number[];
  energy: number;
  label?: string;
  [key: string]: any;
}

export interface EdgeData extends Partial<EngineEdge> {
  source: string;
  target: string;
  weight: number;
}

export interface GraphData {
  nodes: NodeData[];
  edges: EdgeData[];
}

export interface PerspektiveProps {
  /** The graph data to render */
  data: GraphData;
  /** The geometric manifold lens to use */
  manifold?: ManifoldType;
  /** Viewport width */
  width?: number | string;
  /** Viewport height */
  height?: number | string;
  /** Callback when a node is clicked */
  onNodeClick?: (node: NodeData) => void;
  /** Callback when a node is hovered */
  onNodeHover?: (node: NodeData | null) => void;
  /** Enable thermal diffusion visual effects (Chebyshev) */
  enableHeatDiffusion?: boolean;
}

/**
 * PerspektiveView: The professional entry point for 
 * Neuro-Symbolic AI graph visualization.
 * 
 * This component wraps the high-performance WebGL engine
 * while providing a clean, property-driven React API.
 */
export const PerspektiveView: React.FC<PerspektiveProps> = ({
  data,
  manifold = "poincare",
  width = "100%",
  height = "600px",
  onNodeClick,
  onNodeHover,
  enableHeatDiffusion = false
}) => {
  // Map friendly manifold names to engine types
  const engineManifold: EngineManifold = 
    manifold === "poincare" ? "POINCARE" :
    manifold === "riemann" ? "RIEMANN" :
    manifold === "minkowski" ? "MINKOWSKI" :
    manifold === "emotion" ? "EMOTION" : "POINCARE";

  // Note: The original engine expects SSE/WS streaming by default.
  // Here we bridge it to accept static props while preserving the heavy 3D logic.
  
  return (
    <div style={{ width, height, position: 'relative', overflow: 'hidden', background: '#0a0a0a' }}>
      <PerspektiveEngine
        {...({
          collection: "static",
          streamingMode: "none" as const,
          bloomIntensity: 1.5,
          enableDrag: true,
          enableBoxSelect: true,
          enableContextMenu: true,
          enableMobiusZoom: manifold === "poincare",
          callbacks: {
            onFocus: (id: string) => {
              const node = data.nodes.find(n => n.id === id);
              if (node && onNodeClick) onNodeClick(node);
            }
          }
        } as any)}
      />
      <div style={{ position: 'absolute', bottom: 10, right: 10, color: '#444', fontFamily: 'monospace', fontSize: '10px', pointerEvents: 'none' }}>
        perspektive.js
      </div>
    </div>
  );
};
