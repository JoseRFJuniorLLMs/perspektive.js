/**
 * Tree / Hierarchy Layout — Reingold-Tilford Algorithm
 *
 * Produces aesthetically pleasing tree drawings with these properties:
 * 1. Nodes at the same depth are aligned on the same level
 * 2. A parent is centered horizontally over its children
 * 3. Subtrees are shifted to avoid overlaps
 * 4. Isomorphic subtrees are drawn identically
 *
 * Supports orientations: TB (top-bottom), BT, LR, RL.
 * Automatically detects root nodes (no incoming edges) or falls back to
 * the node with the highest energy.
 */

import type { Layout, LayoutNode, LayoutEdge, LayoutOptions } from './types';

/** Orientation of the tree layout. */
export type TreeOrientation = 'TB' | 'BT' | 'LR' | 'RL';

/** Extended options specific to the tree layout. */
export interface TreeLayoutOptions extends LayoutOptions {
  /** Orientation of the tree. Default: 'TB' (top-to-bottom). */
  orientation?: TreeOrientation;
  /** Horizontal separation between siblings. Default: 0.1 */
  siblingSpacing?: number;
  /** Vertical separation between levels. Default: 0.2 */
  levelSpacing?: number;
  /** Whether to clamp results to the Poincare disk. Default: true */
  hyperbolicClamp?: boolean;
  /** Poincare disk radius. Default: 0.95 */
  diskRadius?: number;
  /** Specific root node ID. If not given, roots are auto-detected. */
  rootId?: string;
}

/** Internal tree node used during layout computation. */
interface TreeNode {
  id: string;
  index: number;
  children: TreeNode[];
  parent: TreeNode | null;
  depth: number;
  /** Preliminary x-coordinate assigned during first walk. */
  prelim: number;
  /** Modifier used to shift subtrees. */
  mod: number;
  /** Thread pointer for contour traversal. */
  thread: TreeNode | null;
  /** Ancestor reference for shifting. */
  ancestor: TreeNode;
  /** Change in shift for distributing spacing. */
  change: number;
  /** Accumulated shift. */
  shift: number;
  /** Position among siblings (0-indexed). */
  number: number;
  /** Final x coordinate after second walk. */
  finalX: number;
  /** Final y coordinate (= depth * levelSpacing). */
  finalY: number;
}

/**
 * Build a forest of TreeNode structures from the flat node/edge lists.
 * Returns an array of root TreeNodes.
 */
function buildForest(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  rootId?: string
): { roots: TreeNode[]; treeMap: Map<string, TreeNode> } {
  const treeMap = new Map<string, TreeNode>();
  const incomingCount = new Map<string, number>();

  // Create TreeNode for each LayoutNode
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const tn: TreeNode = {
      id: node.id,
      index: i,
      children: [],
      parent: null,
      depth: 0,
      prelim: 0,
      mod: 0,
      thread: null,
      ancestor: null!,
      change: 0,
      shift: 0,
      number: 0,
      finalX: 0,
      finalY: 0,
    };
    tn.ancestor = tn; // self-reference initially
    treeMap.set(node.id, tn);
    incomingCount.set(node.id, 0);
  }

  // Build parent-child relationships from edges (source -> target = parent -> child)
  const childSet = new Set<string>();
  for (const edge of edges) {
    const parent = treeMap.get(edge.source);
    const child = treeMap.get(edge.target);
    if (parent && child && parent !== child) {
      // Avoid adding a child multiple times
      if (!childSet.has(`${edge.source}:${edge.target}`)) {
        childSet.add(`${edge.source}:${edge.target}`);
        parent.children.push(child);
        child.parent = parent;
        incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1);
      }
    }
  }

  // Detect roots: nodes with no incoming edges
  let roots: TreeNode[] = [];

  if (rootId && treeMap.has(rootId)) {
    roots = [treeMap.get(rootId)!];
  } else {
    for (const [id, count] of incomingCount) {
      if (count === 0) {
        roots.push(treeMap.get(id)!);
      }
    }
  }

  // If no roots found (all nodes have incoming edges — cycles), pick the node with highest energy
  if (roots.length === 0) {
    let bestIdx = 0;
    let bestEnergy = -Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const e = nodes[i].energy ?? 0;
      if (e > bestEnergy) {
        bestEnergy = e;
        bestIdx = i;
      }
    }
    const fallback = treeMap.get(nodes[bestIdx].id);
    if (fallback) {
      roots = [fallback];
    }
  }

  // Handle disconnected nodes: any node not reachable from a root becomes its own root
  const visited = new Set<string>();
  function markReachable(node: TreeNode) {
    if (visited.has(node.id)) return;
    visited.add(node.id);
    for (const child of node.children) {
      markReachable(child);
    }
  }
  for (const root of roots) {
    markReachable(root);
  }
  for (const [id, tn] of treeMap) {
    if (!visited.has(id)) {
      roots.push(tn);
      visited.add(id);
    }
  }

  // Assign depth via BFS from each root
  for (const root of roots) {
    const queue: TreeNode[] = [root];
    root.depth = 0;
    const seen = new Set<string>([root.id]);
    while (queue.length > 0) {
      const current = queue.shift()!;
      // Filter out children that form cycles
      current.children = current.children.filter(c => !seen.has(c.id));
      for (let i = 0; i < current.children.length; i++) {
        const child = current.children[i];
        seen.add(child.id);
        child.depth = current.depth + 1;
        child.number = i;
        queue.push(child);
      }
    }
  }

  return { roots, treeMap };
}

