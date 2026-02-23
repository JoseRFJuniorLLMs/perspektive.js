/**
 * perspektive.js - Centrality Measures
 *
 * A comprehensive set of graph centrality algorithms:
 * - Degree centrality
 * - PageRank (power iteration)
 * - Betweenness centrality (Brandes' algorithm)
 * - Closeness centrality (BFS/Dijkstra-based)
 * - Eigenvector centrality (power iteration)
 *
 * All algorithms return `Map<string, number>` for uniform consumption.
 *
 * @module algorithms/centrality
 */

import { Graph } from './types';
import { MinHeap } from './pathfinding';

// ===========================================================================
// Degree centrality
// ===========================================================================

/**
 * Compute degree centrality for every node.
 *
 * Degree centrality is the fraction of other nodes a node is connected to:
 *   C_D(v) = deg(v) / (n - 1)
 *
 * For directed graphs this uses out-degree.
 *
 * @param graph - The graph to analyze.
 * @returns Map from node id to its degree centrality in [0, 1].
 *
 * @complexity O(V)
 */
export function degreeCentrality(graph: Graph): Map<string, number> {
  const result = new Map<string, number>();
  const n = graph.nodeCount;

  if (n <= 1) {
    for (const node of graph.nodes) {
      result.set(node.id, 0);
    }
    return result;
  }

  const denominator = n - 1;

  for (const node of graph.nodes) {
    result.set(node.id, graph.degree(node.id) / denominator);
  }

  return result;
}

// ===========================================================================
// PageRank
// ===========================================================================

/** Options for the PageRank algorithm. */
export interface PageRankOptions {
  /** Damping factor (probability of following a link). Default: 0.85. */
  dampingFactor?: number;
  /** Maximum number of power iterations. Default: 100. */
  maxIterations?: number;
  /** Convergence tolerance (L1 norm of score changes). Default: 1e-6. */
  tolerance?: number;
}

/**
 * Compute PageRank scores for every node.
 *
 * Uses the power iteration method. Handles dangling nodes (nodes with
 * out-degree 0) by redistributing their rank uniformly across all nodes.
 *
 * Scores sum to 1.0 (probability distribution).
 *
 * @param graph   - The graph (directed or undirected).
 * @param options - Algorithm parameters (damping, iterations, tolerance).
 * @returns Map from node id to its PageRank score.
 *
 * @complexity O(I * (V + E)) where I is the number of iterations until convergence.
 */
export function pageRank(
  graph: Graph,
  options?: PageRankOptions,
): Map<string, number> {
  const d = options?.dampingFactor ?? 0.85;
  const maxIter = options?.maxIterations ?? 100;
  const tol = options?.tolerance ?? 1e-6;

  const n = graph.nodeCount;
  const result = new Map<string, number>();

  if (n === 0) return result;

  const ids = graph.getNodeIds();

  // Initialize uniform scores
  let scores = new Map<string, number>();
  const initial = 1 / n;
  for (const id of ids) {
    scores.set(id, initial);
  }

  // Pre-compute out-degrees for efficient iteration
  const outDeg = new Map<string, number>();
  for (const id of ids) {
    outDeg.set(id, graph.outDegree(id));
  }

  for (let iter = 0; iter < maxIter; iter++) {
    const newScores = new Map<string, number>();

    // Compute dangling node contribution
    // Dangling nodes are those with out-degree 0; their rank is distributed uniformly
    let danglingSum = 0;
    for (const id of ids) {
      if (outDeg.get(id) === 0) {
        danglingSum += scores.get(id)!;
      }
    }

    const base = (1 - d) / n + d * danglingSum / n;

    // Initialize all new scores with the base value
    for (const id of ids) {
      newScores.set(id, base);
    }

    // Distribute rank from each node to its neighbors
    for (const id of ids) {
      const deg = outDeg.get(id)!;
      if (deg === 0) continue;

      const share = d * scores.get(id)! / deg;
      for (const neighbor of graph.neighbors(id)) {
        newScores.set(neighbor, newScores.get(neighbor)! + share);
      }
    }

    // Check convergence (L1 norm)
    let diff = 0;
    for (const id of ids) {
      diff += Math.abs(newScores.get(id)! - scores.get(id)!);
    }

    scores = newScores;

    if (diff < tol) break;
  }

  // Copy to result
  for (const id of ids) {
    result.set(id, scores.get(id)!);
  }

  return result;
}

// ===========================================================================
// Betweenness centrality (Brandes' algorithm)
// ===========================================================================

