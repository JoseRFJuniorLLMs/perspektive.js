/**
 * interaction/useBoxSelect.ts — Box/Rectangle selection hook
 *
 * Enables rectangular area selection of nodes:
 * - Shift + pointerdown on empty space starts box selection
 * - Draws a translucent rectangle overlay (handled by BoxSelectOverlay.tsx)
 * - On pointerup, finds all nodes whose screen projection falls inside the box
 * - Additive mode: Ctrl held during box select = union with existing selection
 *
 * Screen projection is done by projecting each node's world position through
 * the current camera to screen coordinates, then testing containment.
 */

import { useCallback, useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSelection } from './useSelection';
import type { NodeData } from '../components/PerspektiveEngine';
import type { InteractionCallbacks } from './types';

// ==========================================
// TYPES
// ==========================================

interface UseBoxSelectOptions {
  /** All visible nodes to test against */
  nodes: NodeData[];
  /** Whether box selection is enabled */
  enabled?: boolean;
  /** Interaction callbacks */
  callbacks?: InteractionCallbacks;
}

interface BoxSelectRef {
  isActive: boolean;
  startX: number;
  startY: number;
  ctrlHeld: boolean;
}

interface UseBoxSelectReturn {
  /** Attach to the container element's pointerdown */
  handlePointerDown: (e: PointerEvent) => void;
  /** Attach to the container element's pointermove */
  handlePointerMove: (e: PointerEvent) => void;
  /** Attach to the container element's pointerup */
  handlePointerUp: (e: PointerEvent) => void;
}

// ==========================================
// HELPERS
// ==========================================

/**
 * Project a world position to screen (pixel) coordinates.
 * Returns {x, y} in CSS pixels relative to the canvas bounding rect.
 */
function worldToScreen(
  worldPos: THREE.Vector3,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement
): { x: number; y: number } {
  const projected = worldPos.clone().project(camera);
  const rect = canvas.getBoundingClientRect();

  return {
    x: ((projected.x + 1) / 2) * rect.width + rect.left,
    y: ((-projected.y + 1) / 2) * rect.height + rect.top,
  };
}

/**
 * Test if a point is inside a rectangle defined by two corners.
 * Handles rectangles drawn in any direction (start can be bottom-right of end).
 */
function pointInRect(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): boolean {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  return px >= minX && px <= maxX && py >= minY && py <= maxY;
}

// ==========================================
// HOOK
// ==========================================

export function useBoxSelect({
  nodes,
  enabled = true,
  callbacks,
}: UseBoxSelectOptions): UseBoxSelectReturn {
  const { camera, gl } = useThree();
  const boxRef = useRef<BoxSelectRef>({
    isActive: false,
    startX: 0,
    startY: 0,
    ctrlHeld: false,
  });

  const {
    startBoxSelect,
    updateBoxSelect,
    endBoxSelect,
    selectMany,
    boxSelect: _boxSelect,
    selectedIds,
  } = useSelection();

  // Clean up box select state on unmount
  useEffect(() => {
    return () => {
      if (boxRef.current.isActive) {
        endBoxSelect();
      }
    };
  }, [endBoxSelect]);

  // --- POINTER DOWN ---
  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (!enabled) return;

      // Box select requires Shift key + left mouse button
      if (!e.shiftKey || e.button !== 0) return;

      // Prevent default to avoid text selection
      e.preventDefault();

      boxRef.current = {
        isActive: true,
        startX: e.clientX,
        startY: e.clientY,
        ctrlHeld: e.ctrlKey || e.metaKey,
      };

      startBoxSelect(e.clientX, e.clientY);
    },
    [enabled, startBoxSelect]
  );

  // --- POINTER MOVE ---
  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!boxRef.current.isActive) return;

      updateBoxSelect(e.clientX, e.clientY);
    },
    [updateBoxSelect]
  );

  // --- POINTER UP ---
  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (!boxRef.current.isActive) return;

      const canvas = gl.domElement;
      const { startX, startY, ctrlHeld } = boxRef.current;
      const endX = e.clientX;
      const endY = e.clientY;

      // Find all nodes whose screen projections fall inside the rectangle
      const nodesInBox: string[] = [];
      const worldPos = new THREE.Vector3();

      for (const node of nodes) {
        worldPos.set(node.x, node.y, node.z);
        const screenPos = worldToScreen(worldPos, camera, canvas);

        if (pointInRect(screenPos.x, screenPos.y, startX, startY, endX, endY)) {
          nodesInBox.push(node.id);
        }
      }

      // Apply selection
      if (nodesInBox.length > 0) {
        selectMany(nodesInBox, ctrlHeld);
        callbacks?.onSelect?.(
          ctrlHeld
            ? Array.from(new Set([...Array.from(selectedIds), ...nodesInBox]))
            : nodesInBox
        );
      } else if (!ctrlHeld) {
        // If no nodes in box and not holding ctrl, could optionally deselect
        // We leave selection as-is for better UX (accidental empty box shouldn't clear)
      }

      // Clean up
      boxRef.current.isActive = false;
      endBoxSelect();
    },
    [nodes, camera, gl, selectMany, endBoxSelect, callbacks, selectedIds]
  );

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}

