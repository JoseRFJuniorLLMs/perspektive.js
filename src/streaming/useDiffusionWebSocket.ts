/**
 * useDiffusionWebSocket.ts — Pilar 4: Respiração da Difusão Térmica (Live Pregel)
 *
 * Hook que conecta ao endpoint WebSocket de diffusion do NietzscheDB,
 * recebe `diffusion_step` events em tempo real e "acende" nós progressivamente
 * conforme o algoritmo Chebyshev os atinge no backend.
 *
 * Fluxo:
 * 1. Conecta ao WS: ws://host/diffusion?collection=&seed=
 * 2. Recebe eventos: { type: "diffusion_step", nodeId: "...", energy: 0.7, step: 3 }
 * 3. Aplica update incremental de energia no GraphStore via applyDelta()
 * 4. O DiffusionHeatmap reage automaticamente via useSyncExternalStore
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import type { GraphStore } from './GraphStore';

// ==========================================
// TYPES
// ==========================================

export interface DiffusionStep {
  type: 'diffusion_step' | 'diffusion_complete' | 'diffusion_start';
  nodeId: string;
  energy: number;
  step: number;
  timestamp?: number;
}

export interface UseDiffusionWebSocketOptions {
  /** WebSocket URL. e.g. ws://localhost:7777/diffusion */
  url: string;
  /** The GraphStore to update with energy changes */
  store: GraphStore;
  /** Collection to diffuse in */
  collection?: string;
  /** Seed node ID */
  seedNodeId?: string;
  /** Whether to auto-connect on mount */
  autoConnect?: boolean;
  /** Callback fired on each diffusion step */
  onStep?: (step: DiffusionStep) => void;
  /** Callback fired when diffusion completes */
  onComplete?: () => void;
}

export interface DiffusionWebSocketState {
  isRunning: boolean;
  isConnected: boolean;
  currentStep: number;
  stepsHistory: DiffusionStep[];
  /** Start diffusion from a given seed node */
  startDiffusion: (seedNodeId: string) => void;
  /** Stop and disconnect */
  stop: () => void;
}

// ==========================================
// HOOK
// ==========================================

export function useDiffusionWebSocket({
  url,
  store,
  collection = 'default',
  seedNodeId,
  autoConnect = false,
  onStep,
  onComplete,
}: UseDiffusionWebSocketOptions): DiffusionWebSocketState {
  const wsRef = useRef<WebSocket | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepsHistory, setStepsHistory] = useState<DiffusionStep[]>([]);
  const stepsHistoryRef = useRef<DiffusionStep[]>([]);

  const stop = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsRunning(false);
    setIsConnected(false);
    setCurrentStep(0);
  }, []);

  const startDiffusion = useCallback(
    (seed: string) => {
      stop();
      stepsHistoryRef.current = [];
      setStepsHistory([]);
      setCurrentStep(0);

      const wsUrl = new URL(url);
      wsUrl.searchParams.set('collection', collection);
      wsUrl.searchParams.set('seed', seed);

      const ws = new WebSocket(wsUrl.toString());
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsRunning(true);
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const data: DiffusionStep = JSON.parse(event.data as string);

          if (data.type === 'diffusion_complete') {
            setIsRunning(false);
            onComplete?.();
            return;
          }

          if (data.type === 'diffusion_step') {
            // Update the node energy in the GraphStore via a changed delta
            store.applyDelta({
              seq: Date.now(),
              timestamp: Date.now(),
              nodes: [{
                op: 'changed',
                id: data.nodeId,
                data: { energy: data.energy } as any,
              }],
              edges: [],
            });

            stepsHistoryRef.current = [...stepsHistoryRef.current, data];
            setStepsHistory([...stepsHistoryRef.current]);
            setCurrentStep(data.step);
            onStep?.(data);
          }
        } catch (e) {
          // Not JSON — may be binary, ignore
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
        setIsRunning(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsRunning(false);
      };
    },
    [url, collection, store, onStep, onComplete, stop]
  );

  // Auto-connect with seedNodeId if provided
  useEffect(() => {
    if (autoConnect && seedNodeId) {
      startDiffusion(seedNodeId);
    }
    return () => stop();
  }, [autoConnect, seedNodeId, startDiffusion, stop]);

  return {
    isRunning,
    isConnected,
    currentStep,
    stepsHistory,
    startDiffusion,
    stop,
  };
}
