/**
 * search/FilterPanel.tsx — Interactive filter controls (cyberpunk themed)
 *
 * Positioned below the search bar in the HTML overlay layer.
 * Features:
 * - Node Type Chips: clickable, show count, color-coded per type
 * - Energy Slider: dual-thumb range slider [0, 1]
 * - Reset All button
 * - Collapsible panel with toggle button
 *
 * This component lives in the HTML overlay layer (not inside the R3F Canvas).
 */

import { useState, useMemo, useCallback } from 'react';
import { useFilter } from './useFilter';

// ==========================================
// CONSTANTS
// ==========================================

/** Color map for known node types (matches PerspektiveEngine palette). */
const TYPE_COLORS: Record<string, string> = {
  Episodic: '#00f0ff',
  Concept: '#f59e0b',
  DreamSnapshot: '#8b5cf6',
  Pruned: '#1e293b',
};

/** Default color for unknown node types. */
const DEFAULT_TYPE_COLOR = '#00ff66';

/** Get the neon color for a given node type. */
function getTypeColor(nodeType: string): string {
  return TYPE_COLORS[nodeType] ?? DEFAULT_TYPE_COLOR;
}

// ==========================================
// PROPS
// ==========================================

export interface FilterPanelProps {
  /** Initial collapsed state. Default: true (collapsed). */
  defaultCollapsed?: boolean;
}

// ==========================================
// SUB-COMPONENTS
// ==========================================

/**
 * A clickable chip for a node type. Active = filled with type color,
 * inactive = outlined gray.
 */
const TypeChip = ({
  nodeType,
  count,
  active,
  onClick,
}: {
  nodeType: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) => {
  const color = getTypeColor(nodeType);

  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    borderRadius: 3,
    fontFamily: 'monospace',
    fontSize: 11,
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'all 0.15s ease',
    border: `1px solid ${active ? color : '#334155'}`,
    background: active ? color : 'transparent',
    color: active ? '#000' : '#94a3b8',
    fontWeight: active ? 700 : 400,
    textShadow: active ? 'none' : `0 0 4px ${color}40`,
  };

  return (
    <button onClick={onClick} style={style}>
      {nodeType}
      <span style={{
        fontSize: 10,
        opacity: 0.7,
        fontWeight: 400,
      }}>
        ({count})
      </span>
    </button>
  );
};

/**
 * Dual-thumb range slider for energy filtering.
 * Uses two native range inputs overlaid on a styled track.
 */
const EnergySlider = ({
  min,
  max,
  onMinChange,
  onMaxChange,
}: {
  min: number;
  max: number;
  onMinChange: (v: number) => void;
  onMaxChange: (v: number) => void;
}) => {
  const trackFill = {
    left: `${min * 100}%`,
    width: `${(max - min) * 100}%`,
  };

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: 'monospace',
        fontSize: 10,
        color: '#64748b',
        marginBottom: 4,
      }}>
        <span>ENERGY RANGE</span>
        <span style={{ color: '#00f0ff' }}>
          [{min.toFixed(2)} - {max.toFixed(2)}]
        </span>
      </div>

      {/* Track container */}
      <div style={{
        position: 'relative',
        height: 20,
        width: '100%',
      }}>
        {/* Background track */}
        <div style={{
          position: 'absolute',
          top: 8,
          left: 0,
          right: 0,
          height: 4,
          background: '#1e293b',
          borderRadius: 2,
        }} />

        {/* Active range highlight */}
        <div style={{
          position: 'absolute',
          top: 8,
          left: trackFill.left,
          width: trackFill.width,
          height: 4,
          background: '#00f0ff',
          borderRadius: 2,
          boxShadow: '0 0 6px rgba(0,240,255,0.5)',
        }} />

        {/* Min thumb */}
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={min}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (v <= max - 0.01) onMinChange(v);
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: 20,
            appearance: 'none',
            WebkitAppearance: 'none',
            background: 'transparent',
            pointerEvents: 'none',
            zIndex: 2,
            cursor: 'pointer',
            // Thumb styling via inline className workaround not possible;
            // we rely on the browser default thumb with transparent track.
          }}
          className="perspektive-range-thumb"
        />

        {/* Max thumb */}
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={max}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (v >= min + 0.01) onMaxChange(v);
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: 20,
            appearance: 'none',
            WebkitAppearance: 'none',
            background: 'transparent',
            pointerEvents: 'none',
            zIndex: 3,
            cursor: 'pointer',
          }}
          className="perspektive-range-thumb"
        />
      </div>

      {/* Inject minimal CSS for range thumb pointer-events */}
      <style>{`
        .perspektive-range-thumb::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #00f0ff;
          border: 2px solid #020617;
          cursor: pointer;
          pointer-events: all;
          box-shadow: 0 0 6px rgba(0,240,255,0.6);
          margin-top: -1px;
        }
        .perspektive-range-thumb::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #00f0ff;
          border: 2px solid #020617;
          cursor: pointer;
          pointer-events: all;
          box-shadow: 0 0 6px rgba(0,240,255,0.6);
        }
        .perspektive-range-thumb::-webkit-slider-runnable-track {
          background: transparent;
        }
        .perspektive-range-thumb::-moz-range-track {
          background: transparent;
        }
      `}</style>
    </div>
  );
};

