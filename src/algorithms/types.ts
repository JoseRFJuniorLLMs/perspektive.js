/**
 * perspektive.js - Graph Abstraction Layer
 *
 * Provides an efficient adjacency-list representation for graph algorithms.
 * Wraps raw NodeData[] and EdgeData[] arrays into a structure optimized for
 * traversal, pathfinding, centrality, and community detection operations.
 *
 * Supports both directed and undirected graph semantics.
 *
 * @module algorithms/types
 */

// ---------------------------------------------------------------------------
// Node & Edge data interfaces (compatible with perspektive.js rendering types)
// ---------------------------------------------------------------------------

/**
 * Minimal node representation required by graph algorithms.
 * Coordinates (x, y, z) are used by spatial heuristics (A*, hyperbolic distance).
 */
export interface NodeData {
  /** Unique identifier for this node. */
  id: string;
  /** X coordinate (Poincare disk or layout space). */
  x: number;
  /** Y coordinate (Poincare disk or layout space). */
  y: number;
  /** Z coordinate (used by 3-D manifold projections). */
  z: number;
  /** Dirichlet / L-System energy level. */
  energy: number;
  /** Semantic type label (e.g. "concept", "emotion"). */
  node_type: string;
  /** Dense embedding vector. */
  embedding: number[];
  /** Russell circumplex arousal (optional). */
  arousal?: number;
  /** Russell circumplex valence (optional). */
  valence?: number;
}

/**
 * Weighted directed edge between two nodes.
 */
export interface EdgeData {
  /** ID of the source node. */
  source: string;
  /** ID of the target node. */
  target: string;
  /** Edge weight (positive). Defaults to 1 in algorithms that need it. */
  weight: number;
}

// ---------------------------------------------------------------------------
// Adjacency entry
// ---------------------------------------------------------------------------

/** A single entry in an adjacency list: the neighbor id and the edge weight. */
export interface AdjacencyEntry {
  /** The neighboring node id. */
  neighbor: string;
  /** Weight of the edge to this neighbor. */
  weight: number;
}

// ---------------------------------------------------------------------------
// Visitor callbacks
// ---------------------------------------------------------------------------

/**
 * Optional visitor callback for traversal algorithms.
 * Return `false` to abort the traversal early.
 */
export type TraversalVisitor = (nodeId: string, depth: number) => boolean | void;

// ---------------------------------------------------------------------------
// Graph class
// ---------------------------------------------------------------------------

/**
 * Efficient graph representation using adjacency lists.
 *
 * The constructor builds `Map`-based adjacency structures in O(V + E) time.
 * All look-ups (neighbors, hasEdge, getEdgeWeight) are O(1) amortized thanks
 * to nested `Map` structures.
 *
 * @example
 * ```ts
 * const g = new Graph(nodes, edges);                 // undirected (default)
 * const dg = new Graph(nodes, edges, { directed: true }); // directed
 * console.log(g.neighbors('a'));   // ['b', 'c']
 * console.log(g.degree('a'));      // 2
 * ```
 */
export class Graph {
  /** Original node array. */
  public readonly nodes: ReadonlyArray<NodeData>;
  /** Original edge array. */
  public readonly edges: ReadonlyArray<EdgeData>;
  /** Whether the graph treats edges as directed. */
  public readonly directed: boolean;

  /** Fast node lookup by id. */
  private readonly nodeMap: Map<string, NodeData>;

  /**
   * Outgoing adjacency: nodeId -> Map<neighborId, weight>.
   * For undirected graphs both directions are stored.
   */
  private readonly adjOut: Map<string, Map<string, number>>;

  /**
   * Incoming adjacency (only meaningful for directed graphs).
   * nodeId -> Map<sourceId, weight>.
   */
  private readonly adjIn: Map<string, Map<string, number>>;