/**
 * Compute betweenness centrality for every node using Brandes' algorithm.
 *
 * Betweenness centrality measures how often a node lies on shortest paths
 * between pairs of other nodes:
 *   C_B(v) = sum_{s != v != t} sigma_st(v) / sigma_st
 *
 * For undirected graphs the result is normalized by dividing by
 * (n-1)(n-2)/2. For directed graphs, by (n-1)(n-2).
 *
 * Uses weighted shortest paths (Dijkstra within Brandes' framework).
 *
 * @param graph - The graph to analyze.
 * @returns Map from node id to its betweenness centrality (normalized).
 *
 * @complexity O(V * E * log V) for weighted graphs.
 */
export function betweennessCentrality(graph: Graph): Map<string, number> {
  const result = new Map<string, number>();
  const ids = graph.getNodeIds();
  const n = ids.length;

  // Initialize all betweenness values to 0
  for (const id of ids) {
    result.set(id, 0);
  }

  if (n <= 2) return result;

  for (const s of ids) {
    // --- Single-source shortest paths (Dijkstra-based Brandes) ---
    const stack: string[] = [];
    const predecessors = new Map<string, string[]>();
    const sigma = new Map<string, number>(); // number of shortest paths
    const dist = new Map<string, number>();
    const delta = new Map<string, number>();

    for (const id of ids) {
      predecessors.set(id, []);
      sigma.set(id, 0);
      dist.set(id, Infinity);
      delta.set(id, 0);
    }

    sigma.set(s, 1);
    dist.set(s, 0);

    const pq = new MinHeap<string>();
    pq.insert(s, 0);

    while (!pq.isEmpty) {
      const entry = pq.extractMin()!;
      const v = entry.element;
      const vDist = entry.priority;

      // Skip stale entries
      if (vDist > dist.get(v)!) continue;

      stack.push(v);

      for (const { neighbor: w, weight } of graph.neighborEntries(v)) {
        const newDist = vDist + weight;
        const wDist = dist.get(w)!;

        // Found a shorter path to w
        if (newDist < wDist) {
          dist.set(w, newDist);
          sigma.set(w, 0);
          predecessors.set(w, []);
          pq.insert(w, newDist);
        }

        // Found an equally short path to w
        if (newDist === dist.get(w)!) {
          sigma.set(w, sigma.get(w)! + sigma.get(v)!);
          predecessors.get(w)!.push(v);
        }
      }
    }

    // --- Accumulation phase ---
    // Process nodes in reverse order of settlement (farthest first)
    while (stack.length > 0) {
      const w = stack.pop()!;
      for (const v of predecessors.get(w)!) {
        const contribution = (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!);
        delta.set(v, delta.get(v)! + contribution);
      }
      if (w !== s) {
        result.set(w, result.get(w)! + delta.get(w)!);
      }
    }
  }

  // Normalize
  const normFactor = graph.directed
    ? (n - 1) * (n - 2)
    : ((n - 1) * (n - 2)) / 2;

  if (normFactor > 0) {
    for (const id of ids) {
      result.set(id, result.get(id)! / normFactor);
    }
  }

  return result;
}

// ===========================================================================
// Closeness centrality
// ===========================================================================

/**
 * Compute closeness centrality for every node.
 *
 * Closeness centrality is the reciprocal of the average shortest-path distance
 * from a node to all other reachable nodes:
 *   C_C(v) = (r - 1) / sum_{u reachable from v} d(v, u)
 *
 * where r is the number of reachable nodes (including v itself).
 *
 * Nodes that cannot reach any other node get a closeness of 0.
 * Uses Dijkstra for weighted shortest paths.
 *
 * @param graph - The graph to analyze.
 * @returns Map from node id to its closeness centrality.
 *
 * @complexity O(V * (V + E) * log V) (Dijkstra from each node).
 */
export function closenessCentrality(graph: Graph): Map<string, number> {
  const result = new Map<string, number>();
  const ids = graph.getNodeIds();

  for (const source of ids) {
    // Run Dijkstra from this source
    const distances = singleSourceDijkstra(graph, source);

    let totalDist = 0;
    let reachable = 0;

    for (const [id, d] of distances) {
      if (id === source) continue;
      if (d < Infinity) {
        totalDist += d;
        reachable++;
      }
    }

    if (reachable > 0 && totalDist > 0) {
      result.set(source, reachable / totalDist);
    } else {
      result.set(source, 0);
    }
  }

  return result;
}

