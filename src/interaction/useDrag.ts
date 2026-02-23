/**
 * interaction/useDrag.ts — Drag nodes hook for R3F InstancedMesh
 *
 * Handles dragging of nodes in the 3D/2D hyperbolic visualization:
 * - Pointerdown on a node starts drag mode
 * - Disables OrbitControls during drag (critical for UX)
 * - Converts screen coordinates to world coordinates via camera unprojection
 * - Supports dragging multiple selected nodes simultaneously
 * - Clamps to Poincare disk boundary (||pos|| < 0.99) in POINCARE manifold
 * - Fires callbacks on drag start/end with new world positions
 */

import { useCallback, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSelection } from './useSelection';
import type { NodeData, ManifoldType } from '../components/PerspektiveEngine';
import type { InteractionCallbacks } from './types';

// ==========================================
// TYPES
// ==========================================

interface UseDragOptions {
  /** Array of all visible nodes */
  nodes: NodeData[];
  /** Current manifold mode — needed for Poincare boundary clamping */
  manifold: ManifoldType;
  /** Boundary radius for Poincare disk clamping. Default: 0.99 */
  poincareBoundary?: number;
  /** Callback to update node positions in the parent data model */
  onUpdatePositions?: (updates: Array<{ id: string; x: number; y: number; z: number }>) => void;
  /** Reference to the OrbitControls to disable during drag */
  orbitControlsRef?: React.RefObject<{ enabled: boolean } | null>;
  /** Interaction callbacks */
  callbacks?: InteractionCallbacks;
}

interface DragRef {
  isDragging: boolean;
  anchorId: string | null;
  /** World position of anchor node when drag started */
  startWorldPos: THREE.Vector3;
  /** Screen position when drag started */
  startScreenPos: THREE.Vector2;
  /** Map of nodeId -> original world position for all dragged nodes */
  originalPositions: Map<string, THREE.Vector3>;
}

interface UseDragReturn {
  /** Attach to instancedMesh onPointerDown */
  handlePointerDown: (e: THREE.Event & { instanceId?: number; stopPropagation: () => void; nativeEvent: PointerEvent }) => void;
  /** Attach to the canvas container onPointerMove (or R3F onPointerMove on a catch plane) */
  handlePointerMove: (e: PointerEvent) => void;
  /** Attach to window onPointerUp */
  handlePointerUp: (e: PointerEvent) => void;
  /** Whether a drag is currently active */
  isDragging: boolean;
}

// ==========================================
// SCREEN-TO-WORLD CONVERSION
// ==========================================

/**
 * Convert screen (pixel) coordinates to world coordinates.
 * Works with both OrthographicCamera and PerspectiveCamera.
 * For 2D manifolds (Poincare, Emotion), projects onto the z=0 plane.
 */
function screenToWorld(
  screenX: number,
  screenY: number,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement,
  zPlane: number = 0
): THREE.Vector3 {
  const rect = canvas.getBoundingClientRect();

  // Normalize to NDC [-1, 1]
  const ndcX = ((screenX - rect.left) / rect.width) * 2 - 1;
  const ndcY = -((screenY - rect.top) / rect.height) * 2 + 1;

  if (camera instanceof THREE.OrthographicCamera) {
    // For orthographic: directly unproject from NDC
    const worldPos = new THREE.Vector3(ndcX, ndcY, 0).unproject(camera);
    worldPos.z = zPlane;
    return worldPos;
  } else {
    // For perspective: cast a ray from camera through NDC point, intersect with z-plane
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -zPlane);
    const target = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, target);
    return target || new THREE.Vector3(0, 0, zPlane);
  }
}

/**
 * Clamp a 2D position to the Poincare disk boundary.
 * In the Poincare ball model, all points must satisfy ||pos|| < 1.
 * We use a slightly smaller boundary (default 0.99) to keep nodes visible.
 */
function clampToPoincare(x: number, y: number, boundary: number): { x: number; y: number } {
  const norm = Math.sqrt(x * x + y * y);
  if (norm >= boundary) {
    const scale = boundary / norm;
    return { x: x * scale, y: y * scale };
  }
  return { x, y };
}

// ==========================================
// HOOK
// ==========================================

