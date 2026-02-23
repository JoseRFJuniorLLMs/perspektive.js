/**
 * interaction/BoxSelectOverlay.tsx — Visual box selection rectangle overlay
 *
 * Renders a translucent cyan rectangle with dashed border during box selection.
 * This is an HTML overlay positioned absolutely over the R3F canvas.
 * Only visible when a box selection operation is active (boxSelect != null).
 *
 * Style:
 *   background: rgba(0, 240, 255, 0.1)
 *   border: 1px dashed #00f0ff
 *   Subtle glow shadow for cyberpunk aesthetic
 */

import { useMemo } from 'react';
import { useSelection } from './useSelection';

// ==========================================
// STYLES
// ==========================================

const OVERLAY_STYLES = {
  /** The full-screen container that catches pointer events during box select */
  container: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 9999,
    pointerEvents: 'none' as const,
  },
  /** The selection rectangle itself */
  rect: {
    position: 'absolute' as const,
    background: 'rgba(0, 240, 255, 0.08)',
    border: '1px dashed #00f0ff',
    boxShadow: '0 0 12px rgba(0, 240, 255, 0.2), inset 0 0 12px rgba(0, 240, 255, 0.05)',
    pointerEvents: 'none' as const,
    // Subtle animation for the dashed border
    backgroundImage:
      'linear-gradient(135deg, rgba(0, 240, 255, 0.03) 25%, transparent 25%, transparent 50%, rgba(0, 240, 255, 0.03) 50%, rgba(0, 240, 255, 0.03) 75%, transparent 75%, transparent)',
    backgroundSize: '20px 20px',
  },
  /** Corner indicators for visual feedback */
  corner: {
    position: 'absolute' as const,
    width: 6,
    height: 6,
    background: '#00f0ff',
    boxShadow: '0 0 6px #00f0ff',
  },
  /** Size indicator label */
  sizeLabel: {
    position: 'absolute' as const,
    bottom: -20,
    right: 0,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: 10,
    color: '#00f0ff',
    textShadow: '0 0 4px rgba(0, 240, 255, 0.5)',
    whiteSpace: 'nowrap' as const,
    pointerEvents: 'none' as const,
  },
} as const;

// ==========================================
// COMPONENT
// ==========================================

export const BoxSelectOverlay = () => {
  const boxSelect = useSelection((s) => s.boxSelect);

  // Compute the rectangle dimensions from the two corner points
  const rectStyle = useMemo(() => {
    if (!boxSelect) return null;

    const { start, end } = boxSelect;
    const left = Math.min(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);

    return { left, top, width, height };
  }, [boxSelect]);

  if (!boxSelect || !rectStyle) return null;

  const { left, top, width, height } = rectStyle;

  return (
    <div style={OVERLAY_STYLES.container}>
      <div
        style={{
          ...OVERLAY_STYLES.rect,
          left,
          top,
          width,
          height,
        }}
      >
        {/* Corner indicators */}
        <div style={{ ...OVERLAY_STYLES.corner, top: -3, left: -3 }} />
        <div style={{ ...OVERLAY_STYLES.corner, top: -3, right: -3 }} />
        <div style={{ ...OVERLAY_STYLES.corner, bottom: -3, left: -3 }} />
        <div style={{ ...OVERLAY_STYLES.corner, bottom: -3, right: -3 }} />

        {/* Size indicator */}
        {width > 30 && height > 20 && (
          <div style={OVERLAY_STYLES.sizeLabel}>
            {Math.round(width)} x {Math.round(height)}
          </div>
        )}
      </div>
    </div>
  );
};
