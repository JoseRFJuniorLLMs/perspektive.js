/**
 * search/NodeLabels.tsx — WebGL text labels for graph nodes (R3F component)
 *
 * Uses `<Text>` from `@react-three/drei` for high-performance SDF font rendering.
 * This component renders inside the R3F `<Canvas>`.
 *
 * Features:
 * - Renders labels for the top N nodes by energy (configurable)
 * - When search/filter is active, labels matched nodes (up to maxLabels)
 * - When selection is active, labels selected nodes
 * - Labels billboard toward camera in 3D modes (Riemann, Minkowski)
 * - Positioned slightly below each node for readability
 * - fontSize scales inversely with camera zoom for consistent screen size
 * - Memoized: only re-renders when relevant data changes
 */

import { useMemo } from 'react';
import { Text } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useFilter } from './useFilter';
import { useSelection } from '../interaction/useSelection';
import type { LabelConfig } from './types';
import type { NodeData, ManifoldType } from '../components/PerspektiveEngine';

// ==========================================
// PROPS
// ==========================================

export interface NodeLabelsProps {
  /** The full list of graph nodes with projected positions. */
  nodes: NodeData[];
  /** Current manifold (affects billboard behavior). */
  manifold: ManifoldType;
  /** Label configuration. */
  config?: Partial<LabelConfig>;
}

// ==========================================
// DEFAULTS
// ==========================================

const DEFAULT_CONFIG: LabelConfig = {
  show: true,
  maxLabels: 20,
  fontSize: 0.025,
  property: 'node_type',
  filter: 'all',
  eliteThreshold: 0.8,
};

// ==========================================
// COMPONENT
// ==========================================

/**
 * Renders SDF text labels in the WebGL scene positioned near graph nodes.
 * Must be placed inside the R3F `<Canvas>` tree.
 *
 * @example
 * ```tsx
 * <Canvas>
 *   <NodeLabels
 *     nodes={graphData.nodes}
 *     manifold="POINCARE"
 *     config={{ show: true, maxLabels: 30, property: 'id' }}
 *   />
 * </Canvas>
 * ```
 */
export const NodeLabels = ({ nodes, manifold, config }: NodeLabelsProps) => {
  const cfg: LabelConfig = { ...DEFAULT_CONFIG, ...config };

  const { matchedIds, isActive: filterActive } = useFilter();
  const selectedIds = useSelection((s) => s.selectedIds);

  // Access camera for zoom-based font scaling
  const camera = useThree((s) => s.camera);

  // Determine if we are in a 3D mode (labels should billboard)
  const is3D = manifold === 'RIEMANN' || manifold === 'MINKOWSKI';

  // Y offset to position label below the node
  const yOffset = is3D ? -0.04 : -0.03;

  // --- Select which nodes get labels ---
  const labeledNodes = useMemo(() => {
    if (!cfg.show) return [];

    let candidates: NodeData[];

    // Determine candidate pool based on filter mode
    const hasSelection = selectedIds.size > 0;
    const hasSearch = filterActive;

    // Priority: selection > search > config.filter
    if (hasSelection) {
      candidates = nodes.filter((n) => selectedIds.has(n.id));
    } else if (hasSearch) {
      candidates = nodes.filter((n) => matchedIds.has(n.id));
    } else {
      switch (cfg.filter) {
        case 'elite':
          candidates = nodes.filter((n) => n.energy >= cfg.eliteThreshold);
          break;
        case 'selected':
          candidates = nodes.filter((n) => selectedIds.has(n.id));
          break;
        case 'searched':
          candidates = filterActive
            ? nodes.filter((n) => matchedIds.has(n.id))
            : [];
          break;
        case 'all':
        default:
          candidates = [...nodes];
          break;
      }
    }

    // Sort by energy descending and cap at maxLabels
    candidates.sort((a, b) => b.energy - a.energy);
    return candidates.slice(0, cfg.maxLabels);
  }, [nodes, cfg.show, cfg.filter, cfg.maxLabels, cfg.eliteThreshold, matchedIds, filterActive, selectedIds]);

  // --- Compute font size scaled by camera zoom ---
  // For orthographic cameras, `zoom` directly correlates with magnification.
  // For perspective cameras in 3D modes, we use a fixed size.
  const scaledFontSize = useMemo(() => {
    if ('zoom' in camera && !is3D) {
      // Orthographic: scale inversely so labels stay readable at any zoom level
      const orthoZoom = Math.max((camera as any).zoom, 50);
      return cfg.fontSize * (300 / orthoZoom);
    }
    // Perspective (3D modes): use base fontSize
    return cfg.fontSize;
  }, [camera, cfg.fontSize, is3D]);

  if (!cfg.show || labeledNodes.length === 0) return null;

  // --- Get the text value from a node based on configured property ---
  const getText = (node: NodeData): string => {
    const val = (node as any)[cfg.property];
    if (val === undefined || val === null) return node.node_type;
    if (typeof val === 'string') return val;
    return String(val);
  };

  return (
    <group>
      {labeledNodes.map((node) => (
        <Text
          key={`label-${node.id}`}
          position={[node.x, node.y + yOffset, node.z]}
          fontSize={scaledFontSize}
          color="#ffffff"
          anchorX="center"
          anchorY="top"
          outlineWidth={scaledFontSize * 0.15}
          outlineColor="#000000"
          font={undefined}
          maxWidth={0.3}
          textAlign="center"
          depthOffset={-1}
          renderOrder={999}
          // In 3D modes, the <Text> component from drei automatically
          // billboards toward the camera when it detects a perspective camera.
          // We force billboard behavior for 3D modes explicitly:
          {...(is3D ? { rotation: undefined } : {})}
        >
          {getText(node)}
        </Text>
      ))}
    </group>
  );
};
