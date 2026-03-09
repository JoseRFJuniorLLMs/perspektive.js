/**
 * interaction/SelectionHighlight.tsx — Visual selection rings in WebGL (R3F)
 *
 * Renders glowing ring outlines around selected nodes using a second InstancedMesh.
 * This component lives INSIDE the R3F Canvas, alongside the main graph nodes.
 *
 * Technique:
 *   - Uses a RingGeometry (donut) with wireframe MeshBasicMaterial
 *   - Each selected node gets a ring slightly larger than its visual radius
 *   - Pulsing glow effect via sinusoidal scale oscillation in useFrame
 *   - Two-tone coloring: #00f0ff for selected, #ff00ff for primary selection
 *
 * Performance:
 *   - Single InstancedMesh draw call for ALL selection rings
 *   - Instance count capped at selectedIds.size (re-created only on selection change)
 *   - No individual <mesh> per node — O(1) draw calls
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSelection } from './useSelection';
import type { NodeData, ManifoldType } from '../components/PerspektiveEngine';
import { getVisualRadius } from '../math/poincare';

// ==========================================
// TYPES
// ==========================================

export interface SelectionHighlightProps {
  /** All visible nodes (to find positions of selected ones) */
  nodes: NodeData[];
  /** Current manifold mode (affects visual radius in POINCARE) */
  manifold: ManifoldType;
  /** Color for regular selected nodes. Default: #00f0ff */
  selectionColor?: string;
  /** Color for the primary selected node. Default: #ff00ff */
  primaryColor?: string;
  /** Base scale multiplier for the ring (relative to node size). Default: 2.5 */
  ringScale?: number;
  /** Pulse amplitude (0 = no pulse, 1 = 100% scale variation). Default: 0.15 */
  pulseAmplitude?: number;
  /** Pulse frequency in Hz. Default: 2 */
  pulseFrequency?: number;
}

// ==========================================
// CONSTANTS
// ==========================================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const CYAN = new THREE.Color('#00f0ff');
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MAGENTA = new THREE.Color('#ff00ff');
const HDR_MULTIPLIER = 3.0; // Push colors into HDR range for Bloom to pick up

// ==========================================
// COMPONENT
// ==========================================

export const SelectionHighlight = ({
  nodes,
  manifold,
  selectionColor = '#00f0ff',
  primaryColor = '#ff00ff',
  ringScale = 2.5,
  pulseAmplitude = 0.15,
  pulseFrequency = 2,
}: SelectionHighlightProps) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { selectedIds, primaryId } = useSelection();

  // Memoize colors
  const selColor = useMemo(() => new THREE.Color(selectionColor), [selectionColor]);
  const priColor = useMemo(() => new THREE.Color(primaryColor), [primaryColor]);

  // Build a lookup: nodeId -> NodeData for fast access
  const nodeMap = useMemo(() => {
    const map = new Map<string, NodeData>();
    for (const node of nodes) {
      map.set(node.id, node);
    }
    return map;
  }, [nodes]);

  // Ordered list of selected node IDs (stable order for InstancedMesh indexing)
  const selectedList = useMemo(() => {
    return Array.from(selectedIds).filter(id => nodeMap.has(id));
  }, [selectedIds, nodeMap]);

  // Scratch objects for matrix/color operations (avoid allocating per frame)
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);

  // Maximum instance count — we'll hide unused instances by scaling to 0
  const maxInstances = useMemo(() => Math.max(selectedList.length, 1), [selectedList.length]);

  // Update instance matrices and colors when selection changes
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    for (let i = 0; i < maxInstances; i++) {
      if (i < selectedList.length) {
        const nodeId = selectedList[i];
        const node = nodeMap.get(nodeId);

        if (node) {
          // Position the ring at the node's world position
          dummy.position.set(node.x, node.y, node.z + 0.001); // Slight z-offset to render on top

          // Compute ring radius based on node's visual size
          const baseRadius = 0.01 + (node.energy * 0.03);
          const visualRadius = manifold === 'POINCARE'
            ? getVisualRadius(node, baseRadius)
            : baseRadius;
          const scale = visualRadius * ringScale;
          dummy.scale.set(scale, scale, 1);

          // In Riemann mode, orient rings to face camera (billboard)
          if (manifold === 'RIEMANN') {
            dummy.lookAt(0, 0, 0);
          } else {
            dummy.rotation.set(0, 0, 0);
          }

          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);

          // Color: primary node gets magenta, others get cyan
          const isPrimary = nodeId === primaryId;
          tempColor.copy(isPrimary ? priColor : selColor);
          tempColor.multiplyScalar(HDR_MULTIPLIER); // HDR for Bloom glow
          mesh.setColorAt(i, tempColor);
        }
      } else {
        // Hide unused instances
        dummy.position.set(0, 0, -100);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);

        tempColor.set(0x000000);
        mesh.setColorAt(i, tempColor);
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [selectedList, nodeMap, maxInstances, manifold, dummy, tempColor, selColor, priColor, primaryId, ringScale]);

  // Pulsing glow animation: sinusoidal scale oscillation per frame
  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh || selectedList.length === 0) return;

    const time = clock.getElapsedTime();
    const pulse = 1 + Math.sin(time * pulseFrequency * Math.PI * 2) * pulseAmplitude;

    let needsUpdate = false;

    for (let i = 0; i < selectedList.length; i++) {
      const nodeId = selectedList[i];
      const node = nodeMap.get(nodeId);
      if (!node) continue;

      mesh.getMatrixAt(i, dummy.matrix);
      dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

      // Compute base scale for this node
      const baseRadius = 0.01 + (node.energy * 0.03);
      const visualRadius = manifold === 'POINCARE'
        ? getVisualRadius(node, baseRadius)
        : baseRadius;
      const baseScale = visualRadius * ringScale;

      // Apply pulse
      const pulsedScale = baseScale * pulse;
      dummy.scale.set(pulsedScale, pulsedScale, 1);

      // Update position to track node (in case it moved via drag)
      dummy.position.set(node.x, node.y, node.z + 0.001);

      if (manifold === 'RIEMANN') {
        dummy.lookAt(0, 0, 0);
      }

      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      needsUpdate = true;
    }

    if (needsUpdate) {
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  // Don't render anything if nothing is selected
  if (selectedList.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, maxInstances]}
      frustumCulled={false}
    >
      {/* Ring geometry: inner radius 0.7, outer radius 1.0, giving a visible ring band */}
      <ringGeometry args={[0.7, 1.0, 32]} />
      <meshBasicMaterial
        toneMapped={false}
        transparent
        opacity={0.6}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  );
};

