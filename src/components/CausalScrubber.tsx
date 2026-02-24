/**
 * CausalScrubber.tsx — Vanguard Feature #1: Minkowski Time Machine
 *
 * A timeline slider that appears when the MINKOWSKI manifold is active.
 * Dragging it backwards "rewinds" the AGI mind, dissolving recent nodes
 * with a WebGL particle-dissolve shader and revealing the causal chain
 * that led to a specific conclusion or hallucination.
 *
 * Architecture:
 * - The scrubber fetches a sequence of causal snapshots from the backend
 *   (/causal_chain?collection=&from=&to=) or uses pre-loaded timestamped nodes
 * - Each snapshot is a subset of nodes visible at a given timestamp
 * - When the user scrubs backwards, nodes with timestamp > t are hidden
 * - DissolveParticles shader is applied to recently hidden nodes
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { NodeData } from './PerspektiveEngine';

// ==========================================
// TYPES
// ==========================================

export interface CausalSnapshot {
  timestamp: number;
  /** IDs of nodes visible at this timestamp */
  visibleIds: Set<string>;
  label?: string;
}

export interface CausalScrubberProps {
  /** All nodes with their timestamps */
  nodes: NodeData[];
  /** Whether the Minkowski manifold is currently active */
  visible: boolean;
  /** Callback: set which node IDs should be visible */
  onTimeChange: (visibleIds: Set<string>, timestamp: number) => void;
  /** API endpoint to fetch causal chain (optional) */
  causalChainEndpoint?: string;
  /** Collection name for API requests */
  collection?: string;
  /** Pre-loaded snapshots (if not using API) */
  snapshots?: CausalSnapshot[];
}

// ==========================================
// HELPERS
// ==========================================

function buildSnapshotsFromNodes(nodes: NodeData[]): CausalSnapshot[] {
  // Extract unique timestamps from nodes (using energy as a proxy for time
  // if no explicit timestamp field is available)
  const timestamped = nodes
    .filter(n => typeof (n as any).timestamp === 'number' || typeof n.energy === 'number')
    .sort((a, b) => {
      const ta = (a as any).timestamp ?? a.energy;
      const tb = (b as any).timestamp ?? b.energy;
      return ta - tb;
    });

  if (timestamped.length === 0) return [];

  const minT = (timestamped[0] as any).timestamp ?? timestamped[0].energy;
  const maxT = (timestamped[timestamped.length - 1] as any).timestamp ?? timestamped[timestamped.length - 1].energy;

  // Create 20 evenly spaced snapshots
  const numSteps = 20;
  const snapshots: CausalSnapshot[] = [];

  for (let i = 0; i <= numSteps; i++) {
    const t = minT + (maxT - minT) * (i / numSteps);
    const visibleIds = new Set<string>(
      nodes
        .filter(n => {
          const nt = (n as any).timestamp ?? n.energy;
          return nt <= t;
        })
        .map(n => n.id)
    );
    snapshots.push({
      timestamp: t,
      visibleIds,
      label: i === 0 ? 'ORIGIN' : i === numSteps ? 'NOW' : undefined,
    });
  }

  return snapshots;
}

// ==========================================
// DISSOLVE PARTICLE CANVAS (CSS-only version)
// ==========================================
// Note: Full WebGL dissolve shader lives in BlochMaterial.ts for P2.
// Here we use a CSS keyframe dissolve as a lightweight stub.

// ==========================================
// MAIN COMPONENT
// ==========================================

