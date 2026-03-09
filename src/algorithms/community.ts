/**
 * perspektive.js - Community Detection Algorithms
 *
 * Implements two widely-used community detection methods:
 * - Louvain method (modularity optimization via greedy local moves + aggregation)
 * - Label Propagation (fast, near-linear community detection)
 *
 * Both return `Map<string, number>` mapping each node id to a community id.
 *
 * @module algorithms/community
 */

import { Graph } from './types';

// ===========================================================================
// Louvain method
// ===========================================================================

/**
 * Detect communities using the Louvain method for modularity optimization.
 *
 * The Louvain algorithm is a multi-phase greedy approach:
 *
 * 1. **Local moves**: Iterate over nodes. For each node, evaluate the
 *    modularity gain of moving it to each neighbor's community. Accept
 *    the move that yields the highest positive gain. Repeat until no
 *    improvements can be made.
 *
 * 2. **Aggregation**: Collapse each community into a single super-node,
 *    creating a coarsened graph. Self-loops represent intra-community edges,
 *    and multi-edges are summed.
 *
 * 3. Repeat phases 1-2 on the coarsened graph until modularity converges.
 *
 * For undirected graphs the standard modularity formula is used:
 *   Q = (1/2m) * sum_{ij} [A_{ij} - k_i*k_j/(2m)] * delta(c_i, c_j)
 *
 * @param graph - The graph to partition (should be undirected for meaningful results).
 * @returns Map from original node id to community id (integer starting from 0).
 *
 * @complexity O(V * E) per pass; typically converges in a small number of passes.
 */
