/**
 * WebSocketClient.ts — High-performance WebSocket client for NietzscheDB streaming
 *
 * Features:
 * - Native WebSocket with auto-reconnect (exponential backoff, max 30s)
 * - Binary frame detection (ArrayBuffer → applyBinaryBatch)
 * - JSON delta detection (text → applyDelta)
 * - Connection status observable (subscribe/getStatus)
 * - Clean destroy() for lifecycle management
 */

import type { GraphStore } from './GraphStore';

// ==========================================
// TYPES
// ==========================================

export type WSStatus = 'connecting' | 'open' | 'closed' | 'error';
export type StatusListener = (status: WSStatus) => void;

/** CDC event types emitted by NietzscheDB change data capture stream. */
export type CDCEventType =
  | 'InsertNode'
  | 'UpdateNode'
  | 'DeleteNode'
  | 'InsertEdge'
  | 'DeleteEdge'
  | 'SleepCycle'
  | 'Zaratustra'
  | 'Defibrillate';

/** Incoming CDC message shape from the WebSocket. */
export interface CDCMessage {
  type: 'CDC';
  event_type: CDCEventType;
  data: any;
}

/** Info passed to CDC subscribers for the event log. */
export interface CDCEventInfo {
  event_type: CDCEventType;
  node_id: string | null;
  timestamp: number;
}

export type CDCListener = (event: CDCEventInfo) => void;

export interface WebSocketClientOptions {
  /** WebSocket URL, e.g. ws://localhost:8080/api/graph/stream */
  url: string;
  /** GraphStore to push deltas into */
  store: GraphStore;
  /** Reconnect: initial delay in ms. Default: 500 */
  reconnectDelayMs?: number;
  /** Reconnect: max delay cap in ms. Default: 30000 */
  maxReconnectDelayMs?: number;
  /** Reconnect: max attempts (0 = unlimited). Default: 0 */
  maxAttempts?: number;
}

// ==========================================
// CLIENT
// ==========================================

export class WebSocketClient {
  private url: string;
  private store: GraphStore;
  private ws: WebSocket | null = null;
  private status: WSStatus = 'closed';
  private listeners: Set<StatusListener> = new Set();
  private cdcListeners: Set<CDCListener> = new Set();
  private seq = 0;
  private _cdcEventCount = 0;

  // Reconnect state
  private reconnectDelayMs: number;
  private maxReconnectDelayMs: number;
  private maxAttempts: number;
  private attempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor({
    url,
    store,
    reconnectDelayMs = 500,
    maxReconnectDelayMs = 30000,
    maxAttempts = 0,
  }: WebSocketClientOptions) {
    this.url = url;
    this.store = store;
    this.reconnectDelayMs = reconnectDelayMs;
    this.maxReconnectDelayMs = maxReconnectDelayMs;
    this.maxAttempts = maxAttempts;
  }

  // ── Public API ──────────────────────────────────────────────────────────

  connect(): void {
    if (this.destroyed) return;
    this.clearReconnect();
    this.setStatus('connecting');
    this.createSocket();
  }

  disconnect(): void {
    this.clearReconnect();
    this.ws?.close(1000, 'Client disconnect');
    this.ws = null;
    this.setStatus('closed');
  }

  destroy(): void {
    this.destroyed = true;
    this.disconnect();
    this.listeners.clear();
    this.cdcListeners.clear();
  }

  getStatus(): WSStatus {
    return this.status;
  }

  subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Subscribe to CDC events. Returns an unsubscribe function. */
  subscribeCDC(listener: CDCListener): () => void {
    this.cdcListeners.add(listener);
    return () => this.cdcListeners.delete(listener);
  }