// ---- Reingold-Tilford algorithm (Buchheim et al. variant) ----

/**
 * First walk: bottom-up traversal that assigns preliminary x-coordinates.
 */
function firstWalk(v: TreeNode, siblingSpacing: number): void {
  if (v.children.length === 0) {
    // Leaf node
    if (v.number > 0 && v.parent) {
      // Has a left sibling
      const leftSibling = v.parent.children[v.number - 1];
      v.prelim = leftSibling.prelim + siblingSpacing;
    } else {
      v.prelim = 0;
    }
  } else {
    // Internal node
    let defaultAncestor = v.children[0];

    for (const child of v.children) {
      firstWalk(child, siblingSpacing);
      defaultAncestor = apportion(child, defaultAncestor, siblingSpacing);
    }

    executeShifts(v);

    // Position parent at the midpoint of its first and last child
    const firstChild = v.children[0];
    const lastChild = v.children[v.children.length - 1];
    const midpoint = (firstChild.prelim + lastChild.prelim) / 2;

    if (v.number > 0 && v.parent) {
      const leftSibling = v.parent.children[v.number - 1];
      v.prelim = leftSibling.prelim + siblingSpacing;
      v.mod = v.prelim - midpoint;
    } else {
      v.prelim = midpoint;
    }
  }
}

/**
 * Apportion: resolve overlapping subtrees by computing shifts.
 */
function apportion(v: TreeNode, defaultAncestor: TreeNode, siblingSpacing: number): TreeNode {
  if (v.number > 0 && v.parent) {
    const w = v.parent.children[v.number - 1]; // left sibling

    let vInnerRight: TreeNode | null = v;
    let vOuterRight: TreeNode | null = v;
    let vInnerLeft: TreeNode | null = w;
    let vOuterLeft: TreeNode | null = v.parent.children[0];

    let sInnerRight = v.mod;
    let sOuterRight = v.mod;
    let sInnerLeft = w.mod;
    let sOuterLeft = vOuterLeft.mod;

    while (nextRight(vInnerLeft) !== null && nextLeft(vInnerRight) !== null) {
      vInnerLeft = nextRight(vInnerLeft)!;
      vInnerRight = nextLeft(vInnerRight)!;
      vOuterLeft = nextLeft(vOuterLeft)!;
      vOuterRight = nextRight(vOuterRight)!;

      vOuterRight.ancestor = v;

      const shift = (vInnerLeft.prelim + sInnerLeft) - (vInnerRight.prelim + sInnerRight) + siblingSpacing;

      if (shift > 0) {
        const ancestor = findAncestor(vInnerLeft, v, defaultAncestor);
        moveSubtree(ancestor, v, shift);
        sInnerRight += shift;
        sOuterRight += shift;
      }

      sInnerLeft += vInnerLeft.mod;
      sInnerRight += vInnerRight.mod;
      sOuterLeft += vOuterLeft!.mod;
      sOuterRight += vOuterRight.mod;
    }

    if (nextRight(vInnerLeft) !== null && nextRight(vOuterRight) === null) {
      vOuterRight.thread = nextRight(vInnerLeft);
      vOuterRight.mod += sInnerLeft - sOuterRight;
    }

    if (nextLeft(vInnerRight) !== null && nextLeft(vOuterLeft) === null) {
      vOuterLeft!.thread = nextLeft(vInnerRight);
      vOuterLeft!.mod += sInnerRight - sOuterLeft;
      defaultAncestor = v;
    }
  }

  return defaultAncestor;
}

