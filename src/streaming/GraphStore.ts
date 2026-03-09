/**
 * GraphStore.ts — High-performance mutable graph store for perspektive.js
 *
 * This is NOT React state. It's a raw Map-based store designed for maximum
 * throughput when processing thousands of delta operations per second.
 *
 * The store maintains:
 * - `nodes: Map<string, NodePayload>` — O(1) lookup by ID
 * - `edges: Map<string, EdgePayload>` — O(1) lookup by composite key "source:target"
 * - A SpatialIndex for fast viewport queries
 * - Immutable snapshot generation for React consumption (only when dirty)
 *
 * React integration is via `useSyncExternalStore`: the store exposes
 * `subscribe()` and `getSnapshot()` methods, producing a new snapshot
 * reference only when actual mutations occurred.
 *
 * @module streaming/GraphStore
 */

import type {
  GraphDelta,
  NodeDelta,
  EdgeDelta,
  NodePayload,
  EdgePayload,
  ViewportBounds,
} from './types';
import { SpatialIndex } from './SpatialIndex';
import { BinaryDecoder } from './BinaryDecoder';

// ---------------------------------------------------------------------------
// Snapshot Type
// ---------------------------------------------------------------------------

/**
 * Immutable snapshot of the graph state for React consumption.
 * A new object is created only when the store has been mutated.
 */
export interface GraphSnapshot {
  /** All nodes as an array (materialized from the Map). */
  nodes: NodePayload[];
  /** All edges as an array (materialized from the Map). */
  edges: EdgePayload[];
  /** Total node count. */
  nodeCount: number;
  /** Total edge count. */
  edgeCount: number;
  /** Monotonic version counter — incremented on every mutation batch. */
  version: number;
}

// ---------------------------------------------------------------------------
// Listener Type
// ---------------------------------------------------------------------------

/** Callback invoked when the store is mutated. */
export type StoreListener = () => void;

// ---------------------------------------------------------------------------
// GraphStore Class
// ---------------------------------------------------------------------------

/**
 * High-performance mutable graph store backed by Maps and a SpatialIndex.
 *
 * Designed for delta streaming: apply born/died/changed operations in O(delta_size),
 * then notify listeners to trigger React re-renders.
 *
 * @example
 * ```ts
 * const store = new GraphStore();
 * store.subscribe(() => console.log('Graph changed!'));
 * store.applyDelta({
 *   seq: 1,
 *   timestamp: Date.now(),
 *   nodes: [{ op: 'born', id: 'n1', data: { id: 'n1', node_type: 'Concept', energy: 0.5, embedding: [0.1, 0.2] } }],
 *   edges: [],
 * });
 * const snap = store.getSnapshot();
 * console.log(snap.nodeCount); // 1
 * ```
 */
export class GraphStore {
  /** Primary node storage. O(1) get/set/delete by ID. */
  private readonly nodes: Map<string, NodePayload> = new Map();

  /** Primary edge storage. Key format: "source:target". O(1) operations. */
  private readonly edges: Map<string, EdgePayload> = new Map();

  /** Grid-based spatial index for viewport queries. */
  private readonly spatial: SpatialIndex;

  /** Adjacency: node ID -> Set of edge keys that reference this node. */
  private readonly nodeEdges: Map<string, Set<string>> = new Map();

  /** Set of listeners notified after each mutation batch. */
  private readonly listeners: Set<StoreListener> = new Set();

  /** Cached immutable snapshot. Invalidated on mutation. */
  private cachedSnapshot: GraphSnapshot | null = null;

  /** Monotonic version counter. */
  private version = 0;

  /** Last successfully applied sequence number. */
  private lastSeq = -1;

  /** Whether the store has been mutated since the last snapshot. */
  private dirty = false;

  /**
   * Create a new GraphStore.
   *
   * @param gridSize - Spatial index grid resolution (default 32).
   * @param spatialMin - Lower bound of spatial index (default -1.5).
   * @param spatialMax - Upper bound of spatial index (default 1.5).
   */
  constructor(gridSize = 32, spatialMin = -1.5, spatialMax = 1.5) {
    this.spatial = new SpatialIndex(gridSize, spatialMin, spatialMax);
  }

  // -----------------------------------------------------------------------
  // Delta Application
  // -----------------------------------------------------------------------