  /** Total number of CDC events received since client creation. */
  get cdcEventCount(): number {
    return this._cdcEventCount;
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private createSocket(): void {
    try {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        this.attempts = 0;
        this.setStatus('open');
      };

      ws.onmessage = (event: MessageEvent) => {
        this.seq++;
        if (event.data instanceof ArrayBuffer) {
          // Binary FlatBuffers delta
          this.store.applyBinaryBatch(new Uint8Array(event.data), this.seq);
        } else if (typeof event.data === 'string') {
          if (event.data.startsWith('bin:')) {
            // Base64-encoded binary fallback
            const b64 = event.data.substring(4);
            const binary = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
            this.store.applyBinaryBatch(binary, this.seq);
          } else {
            try {
              const msg = JSON.parse(event.data);
              if (!msg) return;

              // ── Control messages (type discriminant) ──────────────────────
              if (typeof msg.type === 'string') {
                switch (msg.type as string) {
                  case 'RELOAD_GRAPH':
                    // Server instructed a full resync (e.g. after REM rollback).
                    // Clear all local state; the consumer should fetch /api/graph/full.
                    console.info(
                      '[WebSocketClient] RELOAD_GRAPH received:',
                      msg.reason ?? '(no reason)'
                    );
                    this.store.loadFull([], []);
                    break;

                  case 'HEARTBEAT':
                    // Reset reconnection counter — connection is alive.
                    this.attempts = 0;
                    break;

                  case 'situation':
                    // Situational Modulator event — forward to situation listeners.
                    for (const listener of this.listeners) {
                      listener('open'); // keep status alive
                    }
                    // Dispatch as a custom DOM event so useSituationalModulator
                    // can pick it up without needing a direct reference to this client.
                    if (this.ws) {
                      const detail = new MessageEvent('message', { data: event.data });
                      // Re-dispatch already handled by useSituationalModulator via ws ref
                      void detail;
                    }
                    break;

                  case 'CDC':
                    this.handleCDCEvent(msg as CDCMessage);
                    return;

                  default:
                    break;
                }
                return; // Do not fall through to delta handling
              }

              // ── Delta message (nodes/edges) ───────────────────────────────
              if (msg.nodes || msg.edges) {
                this.store.applyDelta({
                  seq: this.seq,
                  timestamp: Date.now(),
                  nodes: msg.nodes || [],
                  edges: msg.edges || [],
                });
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      };

      ws.onerror = () => {
        this.setStatus('error');
      };

      ws.onclose = (event) => {
        if (event.code === 1000 || this.destroyed) {
          this.setStatus('closed');
          return;
        }
        this.setStatus('error');
        this.scheduleReconnect();
      };
    } catch (err) {
      console.warn('[WebSocketClient] Failed to create WebSocket:', err);
      this.setStatus('error');
      this.scheduleReconnect();
    }
  }

  private handleCDCEvent(msg: CDCMessage): void {
    this._cdcEventCount++;
    const { event_type, data } = msg;

    // Extract node_id from the CDC payload (varies by event type)
    const node_id: string | null =
      data?.id ?? data?.node_id ?? data?.source ?? null;

    // Map CDC events to store delta operations
    switch (event_type) {
      case 'InsertNode':
        this.store.applyDelta({
          seq: this.seq,
          timestamp: Date.now(),
          nodes: [{ op: 'born', id: node_id ?? data?.id ?? '', data }],
          edges: [],
        });
        break;

      case 'UpdateNode':
        this.store.applyDelta({
          seq: this.seq,
          timestamp: Date.now(),
          nodes: [{ op: 'changed', id: node_id ?? data?.id ?? '', data }],
          edges: [],
        });
        break;

      case 'DeleteNode':
        this.store.applyDelta({
          seq: this.seq,
          timestamp: Date.now(),
          nodes: [{ op: 'died', id: node_id ?? data?.id ?? '' }],
          edges: [],
        });
        break;

      case 'InsertEdge':
        this.store.applyDelta({
          seq: this.seq,
          timestamp: Date.now(),
          nodes: [],
          edges: [{
            op: 'born',
            source: data?.source ?? '',
            target: data?.target ?? '',
            data,
          }],
        });
        break;

      case 'DeleteEdge':
        this.store.applyDelta({
          seq: this.seq,
          timestamp: Date.now(),
          nodes: [],
          edges: [{
            op: 'died',
            source: data?.source ?? '',
            target: data?.target ?? '',
          }],
        });
        break;

      case 'SleepCycle':
      case 'Zaratustra':
      case 'Defibrillate':
        // Lifecycle events — no store mutation, just notify CDC subscribers
        break;
    }

    // Notify CDC subscribers for the event log
    const info: CDCEventInfo = { event_type, node_id, timestamp: Date.now() };
    for (const listener of this.cdcListeners) {
      listener(info);
    }
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    if (this.maxAttempts > 0 && this.attempts >= this.maxAttempts) {
      console.warn('[WebSocketClient] Max reconnect attempts reached.');
      this.setStatus('closed');
      return;
    }

    // Exponential backoff: delay = min(initialDelay * 2^attempts, maxDelay)
    const delay = Math.min(
      this.reconnectDelayMs * Math.pow(2, this.attempts),
      this.maxReconnectDelayMs
    );
    this.attempts++;

    console.log(`[WebSocketClient] Reconnecting in ${delay}ms (attempt ${this.attempts})...`);
    this.reconnectTimer = setTimeout(() => {
      if (!this.destroyed) this.createSocket();
    }, delay);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setStatus(status: WSStatus): void {
    if (this.status === status) return;
    this.status = status;
    for (const listener of this.listeners) {
      listener(status);
    }
  }
}
