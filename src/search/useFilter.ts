/**
 * search/useFilter.ts — Zustand store for search & filter state management
 *
 * Manages all filter criteria (search text, node types, energy range,
 * custom predicates) and computes the set of matched node IDs.
 *
 * All active criteria are combined with AND logic: a node must satisfy
 * every non-empty criterion to appear in `matchedIds`.
 *
 * Usage:
 *   const { matchedIds, isActive, setSearch } = useFilter();
 *   useFilter.getState().setNodes(graphData.nodes);
 */

import { create } from 'zustand';
import type { FilterCriteria } from './types';

// ==========================================
// STORE INTERFACE
// ==========================================

interface FilterStore {
  // --- State ---

  /** Current filter criteria. */
  criteria: FilterCriteria;
  /** Set of node IDs that pass all active filters. */
  matchedIds: Set<string>;
  /** Whether any filter is actively narrowing the view. */
  isActive: boolean;
  /** Snapshot of the node list used for recomputation. */
  _nodes: Array<{ id: string; node_type: string; energy: number; [key: string]: any }>;

  // --- Node Data ---

  /**
   * Feed the current node list into the filter store.
   * Should be called whenever graph data changes (e.g. after SSE update).
   */
  setNodes: (nodes: Array<{ id: string; node_type: string; energy: number; [key: string]: any }>) => void;

  // --- Filter Actions ---

  /**
   * Set free-text search. Fuzzy-matches against `id`, `node_type`,
   * and any string-valued custom fields on the node object.
   */
  setSearch: (text: string) => void;

  /** Filter to only include the specified node types. Pass empty array to clear. */
  setNodeTypeFilter: (types: string[]) => void;

  /** Filter to only include nodes within the energy range [min, max]. */
  setEnergyRange: (min: number, max: number) => void;

  /** Set an arbitrary predicate for programmatic filtering. Pass undefined to clear. */
  setCustomFilter: (fn: ((node: any) => boolean) | undefined) => void;

  /** Reset all filters to their default (inactive) state. */
  resetFilters: () => void;
}

// ==========================================
// HELPERS
// ==========================================

/** Lowercase fuzzy substring match. */
function fuzzyMatch(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/** Check whether any filter criterion is actually active. */
function isFilterActive(criteria: FilterCriteria): boolean {
  if (criteria.searchText && criteria.searchText.trim().length > 0) return true;
  if (criteria.nodeTypes && criteria.nodeTypes.length > 0) return true;
  if (criteria.energyRange) return true;
  if (criteria.customFilter) return true;
  return false;
}

/**
 * Recompute the set of matched node IDs given current criteria and node list.
 * If no filter is active, all nodes are matched.
 */
function computeMatchedIds(
  nodes: Array<{ id: string; node_type: string; energy: number; [key: string]: any }>,
  criteria: FilterCriteria,
): Set<string> {
  const active = isFilterActive(criteria);
  if (!active) {
    return new Set(nodes.map(n => n.id));
  }

  const matched = new Set<string>();
  const searchLower = criteria.searchText?.trim().toLowerCase() ?? '';

  for (const node of nodes) {
    // --- Search text (fuzzy substring on id, node_type, and string fields) ---
    if (searchLower.length > 0) {
      let textMatch = false;
      if (fuzzyMatch(node.id, searchLower)) textMatch = true;
      else if (fuzzyMatch(node.node_type, searchLower)) textMatch = true;
      else {
        // Search through all string-valued properties
        for (const key of Object.keys(node)) {
          if (key === 'id' || key === 'node_type') continue;
          const val = node[key];
          if (typeof val === 'string' && fuzzyMatch(val, searchLower)) {
            textMatch = true;
            break;
          }
        }
      }
      if (!textMatch) continue;
    }

    // --- Node type filter ---
    if (criteria.nodeTypes && criteria.nodeTypes.length > 0) {
      if (!criteria.nodeTypes.includes(node.node_type)) continue;
    }

    // --- Energy range ---
    if (criteria.energyRange) {
      const [min, max] = criteria.energyRange;
      if (node.energy < min || node.energy > max) continue;
    }

    // --- Custom filter ---
    if (criteria.customFilter) {
      if (!criteria.customFilter(node)) continue;
    }

    matched.add(node.id);
  }

  return matched;
}

// ==========================================
// STORE
// ==========================================

const EMPTY_CRITERIA: FilterCriteria = {};

export const useFilter = create<FilterStore>((set, get) => ({
  // --- Initial State ---
  criteria: { ...EMPTY_CRITERIA },
  matchedIds: new Set<string>(),
  isActive: false,
  _nodes: [],

  // --- Node Data ---

  setNodes: (nodes) => {
    const { criteria } = get();
    const matchedIds = computeMatchedIds(nodes, criteria);
    set({
      _nodes: nodes,
      matchedIds,
      isActive: isFilterActive(criteria),
    });
  },

  // --- Filter Actions ---

  setSearch: (text: string) => {
    const { criteria, _nodes } = get();
    const next: FilterCriteria = { ...criteria, searchText: text };
    const matchedIds = computeMatchedIds(_nodes, next);
    set({
      criteria: next,
      matchedIds,
      isActive: isFilterActive(next),
    });
  },

  setNodeTypeFilter: (types: string[]) => {
    const { criteria, _nodes } = get();
    const next: FilterCriteria = {
      ...criteria,
      nodeTypes: types.length > 0 ? types : undefined,
    };
    const matchedIds = computeMatchedIds(_nodes, next);
    set({
      criteria: next,
      matchedIds,
      isActive: isFilterActive(next),
    });
  },

  setEnergyRange: (min: number, max: number) => {
    const { criteria, _nodes } = get();
    const next: FilterCriteria = {
      ...criteria,
      energyRange: [min, max],
    };
    const matchedIds = computeMatchedIds(_nodes, next);
    set({
      criteria: next,
      matchedIds,
      isActive: isFilterActive(next),
    });
  },

  setCustomFilter: (fn: ((node: any) => boolean) | undefined) => {
    const { criteria, _nodes } = get();
    const next: FilterCriteria = { ...criteria, customFilter: fn };
    const matchedIds = computeMatchedIds(_nodes, next);
    set({
      criteria: next,
      matchedIds,
      isActive: isFilterActive(next),
    });
  },

  resetFilters: () => {
    const { _nodes } = get();
    const next: FilterCriteria = {};
    const matchedIds = computeMatchedIds(_nodes, next);
    set({
      criteria: next,
      matchedIds,
      isActive: false,
    });
  },
}));
