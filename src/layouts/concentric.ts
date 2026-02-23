/**
 * Concentric Layout
 *
 * Places nodes on concentric circles, grouped by a categorical property
 * (default: `node_type`) or sorted by a numeric property (default: `energy`).
 *
 * - Higher-energy nodes occupy the innermost circle
 * - Each circle hosts one group of nodes, evenly spaced angularly
 * - Supports both grouping (categorical) and ranking (numeric) modes
 */

import type { Layout, LayoutNode, LayoutEdge, LayoutOptions } from './types';

/** Extended options specific to the concentric layout. */
export interface ConcentricLayoutOptions extends LayoutOptions {
  /** Property name used to group nodes into rings. Default: 'node_type'. */
  groupBy?: string;
  /** Property name used to sort groups (inner ring = highest value). Default: 'energy'. */
  sortBy?: string;
  /** If true, each node gets its own rank (no grouping). Default: false. */
  rankMode?: boolean;
  /** Number of concentric rings in rank mode. Default: auto (sqrt of node count). */
  rings?: number;
  /** Minimum radius (innermost circle). Default: 0.1 */
  minRadius?: number;
  /** Maximum radius (outermost circle). Default: 0.9 */
  maxRadius?: number;
  /** Whether to clamp to the Poincare disk. Default: true */
  hyperbolicClamp?: boolean;
  /** Poincare disk radius. Default: 0.95 */
  diskRadius?: number;
  /** Angular offset in radians. Default: 0 */
  startAngle?: number;
  /** Whether to apply equal angular spacing within each ring. Default: true */
  equalSpacing?: boolean;
}

/** A group of nodes assigned to the same concentric ring. */
interface Ring {
  key: string;
  nodes: LayoutNode[];
  avgValue: number;
}

/**
 * Group nodes by a categorical property and sort groups by average energy.
 */
function groupNodes(
  nodes: LayoutNode[],
  groupBy: string,
  sortBy: string
): Ring[] {
  const groups = new Map<string, LayoutNode[]>();

  for (const node of nodes) {
    const key = String(node[groupBy] ?? 'unknown');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(node);
  }

  const rings: Ring[] = [];
  for (const [key, groupNodes] of groups) {
    const total = groupNodes.reduce((sum, n) => {
      const val = typeof n[sortBy] === 'number' ? n[sortBy] : 0;
      return sum + val;
    }, 0);
    const avg = groupNodes.length > 0 ? total / groupNodes.length : 0;

    // Sort nodes within each ring by energy descending for consistent angular placement
    groupNodes.sort((a, b) => {
      const va = typeof a[sortBy] === 'number' ? a[sortBy] : 0;
      const vb = typeof b[sortBy] === 'number' ? b[sortBy] : 0;
      return vb - va;
    });

    rings.push({ key, nodes: groupNodes, avgValue: avg });
  }

  // Sort rings: highest average value -> innermost ring
  rings.sort((a, b) => b.avgValue - a.avgValue);

  return rings;
}

/**
 * Distribute nodes into rings based on their rank by a numeric property.
 */
function rankNodes(
  nodes: LayoutNode[],
  sortBy: string,
  numRings: number
): Ring[] {
  // Sort all nodes by the sort property descending
  const sorted = [...nodes].sort((a, b) => {
    const va = typeof a[sortBy] === 'number' ? a[sortBy] : 0;
    const vb = typeof b[sortBy] === 'number' ? b[sortBy] : 0;
    return vb - va;
  });

  const rings: Ring[] = [];
  const nodesPerRing = Math.ceil(sorted.length / numRings);

  for (let r = 0; r < numRings; r++) {
    const start = r * nodesPerRing;
    const end = Math.min(start + nodesPerRing, sorted.length);
    const slice = sorted.slice(start, end);
    if (slice.length === 0) continue;

    const total = slice.reduce((sum, n) => {
      const val = typeof n[sortBy] === 'number' ? n[sortBy] : 0;
      return sum + val;
    }, 0);

    rings.push({
      key: `ring-${r}`,
      nodes: slice,
      avgValue: slice.length > 0 ? total / slice.length : 0,
    });
  }

  return rings;
}