/**
 * Standalone version of useBoxSelect for use OUTSIDE the R3F Canvas.
 * Uses a camera and canvas reference instead of useThree().
 * This is useful for attaching box select to the HTML container div.
 */
export function useBoxSelectHTML(options: {
  nodes: NodeData[];
  cameraRef: React.RefObject<THREE.Camera | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  enabled?: boolean;
  callbacks?: InteractionCallbacks;
}) {
  const { nodes, cameraRef, canvasRef, enabled = true, callbacks } = options;

  const boxRef = useRef<BoxSelectRef>({
    isActive: false,
    startX: 0,
    startY: 0,
    ctrlHeld: false,
  });

  const {
    startBoxSelect,
    updateBoxSelect,
    endBoxSelect,
    selectMany,
    selectedIds,
  } = useSelection();

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (!enabled || !e.shiftKey || e.button !== 0) return;
      e.preventDefault();

      boxRef.current = {
        isActive: true,
        startX: e.clientX,
        startY: e.clientY,
        ctrlHeld: e.ctrlKey || e.metaKey,
      };

      startBoxSelect(e.clientX, e.clientY);
    },
    [enabled, startBoxSelect]
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!boxRef.current.isActive) return;
      updateBoxSelect(e.clientX, e.clientY);
    },
    [updateBoxSelect]
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (!boxRef.current.isActive) return;

      const cam = cameraRef.current;
      const canvas = canvasRef.current;
      if (!cam || !canvas) {
        boxRef.current.isActive = false;
        endBoxSelect();
        return;
      }

      const { startX, startY, ctrlHeld } = boxRef.current;
      const endX = e.clientX;
      const endY = e.clientY;

      const nodesInBox: string[] = [];
      const worldPos = new THREE.Vector3();

      for (const node of nodes) {
        worldPos.set(node.x, node.y, node.z);
        const screenPos = worldToScreen(worldPos, cam, canvas);

        if (pointInRect(screenPos.x, screenPos.y, startX, startY, endX, endY)) {
          nodesInBox.push(node.id);
        }
      }

      if (nodesInBox.length > 0) {
        selectMany(nodesInBox, ctrlHeld);
        callbacks?.onSelect?.(
          ctrlHeld
            ? Array.from(new Set([...Array.from(selectedIds), ...nodesInBox]))
            : nodesInBox
        );
      }

      boxRef.current.isActive = false;
      endBoxSelect();
    },
    [nodes, cameraRef, canvasRef, selectMany, endBoxSelect, callbacks, selectedIds]
  );

  return { handlePointerDown, handlePointerMove, handlePointerUp };
}
