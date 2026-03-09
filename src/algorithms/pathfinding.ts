/**
 * perspektive.js - Weighted Pathfinding Algorithms
 *
 * Dijkstra's algorithm and A* search with pluggable heuristics.
 * Includes a self-contained binary min-heap priority queue (zero dependencies).
 *
 * @module algorithms/pathfinding
 */

import { Graph, type NodeData } from './types';

// ===========================================================================
// MinHeap (Binary Heap Priority Queue)
// ===========================================================================

/**
 * A generic binary min-heap priority queue.
 *
 * Used internally by Dijkstra and A* for efficient extraction of the
 * minimum-priority element. Also supports `decreaseKey` through a
 * re-insertion strategy (lazy deletion).
 *
 * @typeParam T - The type of elements stored in the heap.
 *
 * @complexity
 * - insert: O(log n)
 * - extractMin: O(log n)
 * - peek: O(1)
 */
export class MinHeap<T> {
  private heap: Array<{ element: T; priority: number }> = [];

  /** Number of elements currently in the heap. */
  get size(): number {
    return this.heap.length;
  }

  /** Whether the heap is empty. */
  get isEmpty(): boolean {
    return this.heap.length === 0;
  }

  /**
   * Insert an element with the given priority.
   *
   * @param element - The element to insert.
   * @param priority - The priority value (lower = extracted first).
   * @complexity O(log n)
   */
  insert(element: T, priority: number): void {
    this.heap.push({ element, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  /**
   * Remove and return the element with the smallest priority.
   *
   * @returns The element with minimum priority, or `undefined` if empty.
   * @complexity O(log n)
   */
  extractMin(): { element: T; priority: number } | undefined {
    if (this.heap.length === 0) return undefined;

    const min = this.heap[0];
    const last = this.heap.pop()!;

    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }

    return min;
  }

  /**
   * Peek at the minimum element without removing it.
   *
   * @returns The element with minimum priority, or `undefined` if empty.
   * @complexity O(1)
   */
  peek(): { element: T; priority: number } | undefined {
    return this.heap[0];
  }

  // -- internal heap operations --

  private bubbleUp(idx: number): void {
    while (idx > 0) {
      const parentIdx = (idx - 1) >> 1;
      if (this.heap[idx].priority < this.heap[parentIdx].priority) {
        this.swap(idx, parentIdx);
        idx = parentIdx;
      } else {
        break;
      }
    }
  }

  private sinkDown(idx: number): void {
    const length = this.heap.length;
    while (true) {
      let smallest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;

      if (left < length && this.heap[left].priority < this.heap[smallest].priority) {
        smallest = left;
      }
      if (right < length && this.heap[right].priority < this.heap[smallest].priority) {
        smallest = right;
      }

      if (smallest !== idx) {
        this.swap(idx, smallest);
        idx = smallest;
      } else {
        break;
      }
    }
  }

  private swap(a: number, b: number): void {
    const tmp = this.heap[a];
    this.heap[a] = this.heap[b];
    this.heap[b] = tmp;
  }
}

// ===========================================================================
// Dijkstra result types
// ===========================================================================

/** Result of single-source Dijkstra. */
export interface DijkstraResult {
  /**
   * Map from node id to shortest distance from the source.
   * Unreachable nodes have distance `Infinity`.
   */
  distances: Map<string, number>;
  /**
   * Map from node id to its predecessor on the shortest-path tree.
   * The source maps to `null`. Unreachable nodes are not included.
   */
  predecessors: Map<string, string | null>;
}

/** Result of a point-to-point Dijkstra. */
export interface DijkstraPathResult {
  /** The shortest path as an ordered array of node ids (source to target). Empty if no path. */
  path: string[];
  /** Total weight of the shortest path. `Infinity` if no path exists. */
  distance: number;
}

// ===========================================================================
// Dijkstra's algorithm
// ===========================================================================

/**
 * Single-source shortest paths using Dijkstra's algorithm.
 *
 * Computes the shortest weighted distance from `startId` to every reachable
 * node. Requires non-negative edge weights.
 *
 * Uses a binary min-heap for O((V + E) log V) time complexity.
 *
 * @param graph   - The graph (directed or undirected).
 * @param startId - The source node id.
 * @returns An object containing distance and predecessor maps.
 *
 * @complexity O((V + E) log V)
 */
export function dijkstra(graph: Graph, startId: string): DijkstraResult {
  const distances = new Map<string, number>();
  const predecessors = new Map<string, string | null>();
  const visited = new Set<string>();

  // Initialize all distances to Infinity
  for (const node of graph.nodes) {
    distances.set(node.id, Infinity);
  }

  if (!graph.hasNode(startId)) {
    return { distances, predecessors };
  }

  distances.set(startId, 0);
  predecessors.set(startId, null);

  const pq = new MinHeap<string>();
  pq.insert(startId, 0);

  while (!pq.isEmpty) {
    const entry = pq.extractMin()!;
    const u = entry.element;
    const uDist = entry.priority;

    // Lazy deletion: skip if we already found a shorter path
    if (visited.has(u)) continue;
    visited.add(u);

    // If the recorded distance is already shorter, skip
    if (uDist > distances.get(u)!) continue;

    for (const { neighbor, weight } of graph.neighborEntries(u)) {
      if (visited.has(neighbor)) continue;

      const newDist = uDist + weight;
      if (newDist < distances.get(neighbor)!) {
        distances.set(neighbor, newDist);
        predecessors.set(neighbor, u);
        pq.insert(neighbor, newDist);
      }
    }
  }

  return { distances, predecessors };
}

/**
 * Find the shortest weighted path between two specific nodes.
 *
 * This is a goal-directed variant of Dijkstra that terminates as soon as
 * the target is settled. For the full single-source result use {@link dijkstra}.
 *
 * @param graph - The graph (directed or undirected).
 * @param from  - The source node id.
 * @param to    - The target node id.
 * @returns The shortest path and its total weight.
 *
 * @complexity O((V + E) log V), but typically much less due to early termination.
 */
export function dijkstraPath(
  graph: Graph,
  from: string,
  to: string,
): DijkstraPathResult {
  if (!graph.hasNode(from) || !graph.hasNode(to)) {
    return { path: [], distance: Infinity };
  }
  if (from === to) {
    return { path: [from], distance: 0 };
  }

  const distances = new Map<string, number>();
  const predecessors = new Map<string, string | null>();
  const visited = new Set<string>();

  for (const node of graph.nodes) {
    distances.set(node.id, Infinity);
  }

  distances.set(from, 0);
  predecessors.set(from, null);

  const pq = new MinHeap<string>();
  pq.insert(from, 0);

  while (!pq.isEmpty) {
    const entry = pq.extractMin()!;
    const u = entry.element;
    const uDist = entry.priority;

    if (visited.has(u)) continue;
    visited.add(u);

    // Early termination
    if (u === to) break;

    if (uDist > distances.get(u)!) continue;

    for (const { neighbor, weight } of graph.neighborEntries(u)) {
      if (visited.has(neighbor)) continue;

      const newDist = uDist + weight;
      if (newDist < distances.get(neighbor)!) {
        distances.set(neighbor, newDist);
        predecessors.set(neighbor, u);
        pq.insert(neighbor, newDist);
      }
    }
  }

  // Reconstruct path
  const dist = distances.get(to)!;
  if (dist === Infinity) {
    return { path: [], distance: Infinity };
  }

  const path: string[] = [];
  let current: string | null = to;
  while (current !== null) {
    path.push(current);
    current = predecessors.get(current) ?? null;
  }
  path.reverse();

  return { path, distance: dist };
}

// ===========================================================================
// A* heuristic type
// ===========================================================================

/**
 * A heuristic function for A* search.
 * Must be admissible (never overestimate) for A* to guarantee optimality.
 *
 * @param from - The current node data.
 * @param to   - The goal node data.
 * @returns An estimated distance from `from` to `to`.
 */
export type AStarHeuristic = (from: NodeData, to: NodeData) => number;

// ===========================================================================
// Built-in heuristics
// ===========================================================================

/**
 * Euclidean distance heuristic using node (x, y) coordinates.
 *
 * Suitable for graphs embedded in 2D Euclidean space.
 */
export function euclideanHeuristic(a: NodeData, b: NodeData): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Hyperbolic distance heuristic using the Poincare disk metric.
 *
 * For nodes embedded on the Poincare disk (||p|| < 1), the hyperbolic
 * distance is:
 *
 *   d(u, v) = acosh(1 + 2 * ||u - v||^2 / ((1 - ||u||^2)(1 - ||v||^2)))
 *
 * This is admissible when edge weights correspond to (or exceed) hyperbolic
 * distances between endpoints.
 */
export function hyperbolicHeuristic(a: NodeData, b: NodeData): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const diffSq = dx * dx + dy * dy;

  const normASq = a.x * a.x + a.y * a.y;
  const normBSq = b.x * b.x + b.y * b.y;

  const denominator = (1 - normASq) * (1 - normBSq);

  // Guard: if any point is on or beyond the disk boundary, fall back
  if (denominator <= 0) {
    return Math.sqrt(diffSq);
  }

  const argument = 1 + 2 * diffSq / denominator;
  // acosh(x) is defined for x >= 1. Clamp for numerical safety.
  return Math.acosh(Math.max(argument, 1));
}

// ===========================================================================
// A* search
// ===========================================================================

/** Result of an A* search. */
export interface AStarResult {
  /** The shortest path as an ordered array of node ids. Empty if no path. */
  path: string[];
  /** Total weight of the shortest path. `Infinity` if no path exists. */
  distance: number;
  /** Number of nodes expanded during the search (for benchmarking). */
  nodesExpanded: number;
}

/**
 * A* search with a pluggable heuristic.
 *
 * A* is an informed variant of Dijkstra that uses a heuristic `h(n)` to
 * prioritize exploration toward the goal. It maintains the priority
 * `f(n) = g(n) + h(n)` where `g(n)` is the known shortest distance from
 * source and `h(n)` estimates the remaining distance to the target.
 *
 * The default heuristic uses Euclidean distance on node (x, y) coordinates.
 * A hyperbolic heuristic is also provided for Poincare-disk embeddings.
 *
 * @param graph     - The graph to search.
 * @param from      - Source node id.
 * @param to        - Target node id.
 * @param heuristic - Optional heuristic function. Defaults to Euclidean distance.
 * @returns The shortest path, its distance, and the number of nodes expanded.
 *
 * @complexity O((V + E) log V) worst-case, typically better with a good heuristic.
 */
export function aStar(
  graph: Graph,
  from: string,
  to: string,
  heuristic?: AStarHeuristic,
): AStarResult {
  if (!graph.hasNode(from) || !graph.hasNode(to)) {
    return { path: [], distance: Infinity, nodesExpanded: 0 };
  }
  if (from === to) {
    return { path: [from], distance: 0, nodesExpanded: 0 };
  }

  const h = heuristic ?? euclideanHeuristic;
  const goalNode = graph.getNode(to)!;

  const gScore = new Map<string, number>(); // best known distance from start
  const predecessors = new Map<string, string | null>();
  const closed = new Set<string>();

  gScore.set(from, 0);
  predecessors.set(from, null);

  const fromNode = graph.getNode(from)!;
  const pq = new MinHeap<string>();
  pq.insert(from, h(fromNode, goalNode)); // f = g + h = 0 + h

  let nodesExpanded = 0;

  while (!pq.isEmpty) {
    const entry = pq.extractMin()!;
    const u = entry.element;

    if (closed.has(u)) continue;
    closed.add(u);
    nodesExpanded++;

    // Found the goal
    if (u === to) {
      const path = reconstructPath(predecessors, to);
      return { path, distance: gScore.get(to)!, nodesExpanded };
    }

    const uG = gScore.get(u)!;

    for (const { neighbor, weight } of graph.neighborEntries(u)) {
      if (closed.has(neighbor)) continue;

      const tentativeG = uG + weight;
      const currentG = gScore.get(neighbor);

      if (currentG === undefined || tentativeG < currentG) {
        gScore.set(neighbor, tentativeG);
        predecessors.set(neighbor, u);

        const neighborNode = graph.getNode(neighbor);
        const hVal = neighborNode ? h(neighborNode, goalNode) : 0;
        pq.insert(neighbor, tentativeG + hVal);
      }
    }
  }

  // No path found
  return { path: [], distance: Infinity, nodesExpanded };
}

// ===========================================================================
// Utility
// ===========================================================================

/**
 * Reconstruct a path from a predecessors map.
 * @internal
 */
function reconstructPath(
  predecessors: Map<string, string | null>,
  target: string,
): string[] {
  const path: string[] = [];
  let current: string | null = target;

  while (current !== null) {
    path.push(current);
    current = predecessors.get(current) ?? null;
  }

  path.reverse();
  return path;
}
