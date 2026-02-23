/**
 * a11y/descriptions.ts — Auto-generate accessible text descriptions
 *
 * Produces human-readable strings for nodes, edges, the graph summary,
 * and manifold explanations. These descriptions are consumed by:
 * - AriaGraph (hidden DOM `aria-label` attributes)
 * - LiveRegion (focus / selection announcements)
 * - Tooltips (extended descriptions for sighted users in high-contrast mode)
 *
 * All output is designed to be concise but informative for screen readers:
 * avoid abbreviations, spell out percentages, describe spatial position
 * in plain language (e.g. "near center", "upper left edge").
 *
 * @module a11y/descriptions
 */

import type { NodeData, EdgeData } from '../components/PerspektiveEngine';
import type { ManifoldType } from '../components/PerspektiveEngine';

// ==========================================
// POSITION DESCRIPTION HELPERS
// ==========================================

/**
 * Convert a Poincare-disk (x, y) coordinate into a human-readable
 * spatial description. The disk has radius 1, so we bin positions
 * into concentric zones and compass sectors.
 *
 * @param x - X coordinate in [-1, 1]
 * @param y - Y coordinate in [-1, 1]
 * @returns A phrase like "near center", "upper left", "far right edge"
 */
function describePosition(x: number, y: number): string {
  const r = Math.sqrt(x * x + y * y);

  // Distance zones
  let zone: string;
  if (r < 0.2) {
    zone = 'center';
  } else if (r < 0.5) {
    zone = 'inner region';
  } else if (r < 0.8) {
    zone = 'outer region';
  } else {
    zone = 'edge';
  }

  // For very central nodes, skip direction
  if (r < 0.15) {
    return 'at center';
  }

  // Compass direction (8-way)
  const angle = Math.atan2(y, x) * (180 / Math.PI);
  let direction: string;
  if (angle >= -22.5 && angle < 22.5) direction = 'right';
  else if (angle >= 22.5 && angle < 67.5) direction = 'upper right';
  else if (angle >= 67.5 && angle < 112.5) direction = 'upper';
  else if (angle >= 112.5 && angle < 157.5) direction = 'upper left';
  else if (angle >= 157.5 || angle < -157.5) direction = 'left';
  else if (angle >= -157.5 && angle < -112.5) direction = 'lower left';
  else if (angle >= -112.5 && angle < -67.5) direction = 'lower';
  else direction = 'lower right';

  return `${direction} ${zone}`;
}

/**
 * Format an energy value as a percentage string.
 *
 * @param energy - Energy in [0, 1]
 * @returns e.g. "85%"
 */
function formatEnergy(energy: number): string {
  return `${Math.round(energy * 100)}%`;
}

/**
 * Truncate an ID string for readability. Full UUIDs are too long
 * for speech; we keep the first 8 characters.
 *
 * @param id - Full node ID
 * @returns Truncated ID, e.g. "abc12345"
 */
function truncateId(id: string): string {
  if (id.length <= 12) return id;
  return id.substring(0, 8);
}

// ==========================================
// NODE DESCRIPTIONS
// ==========================================

/**
 * Count the number of edges connected to a given node.
 *
 * @param nodeId - Node to count connections for
 * @param edges - Full edge list
 * @returns Number of edges where this node is source or target
 */
function countConnections(nodeId: string, edges: ReadonlyArray<EdgeData>): number {
  let count = 0;
  for (const edge of edges) {
    if (edge.source === nodeId || edge.target === nodeId) {
      count++;
    }
  }
  return count;
}

/**
 * Generate a human-readable description of a single node.
 *
 * Output format:
 *   "{type} node '{id}', energy {n}%, connected to {n} nodes, position {pos}"
 *
 * @param node - The node to describe
 * @param edges - Full edge list (used to count connections)
 * @returns A complete sentence suitable for `aria-label`
 *
 * @example
 * describeNode(node, edges)
 * // "Semantic node 'abc12345', energy 72%, connected to 5 nodes, position near center"
 */
export function describeNode(node: NodeData, edges: ReadonlyArray<EdgeData> = []): string {
  const type = node.node_type || 'Unknown';
  const id = truncateId(node.id);
  const energy = formatEnergy(node.energy);
  const connections = countConnections(node.id, edges);
  const position = describePosition(node.x, node.y);

  const parts = [
    `${type} node '${id}'`,
    `energy ${energy}`,
    `connected to ${connections} ${connections === 1 ? 'node' : 'nodes'}`,
    `position ${position}`,
  ];

  return parts.join(', ');
}

/**
 * Generate a short label for a node (used for the hidden DOM element text).
 * Shorter than the full description for quicker browsing.
 *
 * @param node - The node to label
 * @returns e.g. "Episodic node abc12345, energy 85%"
 */
export function nodeLabel(node: NodeData): string {
  const type = node.node_type || 'Unknown';
  const id = truncateId(node.id);
  const energy = formatEnergy(node.energy);
  return `${type} node ${id}, energy ${energy}`;
}

