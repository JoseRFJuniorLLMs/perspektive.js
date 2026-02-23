/**
 * types.ts -- Advanced Edge Type Definitions for perspektive.js
 *
 * Defines the complete type system for edge rendering: directionality,
 * curve styles, arrow configurations, label positioning, and render options.
 * All types are pure TypeScript with no runtime dependencies.
 */

/** Direction semantics for an edge. */
export type EdgeType = 'directed' | 'undirected' | 'bidirectional';

/** How the edge path is computed between source and target. */
export type CurveStyle = 'geodesic' | 'straight' | 'bezier' | 'arc';

/**
 * Extended edge data that carries metadata beyond simple source/target/weight.
 * Compatible with the base EdgeData from PerspektiveEngine but adds optional
 * fields for directionality, curve style, labels, and semantic relations.
 */
export interface AdvancedEdgeData {
  /** ID of the source node. */
  source: string;
  /** ID of the target node. */
  target: string;
  /** Edge weight in [0, 1]. Affects opacity and bundling priority. */
  weight: number;
  /** Optional display label for the edge (shown at midpoint). */
  label?: string;
  /** Direction semantics. Defaults to 'undirected'. */
  edgeType?: EdgeType;
  /** Path curve style. Overridden to 'geodesic' in POINCARE manifold. */
  curveStyle?: CurveStyle;
  /** Semantic relation type, e.g. "causes", "precedes", "contradicts". */
  relation?: string;
  /** Allow arbitrary extra properties for domain-specific use. */
  [key: string]: any;
}

/**
 * Configuration for an arrow head rendered on an edge.
 */
export interface ArrowConfig {
  /** Whether to show the arrow head. */
  show: boolean;
  /** Size of the arrow head triangle (world units). */
  size: number;
  /** Position along the edge path, 0 = at source, 1 = at target. */
  position: number;
  /** Arrow color override. Falls back to edge color if omitted. */
  color?: string;
  /** Whether the arrow triangle is filled (true) or wireframe (false). */
  filled?: boolean;
}

/**
 * Configuration for a text label rendered along an edge.
 */
export interface EdgeLabelConfig {
  /** Whether to show the label. */
  show: boolean;
  /** Text content of the label. */
  text: string;
  /** Font size in pixels. */
  fontSize: number;
  /** Text color (CSS color string). */
  color: string;
  /** Background color for the label badge. */
  background?: string;
  /** Position along the edge path, 0 = at source, 1 = at target. */
  position: number;
}

/**
 * Complete render options for a single edge.
 * Controls visual appearance including color, width, opacity, dashing,
 * arrow heads, labels, and HDR bloom settings.
 */
export interface EdgeRenderOptions {
  /** Base color of the edge line (CSS color string or hex). */
  color: string;
  /** Line width in pixels. */
  width: number;
  /** Opacity in [0, 1]. */
  opacity: number;
  /** Dash pattern as [dash length, gap length]. Omit for solid line. */
  dashArray?: [number, number];
  /** Arrow head configuration. */
  arrow?: ArrowConfig;
  /** Label configuration. */
  label?: EdgeLabelConfig;
  /** HDR color multiplier for bloom glow. Defaults to 1.5. */
  hdrMultiplier?: number;
  /** Blending mode. 'additive' for cyberpunk glow, 'normal' for opaque. */
  blending?: 'additive' | 'normal';
}

/**
 * A point in 3D space, compatible with Three.js coordinate arrays.
 */
export type Vec3 = [number, number, number];

/**
 * Result of arrow head calculation: three vertices of the arrow triangle.
 */
export interface ArrowHeadVertices {
  /** The tip of the arrow (pointing in the direction of travel). */
  tip: Vec3;
  /** Left wing of the arrow triangle. */
  left: Vec3;
  /** Right wing of the arrow triangle. */
  right: Vec3;
}

/**
 * Internal representation of a resolved edge ready for rendering.
 * Created by the EdgeRenderer after computing paths, bundling offsets, etc.
 */
export interface ResolvedEdge {
  /** Original edge data. */
  data: AdvancedEdgeData;
  /** Computed path points for the edge curve. */
  points: Vec3[];
  /** Merged render options (defaults + overrides). */
  options: EdgeRenderOptions;
  /** Whether this edge is a self-loop (source === target). */
  isSelfLoop: boolean;
  /** Index within parallel edge group (0 for single edges). */
  parallelIndex: number;
  /** Total number of parallel edges between the same node pair. */
  parallelCount: number;
}