export function louvainCommunity(graph: Graph): Map<string, number> {
  const n = graph.nodeCount;
  const result = new Map<string, number>();

  if (n === 0) return result;

  // Assign each node a unique integer index for internal tracking
  const ids = graph.getNodeIds();
  const idToIndex = new Map<string, number>();
  for (let i = 0; i < ids.length; i++) {
    idToIndex.set(ids[i], i);
  }

  // Build a dense internal representation
  // adjacency[i] = Array of { j, weight }
  type InternalEdge = { j: number; weight: number };
  let adjacency: InternalEdge[][] = new Array(n);
  for (let i = 0; i < n; i++) {
    adjacency[i] = [];
  }

  // Total edge weight * 2 (for undirected: each edge counted once in the original list)
  let totalWeight2 = 0;

  for (const edge of graph.edges) {
    const si = idToIndex.get(edge.source);
    const ti = idToIndex.get(edge.target);
    if (si === undefined || ti === undefined) continue;

    const w = edge.weight ?? 1;
    adjacency[si].push({ j: ti, weight: w });
    adjacency[ti].push({ j: si, weight: w });
    totalWeight2 += 2 * w;
  }

  const m2 = totalWeight2; // sum of all weights * 2

  if (m2 === 0) {
    // No edges: each node is its own community
    for (let i = 0; i < n; i++) {
      result.set(ids[i], i);
    }
    return result;
  }

  // community[i] = community id of node i
  let community = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    community[i] = i;
  }

  // Weighted degree of each node
  let k = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (const e of adjacency[i]) {
      sum += e.weight;
    }
    k[i] = sum;
  }

  // Sum of weighted degrees within each community (Sigma_tot)
  let sigmaTot = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    sigmaTot[i] = k[i];
  }

  // nodeToOriginal[i] = list of original node indices aggregated into super-node i
  let nodeToOriginal: number[][] = new Array(n);
  for (let i = 0; i < n; i++) {
    nodeToOriginal[i] = [i];
  }

  let currentN = n;
  let improved = true;

  while (improved) {
    improved = false;

    // --- Phase 1: Local moves ---
    let localImproved = true;
    let passes = 0;
    const maxPasses = 20; // safety limit

    while (localImproved && passes < maxPasses) {
      localImproved = false;
      passes++;

      for (let i = 0; i < currentN; i++) {
        const ci = community[i];

        // Compute sum of edge weights from i to nodes in each neighboring community
        const communityWeights = new Map<number, number>();
        let kiIn = 0; // weight from i to nodes in i's own community

        for (const e of adjacency[i]) {
          const cj = community[e.j];
          communityWeights.set(cj, (communityWeights.get(cj) ?? 0) + e.weight);
          if (cj === ci) {
            kiIn += e.weight;
          }
        }

        // Evaluate removing i from its current community
        // delta_Q_remove = [ki_in / m2] - [sigmaTot[ci] * ki / (m2^2)] * ki
        // Simplified: we only need relative comparisons

        let bestDeltaQ = 0;
        let bestCommunity = ci;

        // Cost of removing i from ci:
        // After removal, sigmaTot[ci] becomes sigmaTot[ci] - k[i]
        const kiVal = k[i];

        for (const [cTarget, wTarget] of communityWeights) {
          if (cTarget === ci) continue;

          // Modularity gain of moving i from ci to cTarget:
          // deltaQ = [wTarget/m - sigmaTot[cTarget] * ki / m2^2] -
          //          [kiIn/m - (sigmaTot[ci] - ki) * ki / m2^2]
          // Simplified: deltaQ = (wTarget - kiIn)/m + ki*(sigmaTot[ci] - ki - sigmaTot[cTarget])/(m2*m2/4)
          // Standard Louvain formula per Blondel et al.:
          // deltaQ = [sum_in_cTarget + 2*w_i_to_cTarget] / m2 - [(sigmaTot_cTarget + ki) / m2]^2
          //        - [sum_in_cTarget / m2 - (sigmaTot_cTarget / m2)^2 - (ki / m2)^2]
          // Which simplifies to:
          // deltaQ = 2 * (wTarget / m2 - sigmaTot[cTarget] * ki / (m2 * m2))
          //        - 2 * (kiIn / m2 - (sigmaTot[ci] - ki) * ki / (m2 * m2))

          const deltaQ =
            (wTarget - kiIn) / m2 +
            kiVal * ((sigmaTot[ci] - kiVal) - sigmaTot[cTarget]) / (m2 * m2 / 2);

          if (deltaQ > bestDeltaQ) {
            bestDeltaQ = deltaQ;
            bestCommunity = cTarget;
          }
        }

        // Apply the move if beneficial
        if (bestCommunity !== ci && bestDeltaQ > 1e-10) {
          sigmaTot[ci] -= kiVal;
          sigmaTot[bestCommunity] += kiVal;
          community[i] = bestCommunity;
          localImproved = true;
          improved = true;
        }
      }
    }

    if (!improved) break;

    // --- Phase 2: Aggregation ---
    // Renumber communities to 0..numCommunities-1
    const communitySet = new Set<number>();
    for (let i = 0; i < currentN; i++) {
      communitySet.add(community[i]);
    }

    const communityList = Array.from(communitySet);
    const reindex = new Map<number, number>();
    for (let i = 0; i < communityList.length; i++) {
      reindex.set(communityList[i], i);
    }

    const newN = communityList.length;

    // If no reduction happened, we're done
    if (newN === currentN) break;

    // Build coarsened adjacency
    const newAdj: Map<number, number>[] = new Array(newN);
    for (let i = 0; i < newN; i++) {
      newAdj[i] = new Map();
    }

    for (let i = 0; i < currentN; i++) {
      const ci = reindex.get(community[i])!;
      for (const e of adjacency[i]) {
        const cj = reindex.get(community[e.j])!;
        newAdj[ci].set(cj, (newAdj[ci].get(cj) ?? 0) + e.weight);
      }
    }

    // Build new nodeToOriginal mapping
    const newNodeToOriginal: number[][] = new Array(newN);
    for (let i = 0; i < newN; i++) {
      newNodeToOriginal[i] = [];
    }
    for (let i = 0; i < currentN; i++) {
      const ci = reindex.get(community[i])!;
      for (const orig of nodeToOriginal[i]) {
        newNodeToOriginal[ci].push(orig);
      }
    }

    // Convert newAdj to InternalEdge[][]
    const newAdjacencyArray: InternalEdge[][] = new Array(newN);
    for (let i = 0; i < newN; i++) {
      newAdjacencyArray[i] = [];
      for (const [j, w] of newAdj[i]) {
        newAdjacencyArray[i].push({ j, weight: w });
      }
    }

    // Recompute weighted degrees
    const newK = new Float64Array(newN);
    for (let i = 0; i < newN; i++) {
      let sum = 0;
      for (const e of newAdjacencyArray[i]) {
        sum += e.weight;
      }
      newK[i] = sum;
    }

    // Reset for next round
    adjacency = newAdjacencyArray;
    nodeToOriginal = newNodeToOriginal;
    k = newK;
    currentN = newN;

    // Reset community to identity
    community = new Array(currentN);
    sigmaTot = new Float64Array(currentN);
    for (let i = 0; i < currentN; i++) {
      community[i] = i;
      sigmaTot[i] = k[i];
    }

    improved = false; // will be set true if next local move phase finds improvements
    // Re-enter the loop to try further optimization
    improved = true; // speculatively; the inner loop will set it properly
  }

  // Map original node indices to final community ids
  // Renumber communities contiguously from 0
  const finalCommunityMap = new Map<number, number>();
  let nextCommunityId = 0;

  for (let superNode = 0; superNode < currentN; superNode++) {
    const cId = community[superNode];
    if (!finalCommunityMap.has(cId)) {
      finalCommunityMap.set(cId, nextCommunityId++);
    }
    const finalCId = finalCommunityMap.get(cId)!;

    for (const origIdx of nodeToOriginal[superNode]) {
      result.set(ids[origIdx], finalCId);
    }
  }

  return result;
}