  /**
   * Apply a batch of graph deltas atomically.
   *
   * Processes all node and edge operations, updates the spatial index,
   * increments the version, and notifies all listeners.
   *
   * @param delta - The delta batch to apply.
   * @returns True if applied successfully, false if the delta was stale (seq <= lastSeq).
   */
  applyDelta(delta: GraphDelta): boolean {
    // Reject stale or duplicate deltas
    if (delta.seq <= this.lastSeq) {
      return false;
    }

    let mutated = false;

    // Process node deltas
    for (let i = 0; i < delta.nodes.length; i++) {
      if (this.applyNodeDelta(delta.nodes[i])) {
        mutated = true;
      }
    }

    // Process edge deltas
    for (let i = 0; i < delta.edges.length; i++) {
      if (this.applyEdgeDelta(delta.edges[i])) {
        mutated = true;
      }
    }

    this.lastSeq = delta.seq;

    if (mutated) {
      this.handleMutation();
    }

    return true;
  }

  /**
   * Apply a binary delta batch from NietzscheDB.
   * High-performance path using FlatBuffers.
   */
  applyBinaryBatch(buffer: Uint8Array, seq: number): void {
    if (seq <= this.lastSeq) return;

    const delta = BinaryDecoder.decodeDelta(buffer);
    let mutated = false;

    // Binary results are already Upsert/Delete ready
    for (const node of delta.nodes) {
      this.nodes.set(node.id, node as NodePayload);
      this.spatial.insert(node.id, this.getNodeX(node as NodePayload), this.getNodeY(node as NodePayload));
      mutated = true;
    }

    for (const edge of delta.edges) {
      const key = `${edge.source}:${edge.target}`;
      this.edges.set(key, edge as EdgePayload);
      this.nodeEdges.get(edge.source)?.add(key);
      this.nodeEdges.get(edge.target)?.add(key);
      mutated = true;
    }

    for (const id of delta.deletes) {
      if (this.nodes.has(id)) {
        this.nodes.delete(id);
        this.spatial.remove(id);
        mutated = true;
      }
    }

    this.lastSeq = seq;
    if (mutated) {
      this.handleMutation();
    }
  }

  public handleMutation() {
    this.dirty = true;
    this.cachedSnapshot = null;
    this.version++;
    this.notifyListeners();
  }

  /**
   * Apply a single node delta.
   * @returns True if the store was actually modified.
   */
  private applyNodeDelta(nd: NodeDelta): boolean {
    switch (nd.op) {
      case 'born': {
        if (!nd.data) return false;
        const node: NodePayload = { ...nd.data, id: nd.id };
        this.nodes.set(nd.id, node);
        this.nodeEdges.set(nd.id, new Set());

        // Update spatial index if coordinates are available
        const x = this.getNodeX(node);
        const y = this.getNodeY(node);
        this.spatial.insert(nd.id, x, y);
        return true;
      }

      case 'died': {
        const existing = this.nodes.get(nd.id);
        if (!existing) return false;

        // Remove all edges connected to this node
        const edgeSet = this.nodeEdges.get(nd.id);
        if (edgeSet) {
          for (const edgeKey of edgeSet) {
            this.edges.delete(edgeKey);
          }
          // Also clean up the other side of each edge
          for (const edgeKey of edgeSet) {
            const [source, target] = edgeKey.split(':');
            const otherId = source === nd.id ? target : source;
            this.nodeEdges.get(otherId)?.delete(edgeKey);
          }
          this.nodeEdges.delete(nd.id);
        }

        this.nodes.delete(nd.id);
        this.spatial.remove(nd.id);
        return true;
      }

      case 'changed': {
        const existing = this.nodes.get(nd.id);
        if (!existing) return false;
        if (!nd.data) return false;

        // Merge changed fields into existing node
        const updated: NodePayload = { ...existing };
        const data = nd.data;
        for (const key of Object.keys(data)) {
          if (key !== 'id') {
            (updated as Record<string, unknown>)[key] = (data as Record<string, unknown>)[key];
          }
        }
        this.nodes.set(nd.id, updated);

        // Update spatial index if position changed
        const newX = this.getNodeX(updated);
        const newY = this.getNodeY(updated);
        this.spatial.move(nd.id, newX, newY);
        return true;
      }

      default:
        return false;
    }
  }