// ==========================================
// HOVERED NODE HIGHLIGHT (single node, not instanced)
// ==========================================

export interface HoverHighlightProps {
  /** The currently hovered node, or null */
  hoveredNode: NodeData | null;
  /** Current manifold */
  manifold: ManifoldType;
  /** Highlight color. Default: #00f0ff */
  color?: string;
}

/**
 * A simple ring highlight for the hovered node.
 * Separate from SelectionHighlight to avoid re-instancing on every hover change.
 * Uses a single mesh (not instanced) for simplicity.
 */
export const HoverHighlight = ({
  hoveredNode,
  manifold,
  color = '#00f0ff',
}: HoverHighlightProps) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const hdrColor = useMemo(() => {
    return new THREE.Color(color).multiplyScalar(2.0);
  }, [color]);

  // Animate a subtle breathing effect
  useFrame(({ clock }) => {
    if (!meshRef.current || !hoveredNode) return;
    const t = clock.getElapsedTime();
    const breath = 1 + Math.sin(t * 4) * 0.1;

    const baseRadius = 0.01 + (hoveredNode.energy * 0.03);
    const visualRadius = manifold === 'POINCARE'
      ? getVisualRadius(hoveredNode, baseRadius)
      : baseRadius;
    const scale = visualRadius * 3.0 * breath;

    meshRef.current.scale.set(scale, scale, 1);
    meshRef.current.position.set(hoveredNode.x, hoveredNode.y, hoveredNode.z + 0.002);

    if (manifold === 'RIEMANN') {
      meshRef.current.lookAt(0, 0, 0);
    }
  });

  if (!hoveredNode) return null;

  const baseRadius = 0.01 + (hoveredNode.energy * 0.03);
  const visualRadius = manifold === 'POINCARE'
    ? getVisualRadius(hoveredNode, baseRadius)
    : baseRadius;
  const initialScale = visualRadius * 3.0;

  return (
    <mesh
      ref={meshRef}
      position={[hoveredNode.x, hoveredNode.y, hoveredNode.z + 0.002]}
      scale={[initialScale, initialScale, 1]}
    >
      <ringGeometry args={[0.8, 1.0, 32]} />
      <meshBasicMaterial
        color={hdrColor}
        toneMapped={false}
        transparent
        opacity={0.4}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
};
