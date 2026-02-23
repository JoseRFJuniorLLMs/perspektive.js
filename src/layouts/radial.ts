/**
 * Radial Layout
 *
 * Places nodes in concentric rings emanating from a central root:
 * - Root node at the center (0, 0)
 * - Each BFS level occupies a ring at increasing radius
 * - Angular spacing is proportional to subtree size
 * - Optional hyperbolic radius mapping: deeper levels map closer to the disk boundary
 *   using a tanh scaling that compresses depth into the Poincare ball
 */

import type { Layout, LayoutNode, LayoutEdge, LayoutOptions } from './types';

/** Extended options specific to the radial layout. */
export interface RadialLayoutOptions extends LayoutOptions {
  /** Specific root node ID. If not given, the root is auto-detected. */
  rootId?: string;
  /** Whether to use hyperbolic radius mapping (deeper = closer to boundary). Default: false */
  hyperbolicMapping?: boolean;
  /** Poincare disk radius limit. Default: 0.95 */
  diskRadius?: number;
  /** Base radius of the innermost ring. Default: 0.15 */
  innerRadius?: number;
  /** Angular offset in radians for the first child. Default: 0 */
  startAngle?: number;
  /** Total angular sweep in radians. Default: 2 * PI */
  sweep?: number;
}

/** Internal node for BFS traversal and subtree size computation. */
interface RadialNode {
  id: string;
  index: number;
  children: RadialNode[];
  depth: number;
  subtreeSize: number;
  angle: number;
  radius: number;
}

/**
 * Detect the root node from the graph.
 * Priority: explicit rootId > node with zero incoming edges > node with highest energy.
 */
function detectRoot(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  rootId?: string
): string {
  if (rootId) return rootId;

  // Count incoming edges
  const incoming = new Map<string, number>();
  for (const node of nodes) {
    incoming.set(node.id, 0);
  }
  for (const edge of edges) {
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
  }

  // Find nodes with zero incoming
  const zeroIncoming: string[] = [];
  for (const [id, count] of incoming) {
    if (count === 0) zeroIncoming.push(id);
  }

  if (zeroIncoming.length === 1) {
    return zeroIncoming[0];
  }

  // If multiple or none, pick the one with highest energy (or first node)
  if (zeroIncoming.length > 1) {
    let bestId = zeroIncoming[0];
    let bestEnergy = -Infinity;
    for (const id of zeroIncoming) {
      const node = nodes.find(n => n.id === id);
      const e = node?.energy ?? 0;
      if (e > bestEnergy) {
        bestEnergy = e;
        bestId = id;
      }
    }
    return bestId;
  }

  // All nodes have incoming edges (cycle) — pick highest energy
  let bestIdx = 0;
  let bestEnergy = -Infinity;
  for (let i = 0; i < nodes.length; i++) {
    const e = nodes[i].energy ?? 0;
    if (e > bestEnergy) {
      bestEnergy = e;
      bestIdx = i;
    }
  }
  return nodes[bestIdx].id;
}

/**
 * Build a BFS tree from the given root and compute subtree sizes.
 */
function buildRadialTree(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  rootId: string
): { root: RadialNode; nodeMap: Map<string, RadialNode>; maxDepth: number } {
  // Build adjacency (directed: source -> target as parent -> child)
  const childrenOf = new Map<string, string[]>();
  for (const edge of edges) {
    if (!childrenOf.has(edge.source)) childrenOf.set(edge.source, []);
    childrenOf.get(edge.source)!.push(edge.target);
  }

  const indexMap = new Map<string, number>();
  for (let i = 0; i < nodes.length; i++) {
    indexMap.set(nodes[i].id, i);
  }

  const nodeMap = new Map<string, RadialNode>();
  const visited = new Set<string>();
  let maxDepth = 0;

  // BFS from root
  const rootNode: RadialNode = {
    id: rootId,
    index: indexMap.get(rootId) ?? 0,
    children: [],
    depth: 0,
    subtreeSize: 1,
    angle: 0,
    radius: 0,
  };
  nodeMap.set(rootId, rootNode);
  visited.add(rootId);

  const queue: RadialNode[] = [rootNode];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const kids = childrenOf.get(current.id) ?? [];

    for (const kidId of kids) {
      if (visited.has(kidId)) continue;
      visited.add(kidId);

      const kidNode: RadialNode = {
        id: kidId,
        index: indexMap.get(kidId) ?? 0,
        children: [],
        depth: current.depth + 1,
        subtreeSize: 1,
        angle: 0,
        radius: 0,
      };

      current.children.push(kidNode);
      nodeMap.set(kidId, kidNode);
      queue.push(kidNode);

      if (kidNode.depth > maxDepth) maxDepth = kidNode.depth;
    }
  }

  // Handle disconnected nodes: attach them at depth = maxDepth + 1
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      visited.add(node.id);
      const orphan: RadialNode = {
        id: node.id,
        index: indexMap.get(node.id) ?? 0,
        children: [],
        depth: maxDepth + 1,
        subtreeSize: 1,
        angle: 0,
        radius: 0,
      };
      rootNode.children.push(orphan);
      nodeMap.set(node.id, orphan);
      if (orphan.depth > maxDepth) maxDepth = orphan.depth;
    }
  }

  // Compute subtree sizes bottom-up
  computeSubtreeSize(rootNode);

  return { root: rootNode, nodeMap, maxDepth };
}