/** Get the next node on the left contour. */
function nextLeft(v: TreeNode | null): TreeNode | null {
  if (!v) return null;
  return v.children.length > 0 ? v.children[0] : v.thread;
}

/** Get the next node on the right contour. */
function nextRight(v: TreeNode | null): TreeNode | null {
  if (!v) return null;
  return v.children.length > 0 ? v.children[v.children.length - 1] : v.thread;
}

/** Find the correct ancestor for shifting. */
function findAncestor(w: TreeNode, v: TreeNode, defaultAncestor: TreeNode): TreeNode {
  if (v.parent && v.parent.children.includes(w.ancestor)) {
    return w.ancestor;
  }
  return defaultAncestor;
}

/** Move a subtree to the right by `shift` amount. */
function moveSubtree(wl: TreeNode, wr: TreeNode, shift: number): void {
  const subtrees = wr.number - wl.number;
  if (subtrees > 0) {
    wr.change -= shift / subtrees;
    wr.shift += shift;
    wl.change += shift / subtrees;
  }
  wr.prelim += shift;
  wr.mod += shift;
}

/** Execute accumulated shifts on children of a node. */
function executeShifts(v: TreeNode): void {
  let shift = 0;
  let change = 0;
  for (let i = v.children.length - 1; i >= 0; i--) {
    const w = v.children[i];
    w.prelim += shift;
    w.mod += shift;
    change += w.change;
    shift += w.shift + change;
  }
}

/**
 * Second walk: top-down traversal that computes final coordinates
 * by accumulating modifier sums.
 */
function secondWalk(v: TreeNode, modSum: number, levelSpacing: number): void {
  v.finalX = v.prelim + modSum;
  v.finalY = v.depth * levelSpacing;
  for (const child of v.children) {
    secondWalk(child, modSum + v.mod, levelSpacing);
  }
}

/**
 * Normalize coordinates so the entire tree fits within [-1, 1] on both axes,
 * preserving aspect ratio.
 */
function normalizeToRange(
  treeMap: Map<string, TreeNode>,
  nodes: LayoutNode[],
  orientation: TreeOrientation,
  hyperbolicClamp: boolean,
  diskRadius: number,
  boundingBox?: { x1: number; y1: number; x2: number; y2: number }
): void {
  // Find extent
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const tn of treeMap.values()) {
    if (tn.finalX < minX) minX = tn.finalX;
    if (tn.finalX > maxX) maxX = tn.finalX;
    if (tn.finalY < minY) minY = tn.finalY;
    if (tn.finalY > maxY) maxY = tn.finalY;
  }

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  // Target coordinate ranges
  const targetMin = boundingBox ? { x: boundingBox.x1, y: boundingBox.y1 } : { x: -0.9, y: -0.9 };
  const targetMax = boundingBox ? { x: boundingBox.x2, y: boundingBox.y2 } : { x: 0.9, y: 0.9 };
  const targetRangeX = targetMax.x - targetMin.x;
  const targetRangeY = targetMax.y - targetMin.y;

  for (const node of nodes) {
    if (node.fixed) continue;

    const tn = treeMap.get(node.id);
    if (!tn) continue;

    // Normalize to [0, 1] then scale to target range
    let nx = rangeX > 0 ? (tn.finalX - minX) / rangeX : 0.5;
    let ny = rangeY > 0 ? (tn.finalY - minY) / rangeY : 0.5;

    // Map to target coordinate space
    let px = targetMin.x + nx * targetRangeX;
    let py = targetMin.y + ny * targetRangeY;

    // Apply orientation transforms
    switch (orientation) {
      case 'TB':
        // X stays as horizontal, Y is top-to-bottom (already the default)
        node.x = px;
        node.y = -py; // Invert Y so root is at top in screen coords
        break;
      case 'BT':
        node.x = px;
        node.y = py;
        break;
      case 'LR':
        node.x = py;
        node.y = px;
        break;
      case 'RL':
        node.x = -py;
        node.y = px;
        break;
    }

    // Clamp to Poincare disk
    if (hyperbolicClamp) {
      const norm = Math.sqrt(node.x! * node.x! + node.y! * node.y!);
      if (norm > diskRadius) {
        const scale = diskRadius / norm;
        node.x! *= scale;
        node.y! *= scale;
      }
    }
  }
}