/**
 * Run the concentric layout algorithm.
 *
 * @param nodes - Array of nodes to position (mutated in place).
 * @param edges - Array of edges (unused by concentric layout, kept for interface compatibility).
 * @param options - Configuration for the concentric layout.
 * @returns The input node array with updated x/y coordinates.
 */
function run(nodes: LayoutNode[], _edges: LayoutEdge[], options?: ConcentricLayoutOptions): LayoutNode[] {
  if (nodes.length === 0) return nodes;

  const groupBy = options?.groupBy ?? 'node_type';
  const sortBy = options?.sortBy ?? 'energy';
  const rankMode = options?.rankMode ?? false;
  const minRadius = options?.minRadius ?? 0.1;
  const maxRadius = options?.maxRadius ?? 0.9;
  const hyperbolicClamp = options?.hyperbolicClamp ?? true;
  const diskRadius = options?.diskRadius ?? 0.95;
  const startAngle = options?.startAngle ?? 0;
  const boundingBox = options?.boundingBox;
  const onComplete = options?.onComplete;

  // Build rings
  let rings: Ring[];
  if (rankMode) {
    const numRings = options?.rings ?? Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
    rings = rankNodes(nodes, sortBy, numRings);
  } else {
    rings = groupNodes(nodes, groupBy, sortBy);
  }

  // Handle single-node case: place at center
  if (nodes.length === 1 && !nodes[0].fixed) {
    nodes[0].x = 0;
    nodes[0].y = 0;
    if (onComplete) onComplete(nodes);
    return nodes;
  }

  const numRings = rings.length;

  // Build position map: node id -> (x, y)
  const posMap = new Map<string, { x: number; y: number }>();

  for (let r = 0; r < numRings; r++) {
    const ring = rings[r];

    // Compute radius for this ring
    let radius: number;
    if (numRings === 1) {
      radius = (minRadius + maxRadius) / 2;
    } else {
      radius = minRadius + (maxRadius - minRadius) * (r / (numRings - 1));
    }

    // Special case: if this is the innermost ring and has exactly 1 node, place at center
    if (r === 0 && ring.nodes.length === 1) {
      posMap.set(ring.nodes[0].id, { x: 0, y: 0 });
      continue;
    }

    // Distribute nodes around the ring
    const count = ring.nodes.length;
    const angularStep = (2 * Math.PI) / count;

    for (let i = 0; i < count; i++) {
      const angle = startAngle + i * angularStep;
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);
      posMap.set(ring.nodes[i].id, { x, y });
    }
  }

  // Write positions back to nodes
  for (const node of nodes) {
    if (node.fixed) continue;

    const pos = posMap.get(node.id);
    if (!pos) continue;

    let { x, y } = pos;

    // Apply bounding box scaling
    if (boundingBox) {
      const bw = (boundingBox.x2 - boundingBox.x1) / 2;
      const bh = (boundingBox.y2 - boundingBox.y1) / 2;
      const cx = (boundingBox.x1 + boundingBox.x2) / 2;
      const cy = (boundingBox.y1 + boundingBox.y2) / 2;
      x = cx + x * (bw / maxRadius);
      y = cy + y * (bh / maxRadius);
    }

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
 * Concentric layout algorithm.
 *
 * Arranges nodes on concentric circles, grouped by a categorical property
 * (e.g., `node_type`) or ranked by a numeric property (e.g., `energy`).
 * Higher-value nodes are placed on inner rings for visual emphasis.
 *
 * @example
 * ```ts
 * import { concentricLayout } from '@nietzsche/perspektive/layouts';
 *
 * // Group by node_type, sort by energy
 * const positioned = concentricLayout.run(nodes, edges, {
 *   groupBy: 'node_type',
 *   sortBy: 'energy',
 * });
 *
 * // Rank mode: distribute all nodes by energy into 5 rings
 * const ranked = concentricLayout.run(nodes, edges, {
 *   rankMode: true,
 *   rings: 5,
 * });
 * ```
 */
export const concentricLayout: Layout = {
  name: 'concentric',
  run,
};