/** Recursively compute the size of each subtree (including the node itself). */
function computeSubtreeSize(node: RadialNode): number {
  let size = 1;
  for (const child of node.children) {
    size += computeSubtreeSize(child);
  }
  node.subtreeSize = size;
  return size;
}

/**
 * Assign angular positions based on subtree size and radial positions based on depth.
 */
function assignPositions(
  node: RadialNode,
  startAngle: number,
  sweep: number,
  maxDepth: number,
  innerRadius: number,
  diskRadius: number,
  hyperbolicMapping: boolean
): void {
  // Assign radius based on depth
  if (node.depth === 0) {
    node.radius = 0;
  } else if (hyperbolicMapping) {
    // Hyperbolic mapping: tanh squishes deeper levels toward the boundary
    // tanh(depth / maxDepth * 2) gives a nice distribution
    const normalizedDepth = node.depth / Math.max(maxDepth, 1);
    node.radius = diskRadius * Math.tanh(normalizedDepth * 2.0);
  } else {
    // Linear mapping
    node.radius = innerRadius + (diskRadius - innerRadius) * (node.depth / Math.max(maxDepth, 1));
  }

  node.angle = startAngle + sweep / 2;

  // Distribute children proportionally to their subtree sizes
  if (node.children.length > 0) {
    const totalChildSubtreeSize = node.children.reduce((sum, c) => sum + c.subtreeSize, 0);
    let currentAngle = startAngle;

    for (const child of node.children) {
      const childSweep = (child.subtreeSize / totalChildSubtreeSize) * sweep;
      assignPositions(child, currentAngle, childSweep, maxDepth, innerRadius, diskRadius, hyperbolicMapping);
      currentAngle += childSweep;
    }
  }
}

/**
 * Run the radial layout algorithm.
 *
 * @param nodes - Array of nodes to position (mutated in place).
 * @param edges - Array of edges defining the hierarchy.
 * @param options - Configuration for the radial layout.
 * @returns The input node array with updated x/y coordinates.
 */
function run(nodes: LayoutNode[], edges: LayoutEdge[], options?: RadialLayoutOptions): LayoutNode[] {
  if (nodes.length === 0) return nodes;

  const rootId = detectRoot(nodes, edges, options?.rootId);
  const hyperbolicMapping = options?.hyperbolicMapping ?? false;
  const diskRadius = options?.diskRadius ?? 0.95;
  const innerRadius = options?.innerRadius ?? 0.15;
  const startAngle = options?.startAngle ?? 0;
  const sweep = options?.sweep ?? (2 * Math.PI);
  const boundingBox = options?.boundingBox;
  const onComplete = options?.onComplete;

  // Build BFS tree
  const { root, nodeMap, maxDepth } = buildRadialTree(nodes, edges, rootId);

  // Assign polar coordinates
  assignPositions(root, startAngle, sweep, maxDepth, innerRadius, diskRadius, hyperbolicMapping);

  // Convert polar to Cartesian and write back to nodes
  for (const node of nodes) {
    if (node.fixed) continue;

    const rn = nodeMap.get(node.id);
    if (!rn) continue;

    let x = rn.radius * Math.cos(rn.angle);
    let y = rn.radius * Math.sin(rn.angle);

    // Apply bounding box scaling if specified
    if (boundingBox) {
      const bw = (boundingBox.x2 - boundingBox.x1) / 2;
      const bh = (boundingBox.y2 - boundingBox.y1) / 2;
      const cx = (boundingBox.x1 + boundingBox.x2) / 2;
      const cy = (boundingBox.y1 + boundingBox.y2) / 2;
      x = cx + x * (bw / diskRadius);
      y = cy + y * (bh / diskRadius);
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
 * Radial layout algorithm.
 *
 * Places nodes in concentric rings from a central root. Angular spacing is proportional
 * to subtree size, producing a visually balanced radial tree. Supports hyperbolic radius
 * mapping where deeper levels are compressed toward the Poincare disk boundary.
 *
 * @example
 * ```ts
 * import { radialLayout } from '@nietzsche/perspektive/layouts';
 *
 * const positioned = radialLayout.run(nodes, edges, {
 *   hyperbolicMapping: true,
 *   diskRadius: 0.95,
 * });
 * ```
 */
export const radialLayout: Layout = {
  name: 'radial',
  run,
};