  /**
   * Build the graph.
   *
   * @param nodes - Array of nodes.
   * @param edges - Array of edges.
   * @param options - `{ directed?: boolean }`. Default: undirected.
   *
   * @complexity O(V + E)
   */
  constructor(
    nodes: NodeData[],
    edges: EdgeData[],
    options?: { directed?: boolean },
  ) {
    this.nodes = nodes;
    this.edges = edges;
    this.directed = options?.directed ?? false;

    // --- node map ---
    this.nodeMap = new Map<string, NodeData>();
    for (const n of nodes) {
      this.nodeMap.set(n.id, n);
    }

    // --- adjacency lists ---
    this.adjOut = new Map<string, Map<string, number>>();
    this.adjIn = new Map<string, Map<string, number>>();

    // Initialize empty maps for every node so we never need null-checks later.
    for (const n of nodes) {
      this.adjOut.set(n.id, new Map());
      this.adjIn.set(n.id, new Map());
    }

    for (const e of edges) {
      const w = e.weight ?? 1;

      // outgoing s -> t
      const outS = this.adjOut.get(e.source);
      if (outS) {
        // If duplicate edge, keep the minimum weight (consistent with shortest-path usage).
        const existing = outS.get(e.target);
        if (existing === undefined || w < existing) {
          outS.set(e.target, w);
        }
      }

      // incoming t <- s
      const inT = this.adjIn.get(e.target);
      if (inT) {
        const existing = inT.get(e.source);
        if (existing === undefined || w < existing) {
          inT.set(e.source, w);
        }
      }

      // For undirected graphs, mirror the edge.
      if (!this.directed) {
        const outT = this.adjOut.get(e.target);
        if (outT) {
          const existing = outT.get(e.source);
          if (existing === undefined || w < existing) {
            outT.set(e.source, w);
          }
        }

        const inS = this.adjIn.get(e.source);
        if (inS) {
          const existing = inS.get(e.target);
          if (existing === undefined || w < existing) {
            inS.set(e.target, w);
          }
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Node access
  // -----------------------------------------------------------------------

  /** Total number of nodes. */
  get nodeCount(): number {
    return this.nodes.length;
  }

  /** Total number of edges (original, not doubled for undirected). */
  get edgeCount(): number {
    return this.edges.length;
  }

  /**
   * Retrieve a node's data by id.
   * @returns The NodeData or `undefined` if not found.
   */
  getNode(id: string): NodeData | undefined {
    return this.nodeMap.get(id);
  }

  /** Check whether a node exists. */
  hasNode(id: string): boolean {
    return this.nodeMap.has(id);
  }

  /** Return all node ids. */
  getNodeIds(): string[] {
    return Array.from(this.nodeMap.keys());
  }

  // -----------------------------------------------------------------------
  // Adjacency queries
  // -----------------------------------------------------------------------

  /**
   * Return the ids of all outgoing neighbors of a node.
   * For undirected graphs this is equivalent to all neighbors.
   *
   * @complexity O(deg(v))
   */
  neighbors(id: string): string[] {
    const m = this.adjOut.get(id);
    return m ? Array.from(m.keys()) : [];
  }

  /**
   * Return neighbor entries with weights (outgoing direction).
   *
   * @complexity O(deg(v))
   */
  neighborEntries(id: string): AdjacencyEntry[] {
    const m = this.adjOut.get(id);
    if (!m) return [];
    const result: AdjacencyEntry[] = [];
    for (const [neighbor, weight] of m) {
      result.push({ neighbor, weight });
    }
    return result;
  }

  /**
   * Out-degree of a node (number of outgoing edges).
   * For undirected graphs this equals the total degree.
   */
  degree(id: string): number {
    return this.adjOut.get(id)?.size ?? 0;
  }

  /**
   * Out-degree (same as `degree` for undirected graphs).
   */
  outDegree(id: string): number {
    return this.adjOut.get(id)?.size ?? 0;
  }

  /**
   * In-degree of a node.
   * For undirected graphs this equals the out-degree.
   */
  inDegree(id: string): number {
    return this.adjIn.get(id)?.size ?? 0;
  }

  /**
   * Check whether an edge exists from `source` to `target`.
   * For undirected graphs both directions are checked implicitly
   * because the adjacency is mirrored.
   *
   * @complexity O(1) amortized
   */
  hasEdge(source: string, target: string): boolean {
    return this.adjOut.get(source)?.has(target) ?? false;
  }

  /**
   * Get the weight of the edge from `source` to `target`.
   *
   * @returns The weight, or `Infinity` if no such edge exists.
   * @complexity O(1) amortized
   */
  getEdgeWeight(source: string, target: string): number {
    return this.adjOut.get(source)?.get(target) ?? Infinity;
  }

  /**
   * Return predecessors (nodes with edges pointing *into* `id`).
   * Useful for directed graph algorithms (e.g. reverse BFS).
   */
  predecessors(id: string): string[] {
    const m = this.adjIn.get(id);
    return m ? Array.from(m.keys()) : [];
  }

  /**
   * Iterate over all edges. For undirected graphs each edge appears once
   * (using the original edge list).
   */
  forEachEdge(callback: (source: string, target: string, weight: number) => void): void {
    for (const e of this.edges) {
      callback(e.source, e.target, e.weight ?? 1);
    }
  }
}
