/**
 * interaction/types.ts — Type definitions for the Node Interaction System
 *
 * Core types for selection, drag, box-select, and context menu operations
 * on the hyperbolic graph visualization.
 */

// Re-export NodeData and ManifoldType from the engine for convenience
export type { NodeData, ManifoldType } from '../components/PerspektiveEngine';

// ==========================================
// SELECTION STATE
// ==========================================

export interface SelectionState {
  /** Set of currently selected node IDs */
  selectedIds: Set<string>;
  /** The "primary" selected node (last clicked, used for shift-range) */
  primaryId: string | null;
  /** Currently hovered node ID (for visual feedback) */
  hoveredId: string | null;
  /** Node currently being dragged */
  draggedId: string | null;
  /** Active box selection rectangle in screen coordinates */
  boxSelect: BoxSelectRect | null;
}

export interface BoxSelectRect {
  start: { x: number; y: number };
  end: { x: number; y: number };
}

// ==========================================
// CONTEXT MENU
// ==========================================

export interface ContextMenuItem {
  /** Display label */
  label: string;
  /** Optional icon (emoji or icon class) */
  icon?: string;
  /** Action to execute when clicked, receives affected node IDs */
  action: (nodeIds: string[]) => void;
  /** If true, render a visual separator before this item */
  separator?: boolean;
  /** If true, item is grayed out and non-clickable */
  disabled?: boolean;
  /** Optional keyboard shortcut hint displayed on the right */
  shortcut?: string;
}

export interface ContextMenuState {
  /** Whether the context menu is currently visible */
  visible: boolean;
  /** Screen position of the menu */
  position: { x: number; y: number };
  /** Node IDs the menu applies to */
  targetIds: string[];
}

// ==========================================
// INTERACTION CALLBACKS
// ==========================================

export interface InteractionCallbacks {
  /** Fired when node(s) are selected */
  onSelect?: (ids: string[]) => void;
  /** Fired when selection is cleared */
  onDeselect?: () => void;
  /** Fired when a node drag begins */
  onDragStart?: (id: string) => void;
  /** Fired when a node drag ends with final world position */
  onDragEnd?: (id: string, position: { x: number; y: number; z: number }) => void;
  /** Fired on right-click, providing screen coordinates for menu placement */
  onContextMenu?: (ids: string[], position: { x: number; y: number }) => void;
  /** Fired on double-click of a node */
  onDoubleClick?: (id: string) => void;
  /** Fired when "Focus" is selected from context menu */
  onFocus?: (id: string) => void;
  /** Fired when "Expand Neighbors" is selected */
  onExpandNeighbors?: (id: string) => void;
  /** Fired when "Hide" is selected */
  onHide?: (ids: string[]) => void;
  /** Fired when node pin state changes */
  onTogglePin?: (ids: string[], pinned: boolean) => void;
}

// ==========================================
// DRAG STATE
// ==========================================

export interface DragState {
  /** Whether a drag operation is currently active */
  isDragging: boolean;
  /** The ID of the node being dragged (anchor point for multi-drag) */
  dragAnchorId: string | null;
  /** Initial world position when drag started */
  dragStartWorld: { x: number; y: number; z: number } | null;
  /** Initial mouse screen position when drag started */
  dragStartScreen: { x: number; y: number } | null;
  /** Current offset from drag start in world coordinates */
  dragDelta: { x: number; y: number; z: number };
}

// ==========================================
// INTERACTION CONFIG
// ==========================================

export interface InteractionConfig {
  /** Enable node dragging. Default: true */
  enableDrag?: boolean;
  /** Enable box selection (shift+drag on empty space). Default: true */
  enableBoxSelect?: boolean;
  /** Enable context menu on right-click. Default: true */
  enableContextMenu?: boolean;
  /** Enable multi-select with Ctrl+click. Default: true */
  enableMultiSelect?: boolean;
  /** Enable double-click action. Default: true */
  enableDoubleClick?: boolean;
  /** Custom context menu items (replaces defaults if provided) */
  contextMenuItems?: ContextMenuItem[];
  /** Poincare disk boundary clamp radius (must be < 1.0). Default: 0.99 */
  poincareBoundary?: number;
}
