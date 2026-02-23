/**
 * interaction/index.ts — Public exports for the Node Interaction System
 *
 * perspektive.js interaction layer:
 *   - Selection (single, multi, range, box, by type)
 *   - Drag (single & multi-node, with Poincare boundary clamping)
 *   - Box Selection (Shift+drag rectangle)
 *   - Context Menu (cyberpunk themed, customizable)
 *   - Visual Highlights (selection rings, hover rings)
 */

// --- Types ---
export type {
  SelectionState,
  BoxSelectRect,
  ContextMenuItem,
  ContextMenuState,
  InteractionCallbacks,
  DragState,
  InteractionConfig,
} from './types';

// --- Zustand Store ---
export { useSelection } from './useSelection';

// --- Hooks ---
export { useDrag } from './useDrag';
export { useBoxSelect, useBoxSelectHTML } from './useBoxSelect';

// --- React Components ---
export { ContextMenu } from './ContextMenu';
export type { ContextMenuProps } from './ContextMenu';

export { BoxSelectOverlay } from './BoxSelectOverlay';

export { SelectionHighlight, HoverHighlight } from './SelectionHighlight';
export type { SelectionHighlightProps, HoverHighlightProps } from './SelectionHighlight';
