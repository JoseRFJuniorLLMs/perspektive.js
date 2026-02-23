/**
 * types.ts — Delta Streaming Protocol Types for perspektive.js
 *
 * Defines the wire format for incremental graph updates (born/died/changed),
 * transport configuration, viewport bounds, and connection state.
 *
 * These types form the contract between the NietzscheDB server's delta
 * endpoint and the client-side GraphStore / DeltaStream pipeline.
 *
 * @module streaming/types
 */

// ---------------------------------------------------------------------------
// Delta Protocol
// ---------------------------------------------------------------------------

/** The three possible operations in a delta message. */
export type DeltaOp = 'born' | 'died' | 'changed';

/**
 * A single node-level change in a delta batch.
 *
 * - `born`:    New node entered the graph. `data` contains the full node payload.
 * - `died`:    Node was removed (pruned, expired, etc.). `data` is omitted.
 * - `changed`: Node's fields were updated. `data` contains only the changed fields.
 */
export interface NodeDelta {
  /** The operation type. */
  op: DeltaOp;
  /** Unique node identifier (matches NietzscheDB node id). */
  id: string;
  /** Full node data for 'born', partial update for 'changed', omitted for 'died'. */
  data?: NodePayload;
}

/**
 * A single edge-level change in a delta batch.
 *
 * - `born`:    New edge appeared. `data` contains the full edge payload.
 * - `died`:    Edge was removed. `data` is omitted.
 * - `changed`: Edge weight or metadata changed. `data` contains the changed fields.
 */
export interface EdgeDelta {
  /** The operation type. */
  op: DeltaOp;
  /** Source node id. */
  source: string;
  /** Target node id. */
  target: string;
  /** Full edge data for 'born', partial update for 'changed', omitted for 'died'. */
  data?: EdgePayload;
}

/**
 * A batch of graph changes delivered as a single atomic unit.
 *
 * Sequence numbers are monotonically increasing. If the client detects
 * a gap in `seq`, it must request a full resync from the server.
 */
export interface GraphDelta {
  /** Monotonically increasing sequence number for ordering and gap detection. */
  seq: number;
  /** Server-side Unix timestamp (ms) when this delta was generated. */
  timestamp: number;
  /** Node-level changes in this batch. */
  nodes: NodeDelta[];
  /** Edge-level changes in this batch. */
  edges: EdgeDelta[];
}

// ---------------------------------------------------------------------------
// Node / Edge Payloads
// ---------------------------------------------------------------------------

/**
 * Full node payload as received from NietzscheDB.
 * Compatible with the NodeData interface used by PerspektiveEngine.
 */
export interface NodePayload {
  /** Unique node identifier. */
  id: string;
  /** Semantic type label (e.g. "Episodic", "Concept", "DreamSnapshot"). */
  node_type: string;
  /** Dirichlet / L-System energy level in [0, 1]. */
  energy: number;
  /** Dense embedding vector (used for Poincare projection). */
  embedding: number[];
  /** Russell circumplex arousal (optional). */
  arousal?: number;
  /** Russell circumplex valence (optional). */
  valence?: number;
  /** X coordinate in projected space. */
  x?: number;
  /** Y coordinate in projected space. */
  y?: number;
  /** Z coordinate (used by 3D manifold projections). */
  z?: number;
  /** Allow arbitrary extra fields from the server. */
  [key: string]: unknown;
}

/**
 * Full edge payload as received from NietzscheDB.
 */