  /**
   * Apply a single edge delta.
   * @returns True if the store was actually modified.
   */
  private applyEdgeDelta(ed: EdgeDelta): boolean {
    const key = `${ed.source}:${ed.target}`;

    switch (ed.op) {
      case 'born': {
        if (!ed.data) return false;
        const edge = { ...ed.data, source: ed.source, target: ed.target } as EdgePayload;
        if (edge.weight === undefined) edge.weight = 0.5;
        this.edges.set(key, edge);

        // Register this edge with both endpoint nodes
        this.nodeEdges.get(ed.source)?.add(key);
        this.nodeEdges.get(ed.target)?.add(key);
        return true;
      }

      case 'died': {
        if (!this.edges.has(key)) return false;
        this.edges.delete(key);

        // Unregister from both endpoints
        this.nodeEdges.get(ed.source)?.delete(key);
        this.nodeEdges.get(ed.target)?.delete(key);
        return true;
      }

      case 'changed': {
        const existing = this.edges.get(key);
        if (!existing) return false;
        if (!ed.data) return false;

        const updated: EdgePayload = { ...existing };
        const data = ed.data;
        for (const k of Object.keys(data)) {
          (updated as Record<string, unknown>)[k] = (data as Record<string, unknown>)[k];
        }
        this.edges.set(key, updated);
        return true;
      }

      default:
        return false;
    }
  }

  // -----------------------------------------------------------------------
  // Coordinate Extraction
  // -----------------------------------------------------------------------

  /**
   * Extract the X coordinate from a node.
   * Uses depth for radius when embedding norm is tiny (truncated high-dim vectors).
   */
  private getNodeX(node: NodePayload): number {
    if (node.x !== undefined) return node.x;
    if (node.embedding && node.embedding.length >= 1) {
      const e = node.embedding;
      let sumSq = 0;
      for (let i = 0; i < e.length; i++) sumSq += e[i] * e[i];
      const embNorm = Math.sqrt(sumSq);
      const len = Math.sqrt(e[0] * e[0] + (e[1] ?? 0) * (e[1] ?? 0)) || 1;
      const dx = e[0] / len;
      // Use depth for radius when embedding is truncated (norm < 0.1)
      const r = embNorm < 0.1
        ? Math.min(Math.tanh(((node as any).depth ?? 0.3) * 4) * 0.95, 0.98)
        : Math.min(embNorm, 0.99);
      return dx * r;
    }
    return 0;
  }

  /**
   * Extract the Y coordinate from a node.
   * Uses depth for radius when embedding norm is tiny (truncated high-dim vectors).
   */
  private getNodeY(node: NodePayload): number {
    if (node.y !== undefined) return node.y;
    if (node.embedding && node.embedding.length >= 2) {
      const e = node.embedding;
      let sumSq = 0;
      for (let i = 0; i < e.length; i++) sumSq += e[i] * e[i];
      const embNorm = Math.sqrt(sumSq);
      const len = Math.sqrt(e[0] * e[0] + e[1] * e[1]) || 1;
      const dy = e[1] / len;
      const r = embNorm < 0.1
        ? Math.min(Math.tanh(((node as any).depth ?? 0.3) * 4) * 0.95, 0.98)
        : Math.min(embNorm, 0.99);
      return dy * r;
    }
    return 0;
  }

  // -----------------------------------------------------------------------
  // Snapshot (for React useSyncExternalStore)
  // -----------------------------------------------------------------------

  /**
   * Get an immutable snapshot of the current graph state.
   * Returns a cached reference if no mutations have occurred since the last call.
   * This is the `getSnapshot` function for `useSyncExternalStore`.
   */
  getSnapshot(): GraphSnapshot {
    if (this.cachedSnapshot !== null && !this.dirty) {
      return this.cachedSnapshot;
    }

    this.cachedSnapshot = {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
      version: this.version,
    };
    this.dirty = false;

    return this.cachedSnapshot;
  }

  // -----------------------------------------------------------------------
  // Subscription (for React useSyncExternalStore)
  // -----------------------------------------------------------------------

  /**
   * Subscribe to store changes. Returns an unsubscribe function.
   * This is the `subscribe` function for `useSyncExternalStore`.
   *
   * @param listener - Callback invoked whenever the store is mutated.
   * @returns Unsubscribe function.
   */
  subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Notify all subscribed listeners. */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  // -----------------------------------------------------------------------
  // Spatial Queries
  // -----------------------------------------------------------------------

  /**
   * Get the set of node IDs visible within the given viewport bounds.
   * Delegates to the SpatialIndex for fast grid-based lookup.
   *
   * @param bounds - Axis-aligned bounding box in world coordinates.
   * @returns Set of node IDs in the viewport.
   */
  getNodesInBounds(bounds: ViewportBounds): Set<string> {
    return this.spatial.query(bounds);
  }

