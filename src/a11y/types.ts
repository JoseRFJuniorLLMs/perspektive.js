/**
 * a11y/types.ts — Type definitions for the perspektive.js accessibility layer
 *
 * Defines configuration interfaces for:
 * - Global accessibility settings (keyboard nav, screen reader, contrast, motion)
 * - Node/edge description metadata for screen readers
 * - Announcement events for ARIA live regions
 *
 * @module a11y/types
 */

// ==========================================
// ACCESSIBILITY CONFIGURATION
// ==========================================

/**
 * Master configuration for the accessibility layer.
 *
 * All features default to `true` when the A11yProvider is enabled,
 * but each can be individually toggled. OS-level preferences for
 * `highContrast` and `reducedMotion` are auto-detected on mount
 * and merged with the user-supplied config.
 */
export interface A11yConfig {
  /** Whether the accessibility layer is active at all. */
  enabled: boolean;

  /**
   * Announce graph mutations (node additions, removals, filter changes)
   * via an ARIA live region so screen readers speak them automatically.
   */
  announceChanges: boolean;

  /**
   * Enable Tab / Arrow key navigation through graph nodes.
   * When disabled, the WebGL canvas is skipped in the tab order.
   */
  keyboardNavigation: boolean;

  /**
   * Auto-generate human-readable descriptions for every node and edge
   * and expose them through `aria-label` attributes in the hidden DOM.
   */
  descriptions: boolean;

  /**
   * Force high-contrast rendering:
   * - Flat colors (no bloom / HDR)
   * - Thicker edges
   * - Distinct shapes per node type instead of color alone
   *
   * Auto-detected from `prefers-contrast: more` when not explicitly set.
   */
  highContrast: boolean;

  /**
   * Suppress all animations:
   * - Instant position updates (no lerp)
   * - No bloom pulsing
   * - No energy breathing effects
   * - Static manifold transitions
   *
   * Auto-detected from `prefers-reduced-motion: reduce` when not explicitly set.
   */
  reducedMotion: boolean;

  /**
   * Render a visible focus ring (pulsing yellow ring) around the
   * keyboard-focused node in the WebGL canvas so sighted keyboard
   * users can track their position.
   */
  focusIndicator: boolean;
}

// ==========================================
// NODE DESCRIPTION (for screen readers)
// ==========================================

/**
 * Structured metadata for a single graph node, used to populate
 * the hidden ARIA DOM and screen-reader announcements.
 */
export interface NodeDescription {
  /** The node's unique identifier. */
  id: string;

  /**
   * Short human-readable label displayed in the hidden DOM.
   * Typically the node_type plus a truncated ID.
   * Example: "Episodic node abc123"
   */
  label: string;

  /**
   * Full description read by screen readers when the element receives focus.
   * Includes energy, connection count, and approximate spatial position.
   * Example: "Episodic node abc123, energy 85%, connected to 3 nodes, position near center"
   */
  description: string;

  /**
   * ARIA role for this node element in the hidden DOM.
   * Typically "listitem" when rendered inside a role="list" container.
   */
  role: string;
}

// ==========================================
// EDGE DESCRIPTION (for screen readers)
// ==========================================

/**
 * Structured metadata for a single graph edge.
 */
export interface EdgeDescription {
  /** Source node ID. */
  sourceId: string;

  /** Target node ID. */
  targetId: string;

  /** Human-readable description of the edge relationship. */
  description: string;
}

// ==========================================
// ANNOUNCEMENT EVENTS
// ==========================================

/**
 * Categories of events that trigger ARIA live-region announcements.
 * Each category uses a slightly different message template.
 */
export type AnnouncementType =
  | 'node-focus'
  | 'node-select'
  | 'selection-count'
  | 'manifold-switch'
  | 'graph-update'
  | 'filter'
  | 'navigation'
  | 'custom';

/**
 * A structured announcement payload pushed to the ARIA live region.
 */
export interface Announcement {
  /** Category of this announcement. */
  type: AnnouncementType;

  /** The message text that the screen reader will speak. */
  message: string;

  /**
   * ARIA politeness level.
   * - "polite": queued after current speech (default, use for most events)
   * - "assertive": interrupts current speech (use sparingly, e.g. errors)
   */
  priority?: 'polite' | 'assertive';
}

// ==========================================
// FOCUS STATE
// ==========================================

/**
 * State tracked by the keyboard navigation system.
 */
export interface FocusState {
  /** The ID of the currently keyboard-focused node, or null if none. */
  focusedNodeId: string | null;

  /**
   * Ordered list of node IDs representing the keyboard tab order.
   * Sorted by energy descending so the most important nodes come first.
   */
  tabOrder: string[];
}

// ==========================================
// DEFAULT CONFIG
// ==========================================

/**
 * Sensible defaults: everything enabled.
 * OS preferences (highContrast, reducedMotion) are overridden at runtime
 * by the A11yProvider after media-query detection.
 */
export const DEFAULT_A11Y_CONFIG: A11yConfig = {
  enabled: true,
  announceChanges: true,
  keyboardNavigation: true,
  descriptions: true,
  highContrast: false,
  reducedMotion: false,
  focusIndicator: true,
};