export interface EdgePayload {
  /** Source node id. */
  source: string;
  /** Target node id. */
  target: string;
  /** Edge weight in [0, 1]. */
  weight: number;
  /** Allow arbitrary extra fields. */
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Transport Configuration
// ---------------------------------------------------------------------------

/** Supported transport mechanisms for receiving graph deltas. */
export type TransportType = 'sse' | 'websocket' | 'polling';

/**
 * Configuration for the delta streaming pipeline.
 */
export interface StreamConfig {
  /** Base URL for the API server (e.g. "http://localhost:8080"). */
  apiBase: string;
  /** NietzscheDB collection name to subscribe to. */
  collection: string;
  /** Preferred transport mechanism. 'websocket' is tried first with auto-fallback. */
  transport: TransportType;
  /** Base delay in ms before reconnecting after a disconnect. Default: 1000. */
  reconnectDelay?: number;
  /** Maximum number of reconnection attempts before giving up. Default: 10. */
  maxReconnectAttempts?: number;
  /** Maximum number of deltas to accumulate before flushing to the store. Default: 100. */
  batchSize?: number;
  /** Maximum ms between batch flushes to the store. Default: 50. */
  batchInterval?: number;
}

// ---------------------------------------------------------------------------
// Viewport Bounds
// ---------------------------------------------------------------------------

/**
 * Axis-aligned bounding box in world coordinates, used for viewport culling.
 * The Poincare disk operates in [-1, 1] space; other manifolds may use wider ranges.
 */
export interface ViewportBounds {
  /** Left edge of the visible area in world X. */
  minX: number;
  /** Right edge of the visible area in world X. */
  maxX: number;
  /** Bottom edge of the visible area in world Y. */
  minY: number;
  /** Top edge of the visible area in world Y. */
  maxY: number;
  /** Camera zoom factor. Higher values = zoomed in, lower = zoomed out. */
  zoom: number;
}

// ---------------------------------------------------------------------------
// Connection State
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Control Messages (server → client, JSON)
// ---------------------------------------------------------------------------

/**
 * Control messages sent by the server outside the normal delta stream.
 * These are JSON objects with a `type` discriminant field.
 */
export type ControlMessageType = 'RELOAD_GRAPH' | 'HEARTBEAT' | 'situation';

/**
 * RELOAD_GRAPH: the server instructs the client to drop all local state
 * and request a full graph resync. Sent after a REM/dream rollback, a
 * collection snapshot restore, or a major schema migration.
 */
export interface ReloadGraphMessage {
  type: 'RELOAD_GRAPH';
  /** Reason provided by the server (informational). */
  reason?: string;
  /** New sequence number to use after resync. */
  seq?: number;
}

/**
 * HEARTBEAT: keep-alive from the server. The client should reset its
 * reconnection timer upon receipt.
 */
export interface HeartbeatMessage {
  type: 'HEARTBEAT';
  /** Server timestamp (Unix ms). */
  ts: number;
}

/**
 * SITUATION: Situational Modulator event from the agency engine.
 * See `useSituationalModulator.ts` for rendering integration.
 */
export interface SituationMessage {
  type: 'situation';
  /** Crisis severity [0, 1] (0 = calm, 1 = critical). */
  crisis_level: number;
  /** Poincaré hyperbolic depth of the hot zone [0, 1). */
  poincare_depth: number;
  /** X coordinate of the crisis focus in the Poincaré disk. */
  focus_x: number;
  /** Y coordinate of the crisis focus in the Poincaré disk. */
  focus_y: number;
  /** Human-readable reason from the agency engine. */
  reason?: string;
}

/** Union of all non-delta control messages. */
export type ControlMessage = ReloadGraphMessage | HeartbeatMessage | SituationMessage;

// ---------------------------------------------------------------------------
// Connection State
// ---------------------------------------------------------------------------

/** Possible states of the delta stream connection. */
export type ConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

/**
 * Live statistics about the streaming connection and graph state.
 */
export interface StreamStats {
  /** Total number of nodes currently in the store. */
  totalNodes: number;
  /** Total number of edges currently in the store. */
  totalEdges: number;
  /** Number of nodes visible in the current viewport. */
  visibleNodes: number;
  /** Number of edges visible in the current viewport. */
  visibleEdges: number;
  /** Rolling average of deltas received per second. */
  deltasPerSecond: number;
  /** Rolling average latency in ms (server timestamp vs. client receive time). */
  latency: number;
  /** Current connection state. */
  connectionState: ConnectionState;
  /** Number of reconnection attempts made since last successful connection. */
  reconnectAttempts: number;
  /** Last sequence number received. */
  lastSeq: number;
}

// ---------------------------------------------------------------------------
// LOD Levels
// ---------------------------------------------------------------------------

/**
 * Level-of-detail rendering tiers based on camera zoom.
 * Lower tiers render less geometry for better performance at overview zooms.
 */
export enum LODLevel {
  /** Zoom < 0.3x: merge nearby nodes into cluster circles, only major edges. */
  CLUSTER = 0,
  /** Zoom < 1x: only high-energy nodes (top 20%), simplified 4-segment edges. */
  LOW = 1,
  /** Zoom 1x-2x: all nodes, 16-segment edges, no labels. */
  MEDIUM = 2,
  /** Zoom > 2x: all nodes with labels, full 64-segment geodesic edges. */
  HIGH = 3,
}

/**
 * A cluster of merged nodes for the CLUSTER LOD level.
 */
export interface NodeCluster {
  /** Synthetic cluster id (e.g. "cluster_3_7" for grid cell [3,7]). */
  id: string;
  /** Centroid X in world coordinates. */
  x: number;
  /** Centroid Y in world coordinates. */
  y: number;
  /** Z coordinate (typically 0.01 for 2D modes). */
  z: number;
  /** Number of nodes merged into this cluster. */
  count: number;
  /** Sum of merged node energies. */
  totalEnergy: number;
  /** Average energy of merged nodes. */
  avgEnergy: number;
  /** IDs of all nodes in this cluster. */
  memberIds: string[];
  /** Dominant node_type in this cluster. */
  dominantType: string;
}
