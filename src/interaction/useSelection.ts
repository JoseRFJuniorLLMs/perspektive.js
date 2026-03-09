/**
 * interaction/useSelection.ts — Zustand store for node selection state
 *
 * Manages all selection operations:
 * - Single click: select one node (clears previous)
 * - Ctrl+click: toggle node in/out of selection
 * - Shift+click: range select (from primary to target in node order)
 * - Box select: bulk select all nodes within a screen rectangle
 * - Select all, deselect all, select by type
 *
 * Exported as a zustand store for global access from any component.
 */

import { create } from 'zustand';
import type { BoxSelectRect } from './types';

// ==========================================
// STORE INTERFACE
// ==========================================

export interface SelectionStore {
  // --- State ---
  selectedIds: Set<string>;
  primaryId: string | null;
  hoveredId: string | null;
  draggedId: string | null;
  boxSelect: BoxSelectRect | null;
  /** Set of node IDs that are "pinned" (locked in position) */
  pinnedIds: Set<string>;
  /** Set of node IDs that are hidden */
  hiddenIds: Set<string>;

  // --- Selection Actions ---
  /** Select a single node, clearing all others */
  selectNode: (id: string) => void;
  /** Toggle a node in/out of selection (Ctrl+click) */
  toggleNode: (id: string) => void;
  /** Range-select from primary to target using provided ordered node list */
  rangeSelect: (targetId: string, orderedIds: string[]) => void;
  /** Select multiple nodes at once (union with existing if additive) */
  selectMany: (ids: string[], additive?: boolean) => void;
  /** Select all nodes from a provided list */
  selectAll: (allIds: string[]) => void;
  /** Clear all selection */
  deselectAll: () => void;
  /** Select all nodes of a given type */
  selectByType: (type: string, nodes: Array<{ id: string; node_type: string }>) => void;
  /** Check if a node is selected */
  isSelected: (id: string) => boolean;

  // --- Hover ---
  setHoveredId: (id: string | null) => void;

  // --- Drag ---
  setDraggedId: (id: string | null) => void;

  // --- Box Select ---
  startBoxSelect: (x: number, y: number) => void;
  updateBoxSelect: (x: number, y: number) => void;
  endBoxSelect: () => void;

  // --- Pin/Hide ---
  togglePin: (ids: string[]) => void;
  isPinned: (id: string) => boolean;
  hideNodes: (ids: string[]) => void;
  showNode: (id: string) => void;
  showAll: () => void;
  isHidden: (id: string) => boolean;
}

// ==========================================
// STORE IMPLEMENTATION
// ==========================================

export const useSelection = create<SelectionStore>((set, get) => ({
  // --- Initial State ---
  selectedIds: new Set<string>(),
  primaryId: null,
  hoveredId: null,
  draggedId: null,
  boxSelect: null,
  pinnedIds: new Set<string>(),
  hiddenIds: new Set<string>(),

  // --- Selection Actions ---

  selectNode: (id: string) => {
    set({
      selectedIds: new Set([id]),
      primaryId: id,
    });
  },

  toggleNode: (id: string) => {
    const { selectedIds } = get();
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    set({
      selectedIds: next,
      primaryId: next.size > 0 ? id : null,
    });
  },

  rangeSelect: (targetId: string, orderedIds: string[]) => {
    const { primaryId, selectedIds } = get();
    if (!primaryId) {
      // No primary — just select the target
      set({ selectedIds: new Set([targetId]), primaryId: targetId });
      return;
    }

    const startIdx = orderedIds.indexOf(primaryId);
    const endIdx = orderedIds.indexOf(targetId);

    if (startIdx === -1 || endIdx === -1) {
      // Fallback: select just the target
      set({ selectedIds: new Set([targetId]), primaryId: targetId });
      return;
    }

    const lo = Math.min(startIdx, endIdx);
    const hi = Math.max(startIdx, endIdx);
    const rangeIds = orderedIds.slice(lo, hi + 1);

    // Union with existing selection
    const next = new Set(selectedIds);
    for (const rid of rangeIds) {
      next.add(rid);
    }

    set({ selectedIds: next });
    // primaryId stays as is for further range selects
  },

  selectMany: (ids: string[], additive = false) => {
    const { selectedIds } = get();
    if (additive) {
      const next = new Set(selectedIds);
      for (const id of ids) {
        next.add(id);
      }
      set({ selectedIds: next });
    } else {
      set({
        selectedIds: new Set(ids),
        primaryId: ids.length > 0 ? ids[0] : null,
      });
    }
  },

  selectAll: (allIds: string[]) => {
    set({
      selectedIds: new Set(allIds),
      primaryId: allIds.length > 0 ? allIds[0] : null,
    });
  },

  deselectAll: () => {
    set({
      selectedIds: new Set<string>(),
      primaryId: null,
    });
  },

  selectByType: (type: string, nodes: Array<{ id: string; node_type: string }>) => {
    const ids = nodes.filter(n => n.node_type === type).map(n => n.id);
    set({
      selectedIds: new Set(ids),
      primaryId: ids.length > 0 ? ids[0] : null,
    });
  },

  isSelected: (id: string) => {
    return get().selectedIds.has(id);
  },

  // --- Hover ---

  setHoveredId: (id: string | null) => {
    set({ hoveredId: id });
  },

  // --- Drag ---

  setDraggedId: (id: string | null) => {
    set({ draggedId: id });
  },

  // --- Box Select ---

  startBoxSelect: (x: number, y: number) => {
    set({
      boxSelect: { start: { x, y }, end: { x, y } },
    });
  },

  updateBoxSelect: (x: number, y: number) => {
    const { boxSelect } = get();
    if (!boxSelect) return;
    set({
      boxSelect: { ...boxSelect, end: { x, y } },
    });
  },

  endBoxSelect: () => {
    set({ boxSelect: null });
  },

  // --- Pin/Hide ---

  togglePin: (ids: string[]) => {
    const { pinnedIds } = get();
    const next = new Set(pinnedIds);
    // If ALL provided ids are pinned, unpin them all; otherwise pin them all
    const allPinned = ids.every(id => next.has(id));
    for (const id of ids) {
      if (allPinned) {
        next.delete(id);
      } else {
        next.add(id);
      }
    }
    set({ pinnedIds: next });
  },

  isPinned: (id: string) => {
    return get().pinnedIds.has(id);
  },

  hideNodes: (ids: string[]) => {
    const { hiddenIds, selectedIds } = get();
    const nextHidden = new Set(hiddenIds);
    const nextSelected = new Set(selectedIds);
    for (const id of ids) {
      nextHidden.add(id);
      nextSelected.delete(id); // Deselect hidden nodes
    }
    set({ hiddenIds: nextHidden, selectedIds: nextSelected });
  },

  showNode: (id: string) => {
    const { hiddenIds } = get();
    const next = new Set(hiddenIds);
    next.delete(id);
    set({ hiddenIds: next });
  },

  showAll: () => {
    set({ hiddenIds: new Set<string>() });
  },

  isHidden: (id: string) => {
    return get().hiddenIds.has(id);
  },
}));
