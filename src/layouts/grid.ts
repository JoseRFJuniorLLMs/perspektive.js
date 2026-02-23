/**
 * Grid Layout
 *
 * Places nodes in a regular grid pattern. Simple and deterministic — useful for
 * tabular inspection of graph contents or as a starting layout before applying
 * force-directed refinement.
 *
 * Features:
 * - Configurable rows and cols (auto-computed if omitted)
 * - Sorting by any node property before placement (default: energy descending)
 * - Optional Poincare disk clamping
 */

import type { Layout, LayoutNode, LayoutEdge, LayoutOptions } from './types';

/** Extended options specific to the grid layout. */
export interface GridLayoutOptions extends LayoutOptions {
  /** Number of columns. Auto-computed if omitted. */
  cols?: number;
  /** Number of rows. Auto-computed if omitted. */
  rows?: number;
  /** Property name to sort nodes by before placing. Default: 'energy'. */
  sortBy?: string;
  /** Sort direction. Default: 'desc' (highest value in top-left). */
  sortDirection?: 'asc' | 'desc';
  /** Whether to clamp results inside the Poincare disk. Default: true */
  hyperbolicClamp?: boolean;
  /** Poincare disk radius. Default: 0.95 */
  diskRadius?: number;
  /** Padding between the grid and the bounding area edges. Default: 0.05 */
  padding?: number;
}

/**
 * Compute optimal grid dimensions for n items.
 * Tries to produce a grid as close to square as possible.
 */
function computeGridDimensions(
  n: number,
  requestedCols?: number,
  requestedRows?: number
): { cols: number; rows: number } {
  if (requestedCols && requestedRows) {
    return { cols: requestedCols, rows: requestedRows };
  }

  if (requestedCols) {
    return { cols: requestedCols, rows: Math.ceil(n / requestedCols) };
  }

  if (requestedRows) {
    return { cols: Math.ceil(n / requestedRows), rows: requestedRows };
  }

  // Auto: find the most square-like dimensions
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  return { cols, rows };
}

/**
 * Sort nodes by a given property. Returns a new array (does not mutate input order).
 */
function sortNodes(
  nodes: LayoutNode[],
  sortBy: string,
  direction: 'asc' | 'desc'
): LayoutNode[] {
  const sorted = [...nodes];
  sorted.sort((a, b) => {
    const va = typeof a[sortBy] === 'number' ? a[sortBy] : 0;
    const vb = typeof b[sortBy] === 'number' ? b[sortBy] : 0;
    return direction === 'desc' ? vb - va : va - vb;
  });
  return sorted;
}

/**
 * Run the grid layout algorithm.
 *
 * @param nodes - Array of nodes to position (mutated in place).
 * @param edges - Array of edges (unused by grid layout, kept for interface compatibility).
 * @param options - Configuration for the grid layout.
 * @returns The input node array with updated x/y coordinates.
 */
function run(nodes: LayoutNode[], _edges: LayoutEdge[], options?: GridLayoutOptions): LayoutNode[] {
  if (nodes.length === 0) return nodes;

  const sortBy = options?.sortBy ?? 'energy';
  const sortDirection = options?.sortDirection ?? 'desc';
  const hyperbolicClamp = options?.hyperbolicClamp ?? true;
  const diskRadius = options?.diskRadius ?? 0.95;
  const padding = options?.padding ?? 0.05;
  const boundingBox = options?.boundingBox;
  const onComplete = options?.onComplete;

  const n = nodes.length;
  const { cols, rows } = computeGridDimensions(n, options?.cols, options?.rows);

  // Sort nodes to determine placement order
  const sorted = sortNodes(nodes, sortBy, sortDirection);

  // Build a mapping from node id -> grid position
  const positionMap = new Map<string, { row: number; col: number }>();
  for (let i = 0; i < sorted.length; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    positionMap.set(sorted[i].id, { row, col });
  }

  // Compute coordinate ranges
  let x1: number, y1: number, x2: number, y2: number;
  if (boundingBox) {
    x1 = boundingBox.x1 + padding;
    y1 = boundingBox.y1 + padding;
    x2 = boundingBox.x2 - padding;
    y2 = boundingBox.y2 - padding;
  } else {
    const limit = diskRadius - padding;
    x1 = -limit;
    y1 = -limit;
    x2 = limit;
    y2 = limit;
  }

  const cellWidth = cols > 1 ? (x2 - x1) / (cols - 1) : 0;
  const cellHeight = rows > 1 ? (y2 - y1) / (rows - 1) : 0;

  // Assign positions
  for (const node of nodes) {
    if (node.fixed) continue;

    const pos = positionMap.get(node.id);
    if (!pos) continue;

    let x = cols > 1 ? x1 + pos.col * cellWidth : (x1 + x2) / 2;
    let y = rows > 1 ? y1 + pos.row * cellHeight : (y1 + y2) / 2;

    // Invert y so that the first row is at the top
    y = y2 - (y - y1);

    // Clamp to Poincare disk
    if (hyperbolicClamp) {
      const norm = Math.sqrt(x * x + y * y);
      if (norm > diskRadius) {
        const scale = diskRadius / norm;
        x *= scale;
        y *= scale;
      }
    }

    node.x = x;
    node.y = y;
  }

  if (onComplete) {
    onComplete(nodes);
  }

  return nodes;
}

/**
 * Grid layout algorithm.
 *
 * Places nodes in a regular grid, optionally sorted by a property (e.g., energy).
 * Useful for tabular inspection of graph contents or as a deterministic starting layout.
 *
 * @example
 * ```ts
 * import { gridLayout } from '@nietzsche/perspektive/layouts';
 *
 * const positioned = gridLayout.run(nodes, edges, {
 *   cols: 10,
 *   sortBy: 'energy',
 *   sortDirection: 'desc',
 * });
 * ```
 */
export const gridLayout: Layout = {
  name: 'grid',
  run,
};