export const CausalScrubber: React.FC<CausalScrubberProps> = ({
  nodes,
  visible,
  onTimeChange,
  causalChainEndpoint,
  collection = 'default',
  snapshots: propSnapshots,
}) => {
  const [snapshots, setSnapshots] = useState<CausalSnapshot[]>(propSnapshots ?? []);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isRewinding, setIsRewinding] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLInputElement>(null);

  // Build snapshots from nodes if no API or pre-loaded snapshots
  useEffect(() => {
    if (propSnapshots && propSnapshots.length > 0) {
      setSnapshots(propSnapshots);
      setCurrentIndex(propSnapshots.length - 1);
      return;
    }

    if (causalChainEndpoint && collection) {
      // Fetch causal chain from API
      const url = new URL(causalChainEndpoint);
      url.searchParams.set('collection', collection);
      fetch(url.toString())
        .then(r => r.json())
        .then((data: CausalSnapshot[]) => {
          if (data && data.length > 0) {
            // Reconstruct Set<string> from serialized arrays
            const restored = data.map(s => ({
              ...s,
              visibleIds: new Set<string>(Array.isArray(s.visibleIds) ? (s.visibleIds as unknown as string[]) : []),
            }));
            setSnapshots(restored);
            setCurrentIndex(restored.length - 1);
          }
        })
        .catch(() => {
          // Fallback to node-based snapshots
          const built = buildSnapshotsFromNodes(nodes);
          setSnapshots(built);
          setCurrentIndex(built.length - 1);
        });
    } else {
      const built = buildSnapshotsFromNodes(nodes);
      setSnapshots(built);
      setCurrentIndex(built.length - 1);
    }
  }, [nodes, causalChainEndpoint, collection, propSnapshots]);

  const handleChange = useCallback(
    (idx: number) => {
      setCurrentIndex(idx);
      if (snapshots[idx]) {
        const isRewind = idx < snapshots.length - 1;
        setIsRewinding(isRewind);
        onTimeChange(snapshots[idx].visibleIds, snapshots[idx].timestamp);
      }
    },
    [snapshots, onTimeChange]
  );

  useEffect(() => {
    if (!isDragging && isRewinding) {
      const timer = setTimeout(() => setIsRewinding(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [isDragging, isRewinding]);

  if (!visible || snapshots.length === 0) return null;

  const current = snapshots[currentIndex];
  const progress = snapshots.length > 1 ? currentIndex / (snapshots.length - 1) : 1;
  const isAtPresent = currentIndex === snapshots.length - 1;

  return (
    <div style={{
      position: 'absolute',
      bottom: 80,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'clamp(300px, 60vw, 700px)',
      background: 'rgba(0,0,0,0.85)',
      border: `1px solid ${isRewinding ? '#ff6600' : '#334155'}`,
      borderRadius: 12,
      padding: '12px 20px',
      backdropFilter: 'blur(16px)',
      zIndex: 20,
      fontFamily: 'monospace',
      transition: 'border-color 0.3s ease',
      boxShadow: isRewinding ? '0 0 20px rgba(255,100,0,0.3)' : 'none',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ color: '#ff6600', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 }}>
          ⏳ CAUSAL SCRUBBER — MINKOWSKI TIME AXIS
        </span>
        <span style={{
          color: isAtPresent ? '#00ff66' : '#ff6600',
          fontSize: 11,
          padding: '2px 8px',
          border: `1px solid ${isAtPresent ? '#00ff66' : '#ff6600'}`,
          borderRadius: 4,
        }}>
          {isAtPresent ? 'NOW' : `T-${snapshots.length - 1 - currentIndex}`}
        </span>
      </div>

      {/* Slider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: '#ff6600', fontSize: 10 }}>PAST</span>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            ref={sliderRef}
            type="range"
            min={0}
            max={snapshots.length - 1}
            value={currentIndex}
            onChange={e => handleChange(Number(e.target.value))}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            onTouchStart={() => setIsDragging(true)}
            onTouchEnd={() => setIsDragging(false)}
            style={{
              width: '100%',
              appearance: 'none',
              height: 4,
              background: `linear-gradient(to right, #ff6600 ${progress * 100}%, #334155 ${progress * 100}%)`,
              borderRadius: 2,
              outline: 'none',
              cursor: 'pointer',
            }}
          />
          {/* Snapshot tick marks */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            {snapshots.map((s, i) => (
              s.label ? (
                <span key={i} style={{ color: '#555', fontSize: 8 }}>{s.label}</span>
              ) : null
            ))}
          </div>
        </div>
        <span style={{ color: '#00ff66', fontSize: 10 }}>NOW</span>
      </div>

      {/* Info */}
      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', color: '#555', fontSize: 10 }}>
        <span>🧠 NODES VISIBLE: {current?.visibleIds.size ?? 0}</span>
        {isRewinding && (
          <span style={{ color: '#ff6600', animation: 'pulse 0.5s ease infinite' }}>
            ◀ REWINDING CAUSALITY...
          </span>
        )}
        <span>TIMESTAMP: {current?.timestamp.toFixed(3) ?? '—'}</span>
      </div>
    </div>
  );
};

export default CausalScrubber;