// ==========================================
// EDGE DESCRIPTIONS
// ==========================================

/**
 * Generate a human-readable description of a single edge.
 *
 * Output format:
 *   "Edge from {sourceType} node '{sourceId}' to {targetType} node '{targetId}', weight {w}"
 *
 * @param edge - The edge to describe
 * @param sourceNode - Source node data (for type info)
 * @param targetNode - Target node data (for type info)
 * @returns A complete sentence suitable for `aria-label`
 *
 * @example
 * describeEdge(edge, source, target)
 * // "Edge from Semantic node 'abc' to Episodic node 'def', weight 0.85"
 */
export function describeEdge(
  edge: EdgeData,
  sourceNode: NodeData | undefined,
  targetNode: NodeData | undefined,
): string {
  const sourceType = sourceNode?.node_type || 'Unknown';
  const sourceId = truncateId(edge.source);
  const targetType = targetNode?.node_type || 'Unknown';
  const targetId = truncateId(edge.target);
  const weight = edge.weight !== undefined ? edge.weight.toFixed(2) : 'unweighted';

  return `Edge from ${sourceType} node '${sourceId}' to ${targetType} node '${targetId}', weight ${weight}`;
}

// ==========================================
// GRAPH SUMMARY
// ==========================================

/**
 * Generate a high-level summary of the entire graph.
 *
 * Includes total node / edge counts, distinct node types, and the
 * highest-energy node. This is used as the `aria-label` for the
 * graph container element.
 *
 * @param nodes - All visible nodes
 * @param edges - All visible edges
 * @returns A multi-clause sentence summarizing the graph
 *
 * @example
 * describeGraph(nodes, edges)
 * // "Graph with 1,234 nodes and 5,678 edges across 4 types. Highest energy: Concept node at 97%."
 */
export function describeGraph(
  nodes: ReadonlyArray<NodeData>,
  edges: ReadonlyArray<EdgeData>,
): string {
  if (nodes.length === 0) {
    return 'Empty graph with no nodes.';
  }

  // Count distinct types
  const typeSet = new Set<string>();
  let highestNode: NodeData = nodes[0];

  for (const node of nodes) {
    typeSet.add(node.node_type || 'Unknown');
    if (node.energy > highestNode.energy) {
      highestNode = node;
    }
  }

  const nodeCount = nodes.length.toLocaleString();
  const edgeCount = edges.length.toLocaleString();
  const typeCount = typeSet.size;
  const typeWord = typeCount === 1 ? 'type' : 'types';

  const highType = highestNode.node_type || 'Unknown';
  const highEnergy = formatEnergy(highestNode.energy);

  return (
    `Graph with ${nodeCount} nodes and ${edgeCount} edges across ${typeCount} ${typeWord}. ` +
    `Highest energy: ${highType} node at ${highEnergy}.`
  );
}

// ==========================================
// MANIFOLD DESCRIPTIONS
// ==========================================

/**
 * Human-readable explanation of each manifold (lens) mode.
 *
 * Used for:
 * - Screen reader announcements when switching manifolds
 * - Tooltip / help text in the manifold switcher UI
 *
 * @param type - The manifold identifier
 * @returns A 1-2 sentence plain-language explanation
 *
 * @example
 * describeManifold('POINCARE')
 * // "Poincare disk view: nodes are arranged in a hyperbolic disk where central nodes..."
 */
export function describeManifold(type: ManifoldType): string {
  switch (type) {
    case 'POINCARE':
      return (
        'Poincare disk view: nodes are arranged in a hyperbolic disk where ' +
        'central nodes are more abstract and edge nodes are more specific. ' +
        'Distances grow exponentially toward the boundary.'
      );

    case 'RIEMANN':
      return (
        'Riemann sphere view: nodes are projected onto a 3D sphere using ' +
        'inverse stereographic projection. Opposing concepts appear at ' +
        'opposite poles, enabling dialectical synthesis visualization.'
      );

    case 'MINKOWSKI':
      return (
        'Minkowski spacetime view: a causal 3D layout where the vertical ' +
        'axis represents time (energy level) and horizontal axes represent ' +
        'spatial relationships. Light cones show causal influence zones.'
      );

    case 'EMOTION':
      return (
        'Russell circumplex view: nodes are plotted on a 2D emotional space ' +
        'where the horizontal axis represents valence (negative to positive) ' +
        'and the vertical axis represents arousal (calm to excited).'
      );

    default:
      return 'Unknown manifold view.';
  }
}

/**
 * Short manifold name for announcements (no full explanation).
 *
 * @param type - The manifold identifier
 * @returns e.g. "Poincare disk"
 */
export function manifoldShortName(type: ManifoldType): string {
  switch (type) {
    case 'POINCARE': return 'Poincare disk';
    case 'RIEMANN': return 'Riemann sphere';
    case 'MINKOWSKI': return 'Minkowski spacetime';
    case 'EMOTION': return 'Russell circumplex';
    default: return 'Unknown';
  }
}
