/**
 * useSituationalModulator.ts — Situational Modulator Hook
 *
 * Subscribes to a WebSocket stream for `situation` events emitted by the
 * NietzscheDB agency engine (EVA-X clinical crisis detector). Returns computed
 * rendering parameters that drive dynamic visualization:
 *
 *   - `conformalScale`: multiplier for the hyperbolic conformal factor λ(z).
 *     1.0 = normal; >1.0 = space deformation toward critical zone.
 *     Passed as `uConformalScale` uniform to GeodesicEdgeShader.
 *
 *   - `autoZoomTarget`: Poincaré disk coordinates [x, y] to animate the
 *     camera toward during a crisis. null = no auto-zoom.
 *
 *   - `crisisLevel`: raw [0, 1] value from the agency engine. Used to
 *     interpolate Bloom intensity in PoincareView.
 *
 *   - `poincareDepth`: the Poincaré depth (hyperbolic distance from origin)
 *     of the current crisis zone. Used for zone highlighting.
 *
 * ## Wire Format
 *
 * The NietzscheDB backend emits a JSON WebSocket message:
 * ```json
 * {
 *   "type": "situation",
 *   "crisis_level": 0.85,
 *   "poincare_depth": 0.62,
 *   "focus_x": -0.33,
 *   "focus_y": 0.71,
 *   "reason": "tumor_detected"
 * }
 * ```
 *
 * @module interaction/useSituationalModulator
 */

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Raw situation message from the NietzscheDB WebSocket stream. */
export interface SituationMessage {
  type: "situation";
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

/** Derived rendering parameters for PoincareView. */
export interface SituationalModulatorState {
  /**
   * Conformal scale for the GeodesicEdgeShader uniform `uConformalScale`.
   * Smoothly interpolated from 1.0 (calm) toward 2.5 (critical).
   */
  conformalScale: number;
  /**
   * Target coordinates for camera auto-zoom. null when calm.
   */
  autoZoomTarget: [number, number] | null;
  /**
   * Raw crisis level [0, 1], useful for Bloom intensity interpolation.
   */
  crisisLevel: number;
  /**
   * Poincaré depth of the crisis zone [0, 1).
   */
  poincareDepth: number;
  /**
   * Human-readable reason for the current crisis (for debugging/UI).
   */
  reason: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Conformal scale at maximum crisis. */
const MAX_CONFORMAL_SCALE = 2.5;

/**
 * Exponential smoothing factor for conformal scale transitions.
 * Smaller = smoother (slower); larger = more responsive.
 */
const SMOOTH_ALPHA = 0.08;

/**
 * Crisis cooldown: if no new situation message arrives within this time (ms),
 * the crisis level decays back toward 0.
 */
const CRISIS_DECAY_INTERVAL_MS = 2_000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Subscribe to the NietzscheDB WebSocket situation stream.
 *
 * @param wsRef - A ref to an existing WebSocket connection (shared with WebSocketClient).
 *                If null, the hook is a no-op.
 * @returns Current situational modulator state.
 *
 * @example
 * ```tsx
 * const { conformalScale, crisisLevel, autoZoomTarget } = useSituationalModulator(wsRef);
 * ```
 */
export function useSituationalModulator(
  wsRef: React.RefObject<WebSocket | null>,
): SituationalModulatorState {
  const [state, setState] = useState<SituationalModulatorState>({
    conformalScale: 1.0,
    autoZoomTarget: null,
    crisisLevel: 0,
    poincareDepth: 0,
    reason: null,
  });

  // Smoothed conformal scale (interpolated over frames)
  const targetConformalRef = useRef(1.0);
  const currentConformalRef = useRef(1.0);
  const lastSituationRef = useRef<number>(Date.now());
  const rafRef = useRef<number>(0);
  const latestCrisisRef = useRef(0);

  // RAF loop for smooth conformal scale animation
  useEffect(() => {
    const animate = () => {
      const now = Date.now();
      const msSinceLastSituation = now - lastSituationRef.current;

      // Decay crisis level if no recent signals
      if (msSinceLastSituation > CRISIS_DECAY_INTERVAL_MS) {
        const decayFactor = Math.max(
          0,
          latestCrisisRef.current -
            0.01 * (msSinceLastSituation / CRISIS_DECAY_INTERVAL_MS),
        );
        latestCrisisRef.current = decayFactor;
        targetConformalRef.current =
          1.0 + decayFactor * (MAX_CONFORMAL_SCALE - 1.0);
      }

      // Smooth interpolation toward target
      const prev = currentConformalRef.current;
      const next = prev + SMOOTH_ALPHA * (targetConformalRef.current - prev);

      if (Math.abs(next - prev) > 0.0001) {
        currentConformalRef.current = next;
        setState((s) => ({
          ...s,
          conformalScale: next,
          crisisLevel: latestCrisisRef.current,
        }));
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // WebSocket message listener
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;

    const handler = (event: MessageEvent) => {
      // Ignore binary FlatBuffer frames
      if (event.data instanceof ArrayBuffer) return;
      if (typeof event.data !== "string") return;

      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }

      if (!isSituationMessage(parsed)) return;

      const msg = parsed as SituationMessage;
      lastSituationRef.current = Date.now();
      latestCrisisRef.current = clamp01(msg.crisis_level);

      // Target conformal scale: maps crisis 0→1  to conformalScale 1.0→MAX_CONFORMAL_SCALE
      targetConformalRef.current =
        1.0 + latestCrisisRef.current * (MAX_CONFORMAL_SCALE - 1.0);

      // Update zoom target and reason immediately (no smoothing needed)
      const autoZoomTarget: [number, number] | null =
        msg.crisis_level > 0.3
          ? [clampDisk(msg.focus_x), clampDisk(msg.focus_y)]
          : null;

      setState((s) => ({
        ...s,
        autoZoomTarget,
        poincareDepth: clamp01(msg.poincare_depth),
        reason: msg.reason ?? null,
      }));
    };

    ws.addEventListener("message", handler);
    return () => ws.removeEventListener("message", handler);
  }, [wsRef]);

  return state;
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

function isSituationMessage(value: unknown): value is SituationMessage {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v["type"] === "situation" &&
    typeof v["crisis_level"] === "number" &&
    typeof v["poincare_depth"] === "number" &&
    typeof v["focus_x"] === "number" &&
    typeof v["focus_y"] === "number"
  );
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function clampDisk(v: number): number {
  return Math.max(-0.99, Math.min(0.99, v));
}
