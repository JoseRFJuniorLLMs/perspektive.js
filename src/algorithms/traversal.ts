/**
 * perspektive.js - Graph Traversal Algorithms
 *
 * Breadth-first search, depth-first search, connected component detection,
 * connectivity checks, and unweighted shortest path computation.
 *
 * All algorithms operate on the {@link Graph} abstraction and have no
 * external dependencies.
 *
 * @module algorithms/traversal
 */

import { Graph, type TraversalVisitor } from './types';

// ---------------------------------------------------------------------------
// BFS result
// ---------------------------------------------------------------------------

/** Result of a breadth-first search. */
export interface BFSResult {
  /** Node ids in the order they were first visited. */
  order: string[];
  /**
   * Map from node id to its BFS distance (hop count) from the start node.
   * Unreachable nodes are not included.
   */
  distances: Map<string, number>;
  /**
   * Map from node id to its predecessor on the BFS tree.
   * The start node maps to `null`.
   */
  predecessors: Map<string, string | null>;
}

// ---------------------------------------------------------------------------
// DFS result
// ---------------------------------------------------------------------------

/** Result of a depth-first search. */
export interface DFSResult {
  /** Node ids in the order they were first discovered. */
  order: string[];
  /**
   * Discovery time for each node (0-indexed counter).
   */
  discoveryTime: Map<string, number>;
  /**
   * Finish time for each node — the counter value when all descendants
   * have been fully explored.
   */
  finishTime: Map<string, number>;
  /**
   * Map from node id to its predecessor on the DFS tree.
   * Root nodes map to `null`.
   */
  predecessors: Map<string, string | null>;
}

// ---------------------------------------------------------------------------
// BFS
// ---------------------------------------------------------------------------

/**
 * Breadth-first search from a single source node.
 *
 * Visits every node reachable from `startId` in order of increasing hop
 * distance. An optional `visitor` callback is invoked for each discovered
 * node; returning `false` from the visitor aborts the traversal early.
 *
 * @param graph - The graph to traverse.
 * @param startId - The id of the source node.
 * @param visitor - Optional callback `(nodeId, depth) => boolean | void`.
 * @returns BFS results containing visit order, distances, and predecessors.
 *
 * @complexity O(V + E)
 */
export function bfs(
  graph: Graph,
  startId: string,
  visitor?: TraversalVisitor,
): BFSResult {
  const order: string[] = [];
  const distances = new Map<string, number>();
  const predecessors = new Map<string, string | null>();

  if (!graph.hasNode(startId)) {
    return { order, distances, predecessors };
  }

  const queue: string[] = [];
  distances.set(startId, 0);
  predecessors.set(startId, null);
  queue.push(startId);

  let head = 0; // pointer into queue (avoids shift() which is O(n))

  while (head < queue.length) {
    const current = queue[head++];
    const depth = distances.get(current)!;
    order.push(current);

    // Invoke visitor
    if (visitor) {
      const cont = visitor(current, depth);
      if (cont === false) break;
    }

    for (const neighbor of graph.neighbors(current)) {
      if (!distances.has(neighbor)) {
        distances.set(neighbor, depth + 1);
        predecessors.set(neighbor, current);
        queue.push(neighbor);
      }
    }
  }

  return { order, distances, predecessors };
}

// ---------------------------------------------------------------------------
// DFS
// ---------------------------------------------------------------------------

/**
 * Depth-first search from a single source node (iterative to avoid stack overflow).
 *
 * Discovers nodes as deep as possible before backtracking. Records both
 * discovery and finish times, which are useful for topological sorting
 * and cycle detection.
 *
 * An optional `visitor` callback is invoked when a node is *discovered*;
 * returning `false` aborts the traversal.
 *
 * @param graph - The graph to traverse.
 * @param startId - The id of the source node.
 * @param visitor - Optional callback `(nodeId, depth) => boolean | void`.
 * @returns DFS results containing visit order, discovery/finish times, predecessors.
 *
 * @complexity O(V + E)
 */