/**
 * Run the Reingold-Tilford tree layout algorithm.
 *
 * @param nodes - Array of nodes to position (mutated in place).
 * @param edges - Array of edges defining the tree structure (source -> target = parent -> child).
 * @param options - Configuration for the tree layout.
 * @returns The input node array with updated x/y coordinates.
 */
function run(nodes: LayoutNode[], edges: LayoutEdge[], options?: TreeLayoutOptions): LayoutNode[] {
  if (nodes.length === 0) return nodes;

  const orientation = options?.orientation ?? 'TB';
  const siblingSpacing = options?.siblingSpacing ?? 0.1;
  const levelSpacing = options?.levelSpacing ?? 0.2;
  const hyperbolicClamp = options?.hyperbolicClamp ?? true;
  const diskRadius = options?.diskRadius ?? 0.95;
  const rootId = options?.rootId;
  const boundingBox = options?.boundingBox;
  const onComplete = options?.onComplete;

  // Build tree structure
  const { roots, treeMap } = buildForest(nodes, edges, rootId);

  // Run Reingold-Tilford on each root
  // For forests (multiple roots), we lay out each tree and offset them horizontally
  let globalOffset = 0;

  for (const root of roots) {
    // Reset tree nodes for this root's subtree
    resetTreeNodes(root);

    // First walk: compute preliminary x-coordinates
    firstWalk(root, siblingSpacing);

    // Second walk: compute final coordinates
    secondWalk(root, -root.prelim, levelSpacing);

    // Find the width of this tree to compute offset for the next one
    let localMin = Infinity;
    let localMax = -Infinity;
    traverseTree(root, (tn) => {
      tn.finalX += globalOffset;
      if (tn.finalX < localMin) localMin = tn.finalX;
      if (tn.finalX > localMax) localMax = tn.finalX;
    });

    globalOffset = localMax + siblingSpacing * 2;
  }

  // Normalize all coordinates to fit within the target range
  normalizeToRange(treeMap, nodes, orientation, hyperbolicClamp, diskRadius, boundingBox);

  if (onComplete) {
    onComplete(nodes);
  }

  return nodes;
}

/** Reset tree node computation fields before a new walk. */
function resetTreeNodes(root: TreeNode): void {
  traverseTree(root, (tn) => {
    tn.prelim = 0;
    tn.mod = 0;
    tn.thread = null;
    tn.ancestor = tn;
    tn.change = 0;
    tn.shift = 0;
  });
}

/** Depth-first traversal of a tree. */
function traverseTree(node: TreeNode, callback: (tn: TreeNode) => void): void {
  callback(node);
  for (const child of node.children) {
    traverseTree(child, callback);
  }
}

/**
 * Reingold-Tilford tree layout.
 *
 * Produces aesthetically pleasing hierarchical tree drawings where:
 * - Parents are centered over their children
 * - Subtrees do not overlap
 * - Isomorphic subtrees get identical drawings
 *
 * Supports multiple orientations (TB, BT, LR, RL) and auto-detects root nodes.
 *
 * @example
 * ```ts
 * import { treeLayout } from '@nietzsche/perspektive/layouts';
 *
 * const positioned = treeLayout.run(nodes, edges, {
 *   orientation: 'LR',
 *   levelSpacing: 0.3,
 * });
 * ```
 */
export const treeLayout: Layout = {
  name: 'tree',
  run,
};
