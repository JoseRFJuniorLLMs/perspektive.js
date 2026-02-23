/**
 * Layout Algorithm Types for perspektive.js
 *
 * Shared interfaces used by all layout engines.
 * All positions default to the range [-1, 1], compatible with the Poincare disk model.
 */

/** A node participating in a layout computation. */
export interface LayoutNode {
  /** Unique identifier for this node. */
  id: string;
  /** X coordinate in layout space. Defaults to range [-1, 1]. */
  x?: number;
  /** Y coordinate in layout space. Defaults to range [-1, 1]. */
  y?: number;
  /** Z coordinate in layout space (used by 3D projections). */
  z?: number;
  /** When true, the node's position is pinned and will not be moved by the layout. */
  fixed?: boolean;
  /** Node mass — affects repulsion strength in force-directed layouts. */
  mass?: number;
  /** Allow arbitrary extra properties (energy, node_type, etc.). */
  [key: string]: any;
}

/** A directed or undirected edge between two nodes. */
export interface LayoutEdge {
  /** ID of the source node. */
  source: string;
  /** ID of the target node. */
  target: string;
  /** Edge weight — affects attractive force strength. Defaults to 1. */
  weight?: number;
}

/** Configuration options shared by all layout algorithms. */
export interface LayoutOptions {
  /** Number of iterations for iterative algorithms. */
  iterations?: number;
  /** Whether to call onTick during computation (for animated rendering). */
  animate?: boolean;
  /** Bounding box constraint. Coordinates should be in layout space. */
  boundingBox?: { x1: number; y1: number; x2: number; y2: number };
  /** Called after each iteration with the current node positions. */
  onTick?: (nodes: LayoutNode[]) => void;
  /** Called when the layout computation is complete. */
  onComplete?: (nodes: LayoutNode[]) => void;
}

/** Common interface that all layout algorithms must implement. */
export interface Layout {
  /** Human-readable name of this layout algorithm. */
  name: string;
  /**
   * Execute the layout algorithm.
   *
   * @param nodes - Array of nodes to position. Nodes with `fixed: true` keep their coordinates.
   * @param edges - Array of edges defining connectivity.
   * @param options - Optional configuration for the algorithm.
   * @returns The same node array with updated x, y, z coordinates.
   */
  run(nodes: LayoutNode[], edges: LayoutEdge[], options?: LayoutOptions): LayoutNode[];
  /** Stop any ongoing iterative/animated computation. */
  stop?(): void;
}