// ==========================================
// MAIN COMPONENT
// ==========================================

/**
 * Collapsible filter panel with node type chips, energy range slider,
 * and a reset button. Cyberpunk styled.
 */
export const FilterPanel = ({ defaultCollapsed = true }: FilterPanelProps) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [energyMin, setEnergyMin] = useState(0);
  const [energyMax, setEnergyMax] = useState(1);

  const {
    criteria,
    _nodes,
    setNodeTypeFilter,
    setEnergyRange,
    resetFilters,
    isActive,
  } = useFilter();

  // --- Compute type counts from the full node list ---
  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const node of _nodes) {
      counts.set(node.node_type, (counts.get(node.node_type) ?? 0) + 1);
    }
    // Sort by count descending
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [_nodes]);

  const activeTypes = criteria.nodeTypes ?? [];

  // --- Handlers ---

  const handleToggleType = useCallback(
    (type: string) => {
      const current = new Set(activeTypes);
      if (current.has(type)) {
        current.delete(type);
      } else {
        current.add(type);
      }
      setNodeTypeFilter([...current]);
    },
    [activeTypes, setNodeTypeFilter],
  );

  const handleEnergyMinChange = useCallback(
    (v: number) => {
      setEnergyMin(v);
      setEnergyRange(v, energyMax);
    },
    [energyMax, setEnergyRange],
  );

  const handleEnergyMaxChange = useCallback(
    (v: number) => {
      setEnergyMax(v);
      setEnergyRange(energyMin, v);
    },
    [energyMin, setEnergyRange],
  );

  const handleReset = useCallback(() => {
    setEnergyMin(0);
    setEnergyMax(1);
    resetFilters();
  }, [resetFilters]);

  // --- Panel toggle ---
  const toggleLabel = collapsed ? 'FILTERS \u25BC' : 'FILTERS \u25B2';

  return (
    <div style={{
      position: 'absolute',
      top: 158,
      left: 20,
      zIndex: 100,
      fontFamily: 'monospace',
    }}>
      {/* Toggle button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          background: 'rgba(0,0,0,0.7)',
          border: `1px solid ${isActive ? '#00f0ff' : '#334155'}`,
          color: isActive ? '#00f0ff' : '#64748b',
          fontFamily: 'monospace',
          fontSize: 11,
          padding: '4px 12px',
          borderRadius: 3,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: isActive ? '0 0 8px rgba(0,240,255,0.2)' : 'none',
        }}
      >
        {toggleLabel}
        {isActive && (
          <span style={{ marginLeft: 6, color: '#ff00ff', fontSize: 10 }}>ACTIVE</span>
        )}
      </button>

      {/* Panel body */}
      {!collapsed && (
        <div style={{
          marginTop: 6,
          background: 'rgba(2,6,23,0.85)',
          border: '1px solid #334155',
          borderRadius: 4,
          padding: 12,
          width: 310,
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}>
          {/* Node Type Chips */}
          {typeCounts.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{
                fontSize: 10,
                color: '#64748b',
                marginBottom: 6,
                letterSpacing: 1,
              }}>
                NODE TYPES
              </div>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
              }}>
                {typeCounts.map(([type, count]) => (
                  <TypeChip
                    key={type}
                    nodeType={type}
                    count={count}
                    active={activeTypes.includes(type)}
                    onClick={() => handleToggleType(type)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Energy Range Slider */}
          <EnergySlider
            min={energyMin}
            max={energyMax}
            onMinChange={handleEnergyMinChange}
            onMaxChange={handleEnergyMaxChange}
          />

          {/* Reset All */}
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <button
              onClick={handleReset}
              disabled={!isActive}
              style={{
                background: 'transparent',
                border: `1px solid ${isActive ? '#ef4444' : '#334155'}`,
                color: isActive ? '#ef4444' : '#334155',
                fontFamily: 'monospace',
                fontSize: 11,
                padding: '4px 12px',
                borderRadius: 3,
                cursor: isActive ? 'pointer' : 'default',
                transition: 'all 0.15s ease',
                opacity: isActive ? 1 : 0.4,
              }}
            >
              RESET ALL
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