  /**
   * Get the set of node IDs within a circular radius.
   *
   * @param cx - Center X.
   * @param cy - Center Y.
   * @param r - Radius.
   * @returns Set of node IDs within the radius.
   */
  getNodesInRadius(cx: number, cy: number, r: number): Set<string> {
    return this.spatial.queryRadius(cx, cy, r);
  }

  /**
   * Get the edges where both endpoints are in the given set of visible node IDs.
   * Returns edge payloads for rendering.
   *
   * @param visibleNodeIds - Set of node IDs currently visible.
   * @returns Array of edges where both source and target are visible.
   */
  getVisibleEdges(visibleNodeIds: Set<string>): EdgePayload[] {
    const result: EdgePayload[] = [];
    for (const edge of this.edges.values()) {
      if (visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)) {
        result.push(edge);
      }
    }
    return result;
  }

  // -----------------------------------------------------------------------
  // Direct Access
  // -----------------------------------------------------------------------

  /**
   * Get a single node by ID. O(1).
   * @returns The node payload or undefined.
   */
  getNode(id: string): NodePayload | undefined {
    return this.nodes.get(id);
  }

  /**
   * Get a single edge by source and target. O(1).
   * @returns The edge payload or undefined.
   */
  getEdge(source: string, target: string): EdgePayload | undefined {
    return this.edges.get(`${source}:${target}`);
  }

  /** Check if a node exists. O(1). */
  hasNode(id: string): boolean {
    return this.nodes.has(id);
  }

  /** Check if an edge exists. O(1). */
  hasEdge(source: string, target: string): boolean {
    return this.edges.has(`${source}:${target}`);
  }

  /** Total number of nodes in the store. */
  get nodeCount(): number {
    return this.nodes.size;
  }

  /** Total number of edges in the store. */
  get edgeCount(): number {
    return this.edges.size;
  }

  /** Last applied sequence number. */
  get lastSequence(): number {
    return this.lastSeq;
  }

  /** Current version counter. */
  get currentVersion(): number {
    return this.version;
  }

  // -----------------------------------------------------------------------
  // Bulk Operations
  // -----------------------------------------------------------------------

  /**
   * Load a full graph snapshot (initial REST fetch or resync).
   * Replaces all existing data. More efficient than individual deltas
   * for the initial load.
   *
   * @param nodes - Complete array of nodes.
   * @param edges - Complete array of edges.
   */
  loadFull(nodes: NodePayload[], edges: EdgePayload[]): void {
    // Clear everything
    this.nodes.clear();
    this.edges.clear();
    this.nodeEdges.clear();
    this.spatial.clear();

    // Load nodes
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      this.nodes.set(node.id, node);
      this.nodeEdges.set(node.id, new Set());

      const x = this.getNodeX(node);
      const y = this.getNodeY(node);
      this.spatial.insert(node.id, x, y);
    }

    // Load edges
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const key = `${edge.source}:${edge.target}`;
      this.edges.set(key, edge);

      this.nodeEdges.get(edge.source)?.add(key);
      this.nodeEdges.get(edge.target)?.add(key);
    }

    // Reset sequence tracking for resync
    this.lastSeq = -1;
    this.dirty = true;
    this.cachedSnapshot = null;
    this.version++;
    this.notifyListeners();
  }

  /**
   * Clear all data from the store and reset to empty state.
   */
  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.nodeEdges.clear();
    this.spatial.clear();
    this.lastSeq = -1;
    this.dirty = true;
    this.cachedSnapshot = null;
    this.version++;
    this.notifyListeners();
  }

  // -----------------------------------------------------------------------
  // Spatial Index Access
  // -----------------------------------------------------------------------

  /** Direct access to the spatial index for advanced queries. */
  getSpatialIndex(): SpatialIndex {
    return this.spatial;
  }

  /**
   * Iterate over all nodes. Prefer getSnapshot() for React rendering.
   * This is useful for algorithms that need to iterate without creating arrays.
   */
  forEachNode(callback: (id: string, node: NodePayload) => void): void {
    for (const [id, node] of this.nodes) {
      callback(id, node);
    }
  }

  /**
   * Iterate over all edges. Prefer getSnapshot() for React rendering.
   */
  forEachEdge(callback: (key: string, edge: EdgePayload) => void): void {
    for (const [key, edge] of this.edges) {
      callback(key, edge);
    }
  }
}