export function dfs(
  graph: Graph,
  startId: string,
  visitor?: TraversalVisitor,
): DFSResult {
  const order: string[] = [];
  const discoveryTime = new Map<string, number>();
  const finishTime = new Map<string, number>();
  const predecessors = new Map<string, string | null>();

  if (!graph.hasNode(startId)) {
    return { order, discoveryTime, finishTime, predecessors };
  }

  let time = 0;
  let aborted = false;

  // Stack entries: [nodeId, neighborIndex, parentId, depth]
  // neighborIndex tracks which neighbor to visit next (iterative DFS).
  type StackFrame = {
    nodeId: string;
    neighbors: string[];
    neighborIdx: number;
    depth: number;
  };

  const stack: StackFrame[] = [];

  // Discover the start node
  discoveryTime.set(startId, time++);
  predecessors.set(startId, null);
  order.push(startId);

  if (visitor) {
    const cont = visitor(startId, 0);
    if (cont === false) {
      finishTime.set(startId, time++);
      aborted = true;
    }
  }

  if (!aborted) {
    stack.push({
      nodeId: startId,
      neighbors: graph.neighbors(startId),
      neighborIdx: 0,
      depth: 0,
    });
  }

  while (stack.length > 0 && !aborted) {
    const frame = stack[stack.length - 1];

    if (frame.neighborIdx < frame.neighbors.length) {
      const neighbor = frame.neighbors[frame.neighborIdx++];

      if (!discoveryTime.has(neighbor)) {
        // Discover new node
        discoveryTime.set(neighbor, time++);
        predecessors.set(neighbor, frame.nodeId);
        order.push(neighbor);

        if (visitor) {
          const cont = visitor(neighbor, frame.depth + 1);
          if (cont === false) {
            finishTime.set(neighbor, time++);
            aborted = true;
            break;
          }
        }

        stack.push({
          nodeId: neighbor,
          neighbors: graph.neighbors(neighbor),
          neighborIdx: 0,
          depth: frame.depth + 1,
        });
      }
    } else {
      // All neighbors explored -> finish this node
      finishTime.set(frame.nodeId, time++);
      stack.pop();
    }
  }

  // If aborted, finish all remaining stack frames
  if (aborted) {
    while (stack.length > 0) {
      const frame = stack.pop()!;
      if (!finishTime.has(frame.nodeId)) {
        finishTime.set(frame.nodeId, time++);
      }
    }
  }

  return { order, discoveryTime, finishTime, predecessors };
}

// ---------------------------------------------------------------------------
// Connected components
// ---------------------------------------------------------------------------

/**
 * Find all connected components of the graph.
 *
 * Uses BFS internally. For directed graphs this finds *weakly* connected
 * components (treating all edges as undirected).
 *
 * @param graph - The graph to analyze.
 * @returns An array of components, where each component is an array of node ids.
 *
 * @complexity O(V + E)
 */
export function connectedComponents(graph: Graph): string[][] {
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const node of graph.nodes) {
    if (visited.has(node.id)) continue;

    // BFS from this unvisited node
    const component: string[] = [];
    const queue: string[] = [node.id];
    visited.add(node.id);
    let head = 0;

    while (head < queue.length) {
      const current = queue[head++];
      component.push(current);

      // For weakly connected components on directed graphs,
      // we need to follow edges in both directions.
      const neighbors = graph.neighbors(current);
      const predecessors = graph.directed ? graph.predecessors(current) : [];

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }

      for (const pred of predecessors) {
        if (!visited.has(pred)) {
          visited.add(pred);
          queue.push(pred);
        }
      }
    }

    components.push(component);
  }

  return components;
}

// ---------------------------------------------------------------------------
// Connectivity check
// ---------------------------------------------------------------------------

/**
 * Check whether the graph is connected.
 *
 * For directed graphs, this checks *weak* connectivity (i.e., ignoring
 * edge direction). Returns `true` for an empty graph (vacuously connected).
 *
 * @param graph - The graph to test.
 * @returns `true` if the graph is (weakly) connected.
 *
 * @complexity O(V + E)
 */
export function isConnected(graph: Graph): boolean {
  if (graph.nodeCount <= 1) return true;
  const components = connectedComponents(graph);
  return components.length === 1;
}

// ---------------------------------------------------------------------------
// Unweighted shortest path (BFS-based)
// ---------------------------------------------------------------------------

/**
 * Find the shortest (unweighted) path between two nodes using BFS.
 *
 * All edges are treated as having weight 1 regardless of their actual weight.
 * For weighted shortest paths, use {@link dijkstraPath} instead.
 *
 * @param graph - The graph to search.
 * @param from  - The source node id.
 * @param to    - The target node id.
 * @returns An array of node ids from `from` to `to` (inclusive), or an empty
 *          array if no path exists.
 *
 * @complexity O(V + E)
 */
export function shortestPathBFS(
  graph: Graph,
  from: string,
  to: string,
): string[] {
  if (from === to && graph.hasNode(from)) return [from];
  if (!graph.hasNode(from) || !graph.hasNode(to)) return [];

  const predecessors = new Map<string, string | null>();
  const queue: string[] = [from];
  predecessors.set(from, null);
  let head = 0;
  let found = false;

  while (head < queue.length) {
    const current = queue[head++];

    if (current === to) {
      found = true;
      break;
    }

    for (const neighbor of graph.neighbors(current)) {
      if (!predecessors.has(neighbor)) {
        predecessors.set(neighbor, current);
        queue.push(neighbor);
      }
    }
  }

  if (!found) return [];

  // Reconstruct path
  const path: string[] = [];
  let current: string | null = to;
  while (current !== null) {
    path.push(current);
    current = predecessors.get(current) ?? null;
  }

  path.reverse();
  return path;
}
