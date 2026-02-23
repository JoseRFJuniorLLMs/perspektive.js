/**
 * useWebSocket.ts — React hook for the WebSocketClient
 *
 * Manages lifecycle, status subscription, and cleanup automatically.
 *
 * @example
 * ```tsx
 * const { status } = useWebSocket({ url: 'ws://localhost:8080/ws', store });
 * ```
 */

import { useEffect, useRef, useState } from 'react';
import { WebSocketClient, type WSStatus } from './WebSocketClient';
import type { GraphStore } from './GraphStore';

export interface UseWebSocketOptions {
  url: string;
  store: GraphStore;
  /** Auto-connect on mount. Default: true */
  autoConnect?: boolean;
}

export interface UseWebSocketReturn {
  status: WSStatus;
  connect: () => void;
  disconnect: () => void;
}

export function useWebSocket({
  url,
  store,
  autoConnect = true,
}: UseWebSocketOptions): UseWebSocketReturn {
  const [status, setStatus] = useState<WSStatus>('closed');
  const clientRef = useRef<WebSocketClient | null>(null);

  useEffect(() => {
    const client = new WebSocketClient({ url, store });
    clientRef.current = client;

    const unsub = client.subscribe(setStatus);

    if (autoConnect) client.connect();

    return () => {
      unsub();
      client.destroy();
    };
  }, [url, store, autoConnect]);

  return {
    status,
    connect: () => clientRef.current?.connect(),
    disconnect: () => clientRef.current?.disconnect(),
  };
}
