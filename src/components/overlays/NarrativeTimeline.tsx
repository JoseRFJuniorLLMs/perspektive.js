/**
 * NarrativeTimeline.tsx — Graph evolution narrative arc visualization
 *
 * Renders a horizontal timeline bar showing narrative arcs detected by
 * NietzscheDB's Narrative Engine (NARRATE WINDOW N FORMAT json).
 */

import { useState, useMemo, useCallback } from 'react';

export type ArcType = 'emergence' | 'conflict' | 'decay' | 'recurrence' | 'synthesis';

export interface NarrativeArc {
  id: string;
  type: ArcType;
  start_time: number;
  end_time: number;
  description: string;
  node_ids: string[];
  intensity: number;
}

export interface NarrativeTimelineProps {
  arcs: NarrativeArc[];
  visible: boolean;
  windowHours: number;
  onArcClick?: (arc: NarrativeArc) => void;
  onArcHover?: (arc: NarrativeArc | null) => void;
}

const ARC_COLORS: Record<ArcType, string> = {
  emergence: '#00ff66',
  conflict: '#ff4444',
  decay: '#666666',
  recurrence: '#8b5cf6',
  synthesis: '#00f0ff',
};

const ARC_LABELS: Record<ArcType, string> = {
  emergence: 'EMERGENCE',
  conflict: 'CONFLICT',
  decay: 'DECAY',
  recurrence: 'RECURRENCE',
  synthesis: 'SYNTHESIS',
};

export const NarrativeTimeline = ({
  arcs,
  visible,
  windowHours,
  onArcClick,
  onArcHover,
}: NarrativeTimelineProps) => {
  const [hoveredArc, setHoveredArc] = useState<string | null>(null);

  const timeRange = useMemo(() => {
    const now = Date.now();
    const windowMs = windowHours * 3600 * 1000;
    return { start: now - windowMs, end: now };
  }, [windowHours]);

  const handleArcHover = useCallback((arc: NarrativeArc | null) => {
    setHoveredArc(arc?.id ?? null);
    onArcHover?.(arc);
  }, [onArcHover]);

  if (!visible || arcs.length === 0) return null;

  const totalWidth = timeRange.end - timeRange.start;

  return (
    <div style={{
      position: 'absolute',
      bottom: 80,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '70%',
      maxWidth: '800px',
      zIndex: 15,
      pointerEvents: 'auto',
    }}>
      {/* Title */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '4px',
      }}>
        <span style={{
          fontFamily: 'monospace',
          fontSize: '9px',
          color: '#94a3b8',
          letterSpacing: '0.1em',
        }}>
          NARRATIVE ARCS ({windowHours}h)
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(Object.keys(ARC_COLORS) as ArcType[]).map(type => (
            <span
              key={type}
              style={{
                fontFamily: 'monospace',
                fontSize: '8px',
                color: ARC_COLORS[type],
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: ARC_COLORS[type],
                display: 'inline-block',
              }} />
              {ARC_LABELS[type]}
            </span>
          ))}
        </div>
      </div>

      {/* Timeline bar */}
      <div style={{
        position: 'relative',
        height: '32px',
        background: 'rgba(0, 0, 0, 0.7)',
        border: '1px solid #334155',
        borderRadius: '4px',
        overflow: 'hidden',
        backdropFilter: 'blur(8px)',
      }}>
        {/* Time axis */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '1px',
          background: '#334155',
        }} />

        {/* Arc segments */}
        {arcs.map(arc => {
          const left = Math.max(0, ((arc.start_time - timeRange.start) / totalWidth) * 100);
          const right = Math.min(100, ((arc.end_time - timeRange.start) / totalWidth) * 100);
          const width = right - left;
          if (width <= 0) return null;

          const isHovered = hoveredArc === arc.id;

          return (
            <div
              key={arc.id}
              onClick={() => onArcClick?.(arc)}
              onMouseEnter={() => handleArcHover(arc)}
              onMouseLeave={() => handleArcHover(null)}
              style={{
                position: 'absolute',
                left: `${left}%`,
                width: `${width}%`,
                top: '4px',
                bottom: '4px',
                background: `${ARC_COLORS[arc.type]}${isHovered ? '40' : '20'}`,
                borderRadius: '2px',
                border: `1px solid ${ARC_COLORS[arc.type]}${isHovered ? '80' : '40'}`,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isHovered ? `0 0 8px ${ARC_COLORS[arc.type]}40` : 'none',
              }}
            />
          );
        })}

        {/* Tooltip */}
        {hoveredArc && (() => {
          const arc = arcs.find(a => a.id === hoveredArc);
          if (!arc) return null;
          const center = ((arc.start_time + arc.end_time) / 2 - timeRange.start) / totalWidth * 100;
          return (
            <div style={{
              position: 'absolute',
              left: `${Math.min(80, Math.max(20, center))}%`,
              transform: 'translateX(-50%)',
              bottom: '36px',
              background: 'rgba(2, 6, 23, 0.95)',
              border: `1px solid ${ARC_COLORS[arc.type]}`,
              color: '#e2e8f0',
              padding: '6px 10px',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: '9px',
              maxWidth: '250px',
              zIndex: 100,
              whiteSpace: 'pre-wrap',
              backdropFilter: 'blur(8px)',
              boxShadow: `0 0 12px ${ARC_COLORS[arc.type]}30`,
            }}>
              <div style={{ color: ARC_COLORS[arc.type], fontWeight: 'bold', marginBottom: '3px' }}>
                {ARC_LABELS[arc.type]}
              </div>
              <div style={{ color: '#94a3b8' }}>{arc.description}</div>
              <div style={{ color: '#64748b', marginTop: '3px' }}>
                {arc.node_ids.length} nodes | intensity: {(arc.intensity * 100).toFixed(0)}%
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
