/**
 * analysis/tda.ts — Topological Data Analysis for Knowledge Graphs
 * 
 * Computes Betti numbers (β0, β1) to provide insights into graph connectivity
 * and the existence of "knowledge holes" or latent cycles.
 */

import type { NodePayload, EdgePayload } from '../streaming/types';

/**
 * Computes β0 (Betti number 0): The number of connected components.
 * In a knowledge graph, this represents the number of distinct semantic clusters.
 */
export function computeBetti0(nodes: NodePayload[], edges: EdgePayload[]): number {
  if (nodes.length === 0) return 0;

  const parent = new Map<string, string>();
  
  // Find with path compression
  function find(id: string): string {
    if (!parent.has(id)) {
      parent.set(id, id);
      return id;
    }
    if (parent.get(id) === id) return id;
    const root = find(parent.get(id)!);
    parent.set(id, root);
    return root;
  }

  // Union
  function union(id1: string, id2: string) {
    const root1 = find(id1);
    const root2 = find(id2);
    if (root1 !== root2) {
      parent.set(root1, root2);
    }
  }

  // Initialize nodes
  for (const node of nodes) {
    find(node.id);
  }

  // Union edges
  for (const edge of edges) {
    union(edge.source, edge.target);
  }

  // Count unique roots
  const roots = new Set<string>();
  for (const node of nodes) {
    roots.add(find(node.id));
  }

  return roots.size;
}

/**
 * Computes β1 (Betti number 1): The number of fundamental cycles or "holes".
 * In knowledge graphs, β1 = |E| - |V| + β0 (for undirected graphs).
 * Represents loops in reasoning or gaps in the latent space.
 */
export function computeBetti1(nodes: NodePayload[], edges: EdgePayload[], betti0: number): number {
  const v = nodes.length;
  const e = edges.length;
  if (v === 0) return 0;
  
  // Euler characteristic formula: χ = V - E = β0 - β1
  // Therefore: β1 = E - V + β0
  return Math.max(0, e - v + betti0);
}