// ===========================================================================
// Label Propagation
// ===========================================================================

/**
 * Detect communities using the Label Propagation Algorithm (LPA).
 *
 * Each node starts with a unique label (its own id). In each iteration,
 * every node adopts the label that is most frequent among its neighbors
 * (weighted by edge weight). Ties are broken randomly.
 *
 * The algorithm terminates when no node changes its label (typically
 * in a few iterations). The resulting labels define communities.
 *
 * LPA is fast but non-deterministic. Multiple runs may yield different results.
 *
 * @param graph - The graph to partition.
 * @returns Map from node id to community id (integer starting from 0).
 *
 * @complexity O(I * E) where I is typically small (< 10 iterations).
 */
export function labelPropagation(graph: Graph): Map<string, number> {
  const result = new Map<string, number>();
  const ids = graph.getNodeIds();
  const n = ids.length;

  if (n === 0) return result;

  // Each node starts with its own label (use index as label)
  const label = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    label.set(ids[i], i);
  }

  const maxIterations = 100;
  let changed = true;

  for (let iter = 0; iter < maxIterations && changed; iter++) {
    changed = false;

    // Shuffle node order for non-determinism (Fisher-Yates)
    const order = ids.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = order[i];
      order[i] = order[j];
      order[j] = tmp;
    }

    for (const nodeId of order) {
      const neighbors = graph.neighborEntries(nodeId);
      if (neighbors.length === 0) continue;

      // Count weighted label frequencies among neighbors
      const labelWeights = new Map<number, number>();

      for (const { neighbor, weight } of neighbors) {
        const nLabel = label.get(neighbor)!;
        labelWeights.set(nLabel, (labelWeights.get(nLabel) ?? 0) + weight);
      }

      // Find the label(s) with maximum weight
      let maxWeight = -Infinity;
      const candidates: number[] = [];

      for (const [lbl, w] of labelWeights) {
        if (w > maxWeight) {
          maxWeight = w;
          candidates.length = 0;
          candidates.push(lbl);
        } else if (w === maxWeight) {
          candidates.push(lbl);
        }
      }

      // Break ties randomly
      const chosen = candidates[Math.floor(Math.random() * candidates.length)];
      const oldLabel = label.get(nodeId)!;

      if (chosen !== oldLabel) {
        label.set(nodeId, chosen);
        changed = true;
      }
    }
  }

  // Renumber labels contiguously from 0
  const labelRemap = new Map<number, number>();
  let nextId = 0;

  for (const nodeId of ids) {
    const lbl = label.get(nodeId)!;
    if (!labelRemap.has(lbl)) {
      labelRemap.set(lbl, nextId++);
    }
    result.set(nodeId, labelRemap.get(lbl)!);
  }

  return result;
}
