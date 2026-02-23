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
  private seq = 0;

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
  }

  getStatus(): WSStatus {
    return this.status;
  }

  subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
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
              const delta = JSON.parse(event.data);
              if (delta && (delta.nodes || delta.edges)) {
                this.store.applyDelta({
                  seq: this.seq,
                  timestamp: Date.now(),
                  nodes: delta.nodes || [],
                  edges: delta.edges || [],
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
