/**
 * search/types.ts — Type definitions for the Search, Filter & Labels system
 *
 * Core interfaces used by the filter store, search bar, filter panel,
 * node labels, and dim effect utilities.
 */

// ==========================================
// FILTER CRITERIA
// ==========================================

/**
 * Describes which nodes should be visible / matched.
 * All active criteria are combined with AND logic:
 * a node must pass every non-empty criterion to be considered "matched".
 */
export interface FilterCriteria {
  /** Include only nodes whose `node_type` is in this list. Empty = all types. */
  nodeTypes?: string[];
  /** Energy range filter: [min, max] inclusive. Values in [0, 1]. */
  energyRange?: [number, number];
  /** Free-text fuzzy search — matched against `id`, `node_type`, or custom fields. */
  searchText?: string;
  /** Arbitrary predicate for advanced programmatic filtering. */
  customFilter?: (node: any) => boolean;
}

// ==========================================
// FILTER STATE
// ==========================================

/**
 * The runtime state of the filter system.
 * Maintained by the `useFilter` zustand store.
 */
export interface FilterState {
  /** The current filter criteria (combined AND). */
  criteria: FilterCriteria;
  /** Set of node IDs that currently pass all active filters. */
  matchedIds: Set<string>;
  /** Whether any filter is actively narrowing the view. */
  isActive: boolean;
}

// ==========================================
// LABEL CONFIG
// ==========================================

/**
 * Configuration for the WebGL node labels rendered via drei `<Text>`.
 */
export interface LabelConfig {
  /** Whether to show labels at all. */
  show: boolean;
  /** Maximum number of labels to render simultaneously (top N by energy). */
  maxLabels: number;
  /** Font size for SDF text rendering. */
  fontSize: number;
  /** Which node property to display as the label text (default: 'node_type'). */
  property: string;
  /**
   * Which subset of nodes to label:
   * - 'all'      — top N by energy from the full node set
   * - 'elite'    — only nodes above `eliteThreshold`
   * - 'selected' — only currently selected nodes
   * - 'searched' — only nodes matching the active search/filter
   */
  filter?: 'all' | 'elite' | 'selected' | 'searched';
  /** Energy threshold for the 'elite' filter mode. */
  eliteThreshold: number;
}

// ==========================================
// DIM EFFECT OVERRIDES
// ==========================================

/**
 * Per-node visual override returned by the DimEffect utility.
 * The renderer applies these to the InstancedMesh via setColorAt / setMatrixAt.
 */
export interface DimOverride {
  /** CSS hex color to apply. Dimmed nodes get a dark gray; matched nodes keep their original. */
  color: string;
  /** Scale multiplier. Dimmed nodes shrink (e.g. 0.3); matched nodes stay at 1.0. */
  scale: number;
}
