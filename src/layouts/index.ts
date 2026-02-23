/**
 * Layout Algorithms for perspektive.js
 *
 * A collection of pure-TypeScript graph layout algorithms designed for
 * hyperbolic geometry visualization. All layouts produce coordinates in
 * the [-1, 1] range, compatible with the Poincare disk model.
 *
 * Available layouts:
 * - `force`      — Fruchterman-Reingold force-directed (physics simulation)
 * - `tree`       — Reingold-Tilford hierarchical tree
 * - `radial`     — Concentric rings from a central root (subtree-proportional)
 * - `grid`       — Regular grid placement (sorted by property)
 * - `concentric` — Concentric circles grouped by category or rank
 *
 * @example
 * ```ts
 * import { getLayout, forceLayout } from '@nietzsche/perspektive/layouts';
 *
 * // Direct usage
 * forceLayout.run(nodes, edges, { iterations: 500 });
 *
 * // Registry lookup
 * const layout = getLayout('tree');
 * layout.run(nodes, edges, { orientation: 'LR' });
 * ```
 */

// Types
export type { LayoutNode, LayoutEdge, LayoutOptions, Layout } from './types';

// Layouts
export { forceLayout } from './force';
export type { ForceLayoutOptions } from './force';

export { treeLayout } from './tree';
export type { TreeLayoutOptions, TreeOrientation } from './tree';

export { radialLayout } from './radial';
export type { RadialLayoutOptions } from './radial';

export { gridLayout } from './grid';
export type { GridLayoutOptions } from './grid';

export { concentricLayout } from './concentric';
export type { ConcentricLayoutOptions } from './concentric';

// --- Layout Registry ---

import type { Layout } from './types';
import { forceLayout } from './force';
import { treeLayout } from './tree';
import { radialLayout } from './radial';
import { gridLayout } from './grid';
import { concentricLayout } from './concentric';

/** Registry of all built-in layout algorithms, keyed by name. */
const layoutRegistry = new Map<string, Layout>([
  ['force', forceLayout],
  ['tree', treeLayout],
  ['radial', radialLayout],
  ['grid', gridLayout],
  ['concentric', concentricLayout],
]);

/**
 * Retrieve a layout algorithm by name.
 *
 * @param name - The name of the layout ('force', 'tree', 'radial', 'grid', 'concentric').
 * @returns The Layout implementation.
 * @throws Error if the layout name is not registered.
 *
 * @example
 * ```ts
 * const layout = getLayout('force');
 * layout.run(nodes, edges, { iterations: 300 });
 * ```
 */
export function getLayout(name: string): Layout {
  const layout = layoutRegistry.get(name);
  if (!layout) {
    const available = Array.from(layoutRegistry.keys()).join(', ');
    throw new Error(
      `Unknown layout "${name}". Available layouts: ${available}`
    );
  }
  return layout;
}

/**
 * Register a custom layout algorithm in the global registry.
 *
 * @param layout - A Layout implementation with a unique `name` property.
 *
 * @example
 * ```ts
 * registerLayout({
 *   name: 'myCustomLayout',
 *   run(nodes, edges, options) {
 *     // ... custom positioning logic ...
 *     return nodes;
 *   },
 * });
 * ```
 */
export function registerLayout(layout: Layout): void {
  layoutRegistry.set(layout.name, layout);
}

/**
 * Get a list of all registered layout names.
 *
 * @returns Array of layout name strings.
 */
export function getLayoutNames(): string[] {
  return Array.from(layoutRegistry.keys());
}