// ===========================================================================
// Eigenvector centrality
// ===========================================================================

/** Options for eigenvector centrality. */
export interface EigenvectorCentralityOptions {
  /** Maximum number of power iterations. Default: 100. */
  maxIterations?: number;
  /** Convergence tolerance. Default: 1e-6. */
  tolerance?: number;
}

/**
 * Compute eigenvector centrality using the power iteration method.
 *
 * Eigenvector centrality assigns high scores to nodes that are connected
 * to other high-scoring nodes. It corresponds to the leading eigenvector
 * of the adjacency matrix.
 *
 * For directed graphs, this computes the *right* eigenvector (based on
 * outgoing edges). The result is normalized so that the maximum value is 1.
 *
 * @param graph   - The graph to analyze.
 * @param options - Iteration parameters.
 * @returns Map from node id to its eigenvector centrality in [0, 1].
 *
 * @complexity O(I * (V + E)) where I is the number of iterations.
 */
export function eigenvectorCentrality(
  graph: Graph,
  options?: EigenvectorCentralityOptions,
): Map<string, number> {
  const maxIter = options?.maxIterations ?? 100;
  const tol = options?.tolerance ?? 1e-6;

  const result = new Map<string, number>();
  const ids = graph.getNodeIds();
  const n = ids.length;

  if (n === 0) return result;

  // Initialize with uniform values
  let scores = new Map<string, number>();
  const initial = 1 / Math.sqrt(n);
  for (const id of ids) {
    scores.set(id, initial);
  }

  for (let iter = 0; iter < maxIter; iter++) {
    const newScores = new Map<string, number>();

    // Initialize to 0
    for (const id of ids) {
      newScores.set(id, 0);
    }

    // For each node, accumulate the scores of its neighbors.
    // In matrix form: x_{k+1} = A * x_k
    // For undirected: x_i = sum_j A_{ij} * x_j  (j = neighbors of i)
    // For directed (right eigenvector): x_i = sum_{j -> i} x_j (in-neighbors)
    for (const id of ids) {
      const neighbors = graph.directed ? graph.predecessors(id) : graph.neighbors(id);
      let sum = 0;
      for (const neighbor of neighbors) {
        sum += scores.get(neighbor) ?? 0;
      }
      newScores.set(id, sum);
    }

    // Normalize by L2 norm
    let norm = 0;
    for (const id of ids) {
      const v = newScores.get(id)!;
      norm += v * v;
    }
    norm = Math.sqrt(norm);

    if (norm === 0) {
      // Degenerate case: all zeros, return uniform
      for (const id of ids) {
        result.set(id, 1 / n);
      }
      return result;
    }

    for (const id of ids) {
      newScores.set(id, newScores.get(id)! / norm);
    }

    // Check convergence
    let diff = 0;
    for (const id of ids) {
      diff += Math.abs(newScores.get(id)! - scores.get(id)!);
    }

    scores = newScores;

    if (diff < tol) break;
  }

  // Normalize so max = 1
  let maxVal = 0;
  for (const id of ids) {
    const v = scores.get(id)!;
    if (v > maxVal) maxVal = v;
  }

  if (maxVal > 0) {
    for (const id of ids) {
      result.set(id, scores.get(id)! / maxVal);
    }
  } else {
    for (const id of ids) {
      result.set(id, 0);
    }
  }

  return result;
}

// ===========================================================================
// Internal utility: lightweight single-source Dijkstra (distances only)
// ===========================================================================

/**
 * Compute single-source shortest-path distances using Dijkstra.
 * Returns only the distance map (no predecessors) for efficiency.
 *
 * @internal
 */
function singleSourceDijkstra(graph: Graph, source: string): Map<string, number> {
  const distances = new Map<string, number>();
  const visited = new Set<string>();

  for (const node of graph.nodes) {
    distances.set(node.id, Infinity);
  }

  distances.set(source, 0);
  const pq = new MinHeap<string>();
  pq.insert(source, 0);

  while (!pq.isEmpty) {
    const entry = pq.extractMin()!;
    const u = entry.element;
    const uDist = entry.priority;

    if (visited.has(u)) continue;
    visited.add(u);

    if (uDist > distances.get(u)!) continue;

    for (const { neighbor, weight } of graph.neighborEntries(u)) {
      if (visited.has(neighbor)) continue;

      const newDist = uDist + weight;
      if (newDist < distances.get(neighbor)!) {
        distances.set(neighbor, newDist);
        pq.insert(neighbor, newDist);
      }
    }
  }

  return distances;
}