export function useDrag({
  nodes,
  manifold,
  poincareBoundary = 0.99,
  onUpdatePositions,
  orbitControlsRef,
  callbacks,
}: UseDragOptions): UseDragReturn {
  const { camera, gl } = useThree();
  const dragRef = useRef<DragRef>({
    isDragging: false,
    anchorId: null,
    startWorldPos: new THREE.Vector3(),
    startScreenPos: new THREE.Vector2(),
    originalPositions: new Map(),
  });

  const { selectedIds, selectNode, setDraggedId } = useSelection();

  // --- POINTER DOWN (on instancedMesh) ---
  const handlePointerDown = useCallback(
    (e: THREE.Event & { instanceId?: number; stopPropagation: () => void; nativeEvent: PointerEvent }) => {
      if (e.instanceId === undefined || e.instanceId >= nodes.length) return;

      const node = nodes[e.instanceId];
      const nativeEvent = e.nativeEvent;

      // Only start drag on left mouse button
      if (nativeEvent.button !== 0) return;

      // If the node is not selected, select it first (unless Ctrl is held)
      if (!selectedIds.has(node.id) && !nativeEvent.ctrlKey && !nativeEvent.metaKey) {
        selectNode(node.id);
      }

      // Determine which nodes will be dragged
      const draggedIds = selectedIds.has(node.id)
        ? Array.from(selectedIds)
        : [node.id];

      // Store original positions for all dragged nodes
      const originalPositions = new Map<string, THREE.Vector3>();
      for (const id of draggedIds) {
        const n = nodes.find(nd => nd.id === id);
        if (n) {
          originalPositions.set(id, new THREE.Vector3(n.x, n.y, n.z));
        }
      }

      // Compute the world position under the mouse at drag start
      const canvas = gl.domElement;
      const startWorld = screenToWorld(
        nativeEvent.clientX,
        nativeEvent.clientY,
        camera,
        canvas,
        node.z
      );

      dragRef.current = {
        isDragging: true,
        anchorId: node.id,
        startWorldPos: startWorld,
        startScreenPos: new THREE.Vector2(nativeEvent.clientX, nativeEvent.clientY),
        originalPositions,
      };

      setDraggedId(node.id);

      // Disable OrbitControls during drag
      if (orbitControlsRef?.current) {
        orbitControlsRef.current.enabled = false;
      }

      // Fire callback
      callbacks?.onDragStart?.(node.id);

      // Capture pointer for smooth dragging even when cursor leaves canvas
      canvas.setPointerCapture(nativeEvent.pointerId);

      e.stopPropagation();
    },
    [nodes, selectedIds, selectNode, setDraggedId, camera, gl, orbitControlsRef, callbacks]
  );

  // --- POINTER MOVE (on window/container) ---
  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag.isDragging || !drag.anchorId) return;

      const canvas = gl.domElement;

      // Current world position under cursor
      const currentWorld = screenToWorld(
        e.clientX,
        e.clientY,
        camera,
        canvas,
        0 // Use z=0 for 2D manifolds
      );

      // Compute delta from drag start in world space
      const deltaX = currentWorld.x - drag.startWorldPos.x;
      const deltaY = currentWorld.y - drag.startWorldPos.y;
      const deltaZ = currentWorld.z - drag.startWorldPos.z;

      // Compute new positions for all dragged nodes
      const updates: Array<{ id: string; x: number; y: number; z: number }> = [];

      for (const [id, origPos] of drag.originalPositions) {
        let newX = origPos.x + deltaX;
        let newY = origPos.y + deltaY;
        let newZ = origPos.z + deltaZ;

        // Poincare disk boundary clamping
        if (manifold === 'POINCARE') {
          const clamped = clampToPoincare(newX, newY, poincareBoundary);
          newX = clamped.x;
          newY = clamped.y;
          newZ = 0.01; // Poincare is always flat at z=0.01
        }

        // Emotion manifold: clamp to [-1, 1] range
        if (manifold === 'EMOTION') {
          newX = Math.max(-1, Math.min(1, newX));
          newY = Math.max(-1, Math.min(1, newY));
          newZ = 0.01;
        }

        updates.push({ id, x: newX, y: newY, z: newZ });
      }

      // Update positions in the data model
      onUpdatePositions?.(updates);
    },
    [camera, gl, manifold, poincareBoundary, onUpdatePositions]
  );

  // --- POINTER UP (on window) ---
  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag.isDragging || !drag.anchorId) return;

      // Re-enable OrbitControls
      if (orbitControlsRef?.current) {
        orbitControlsRef.current.enabled = true;
      }

      // Fire callback with the final position of the anchor node
      if (callbacks?.onDragEnd) {
        const anchorNode = nodes.find(n => n.id === drag.anchorId);
        if (anchorNode) {
          callbacks.onDragEnd(drag.anchorId, {
            x: anchorNode.x,
            y: anchorNode.y,
            z: anchorNode.z,
          });
        }
      }

      // Release pointer capture
      const canvas = gl.domElement;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer may have already been released
      }

      // Reset drag state
      dragRef.current = {
        isDragging: false,
        anchorId: null,
        startWorldPos: new THREE.Vector3(),
        startScreenPos: new THREE.Vector2(),
        originalPositions: new Map(),
      };

      setDraggedId(null);
    },
    [nodes, orbitControlsRef, callbacks, gl, setDraggedId]
  );

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    isDragging: dragRef.current.isDragging,
  };
}
