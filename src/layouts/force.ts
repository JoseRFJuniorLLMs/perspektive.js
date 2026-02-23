/**
 * Force-Directed Layout — Fruchterman-Reingold Algorithm
 *
 * Positions nodes using an iterative physics simulation:
 * - Repulsive force between ALL node pairs: Fr = k^2 / d
 * - Attractive force along edges: Fa = d^2 / k
 * - Temperature cooling (simulated annealing) for convergence
 *
 * Supports optional Poincare disk clamping (||pos|| < 0.99) so that
 * results can be rendered directly on the hyperbolic disk.
 */

import type { Layout, LayoutNode, LayoutEdge, LayoutOptions } from './types';

/** Extended options specific to the force-directed layout. */
export interface ForceLayoutOptions extends LayoutOptions {
  /** Ideal edge length scaling constant C. Default: 1.0 */
  idealLengthScale?: number;
  /** Whether to clamp node positions inside the Poincare disk (||pos|| < 0.99). Default: true */
  hyperbolicClamp?: boolean;
  /** Poincare disk radius limit. Default: 0.99 */
  diskRadius?: number;
  /** Initial temperature (max displacement per iteration). Default: 0.1 */
  initialTemperature?: number;
  /** Minimum temperature threshold to stop early. Default: 0.001 */
  minTemperature?: number;
  /** Gravity constant pulling all nodes toward the origin. Default: 0.01 */
  gravity?: number;
}

/** Default number of iterations for the force simulation. */
const DEFAULT_ITERATIONS = 300;

/** Default Poincare disk boundary radius. */
const DEFAULT_DISK_RADIUS = 0.99;

/** Small epsilon to prevent division by zero. */
const EPSILON = 1e-6;

/**
 * Assign initial positions to nodes that lack coordinates.
 * Uses a deterministic spread based on index to avoid clumping.
 */
function initializePositions(nodes: LayoutNode[]): void {
  const n = nodes.length;
  for (let i = 0; i < n; i++) {
    if (nodes[i].x === undefined || nodes[i].x === null || isNaN(nodes[i].x!)) {
      // Sunflower seed pattern for even disk distribution
      const angle = i * 2.399963; // golden angle in radians
      const r = 0.5 * Math.sqrt((i + 0.5) / n);
      nodes[i].x = r * Math.cos(angle);
      nodes[i].y = r * Math.sin(angle);
    }
    if (nodes[i].y === undefined || nodes[i].y === null || isNaN(nodes[i].y!)) {
      nodes[i].y = 0;
    }
  }
}

/**
 * Clamp a position vector so that ||pos|| < maxRadius.
 * When the node is outside the disk, it is projected back onto the boundary.
 */
function clampToDisk(x: number, y: number, maxRadius: number): { x: number; y: number } {
  const norm = Math.sqrt(x * x + y * y);
  if (norm > maxRadius) {
    const scale = maxRadius / norm;
    return { x: x * scale, y: y * scale };
  }
  return { x, y };
}

/**
 * Apply bounding box constraints to a position.
 */
function clampToBox(
  x: number,
  y: number,
  box: { x1: number; y1: number; x2: number; y2: number }
): { x: number; y: number } {
  return {
    x: Math.max(box.x1, Math.min(box.x2, x)),
    y: Math.max(box.y1, Math.min(box.y2, y)),
  };
}

/**
 * Run the Fruchterman-Reingold force-directed layout algorithm.
 *
 * @param nodes - Array of nodes to position (mutated in place).
 * @param edges - Array of edges defining connectivity.
 * @param options - Configuration for the simulation.
 * @returns The input node array with updated x/y coordinates.
 */
function run(nodes: LayoutNode[], edges: LayoutEdge[], options?: ForceLayoutOptions): LayoutNode[] {
  if (nodes.length === 0) return nodes;

  const iterations = options?.iterations ?? DEFAULT_ITERATIONS;
  const C = options?.idealLengthScale ?? 1.0;
  const hyperbolicClamp = options?.hyperbolicClamp ?? true;
  const diskRadius = options?.diskRadius ?? DEFAULT_DISK_RADIUS;
  const gravity = options?.gravity ?? 0.01;
  const minTemp = options?.minTemperature ?? 0.001;
  const boundingBox = options?.boundingBox;
  const onTick = options?.animate ? options.onTick : undefined;
  const onComplete = options?.onComplete;

  const n = nodes.length;

  // Initialize positions for nodes that don't have them yet
  initializePositions(nodes);

  // Compute area — if we have a bounding box use that, otherwise use the disk area
  let area: number;
  if (boundingBox) {
    area = (boundingBox.x2 - boundingBox.x1) * (boundingBox.y2 - boundingBox.y1);
  } else {
    area = Math.PI * diskRadius * diskRadius;
  }

  // Optimal pairwise distance: k = C * sqrt(area / N)
  const k = C * Math.sqrt(area / Math.max(n, 1));
  const k2 = k * k;

  // Temperature starts proportional to the layout size and cools linearly
  let temperature = options?.initialTemperature ?? Math.max(0.1, k * 2);

  // Build adjacency lookup for fast edge iteration
  const edgeMap = new Map<string, number>();
  for (const edge of edges) {
    edgeMap.set(`${edge.source}:${edge.target}`, edge.weight ?? 1);
    edgeMap.set(`${edge.target}:${edge.source}`, edge.weight ?? 1);
  }

  // Build edge list with resolved indices
  const edgeIndices: { si: number; ti: number; w: number }[] = [];
  const idToIndex = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    idToIndex.set(nodes[i].id, i);
  }
  for (const edge of edges) {
    const si = idToIndex.get(edge.source);
    const ti = idToIndex.get(edge.target);
    if (si !== undefined && ti !== undefined) {
      edgeIndices.push({ si, ti, w: edge.weight ?? 1 });
    }
  }

  // Displacement vectors (reused across iterations)
  const dx = new Float64Array(n);
  const dy = new Float64Array(n);

  // Main simulation loop
  for (let iter = 0; iter < iterations; iter++) {
    // Reset displacements
    dx.fill(0);
    dy.fill(0);

    // --- Repulsive forces: every pair of nodes ---
    for (let i = 0; i < n; i++) {
      const xi = nodes[i].x!;
      const yi = nodes[i].y!;
      const mi = nodes[i].mass ?? 1;

      for (let j = i + 1; j < n; j++) {
        const xj = nodes[j].x!;
        const yj = nodes[j].y!;
        const mj = nodes[j].mass ?? 1;

        let deltaX = xi - xj;
        let deltaY = yi - yj;
        const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY) + EPSILON;

        // Fruchterman-Reingold repulsive: Fr = k^2 / d
        // Scale by the product of masses for weighted repulsion
        const force = (k2 / dist) * Math.sqrt(mi * mj);
        const fx = (deltaX / dist) * force;
        const fy = (deltaY / dist) * force;

        dx[i] += fx;
        dy[i] += fy;
        dx[j] -= fx;
        dy[j] -= fy;
      }
    }

    // --- Attractive forces: along edges ---
    for (const { si, ti, w } of edgeIndices) {
      const deltaX = nodes[si].x! - nodes[ti].x!;
      const deltaY = nodes[si].y! - nodes[ti].y!;
      const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY) + EPSILON;

      // Fruchterman-Reingold attractive: Fa = d^2 / k, scaled by weight
      const force = (dist * dist / k) * w;
      const fx = (deltaX / dist) * force;
      const fy = (deltaY / dist) * force;

      dx[si] -= fx;
      dy[si] -= fy;
      dx[ti] += fx;
      dy[ti] += fy;
    }

    // --- Gravity: gentle pull toward the origin ---
    if (gravity > 0) {
      for (let i = 0; i < n; i++) {
        const xi = nodes[i].x!;
        const yi = nodes[i].y!;
        const dist = Math.sqrt(xi * xi + yi * yi) + EPSILON;
        dx[i] -= gravity * xi * dist;
        dy[i] -= gravity * yi * dist;
      }
    }

    // --- Apply displacements, limited by temperature ---
    for (let i = 0; i < n; i++) {
      if (nodes[i].fixed) continue;

      const dispX = dx[i];
      const dispY = dy[i];
      const dispNorm = Math.sqrt(dispX * dispX + dispY * dispY) + EPSILON;

      // Limit displacement to temperature
      const limitedScale = Math.min(dispNorm, temperature) / dispNorm;
      let newX = nodes[i].x! + dispX * limitedScale;
      let newY = nodes[i].y! + dispY * limitedScale;

      // Clamp to Poincare disk
      if (hyperbolicClamp) {
        const clamped = clampToDisk(newX, newY, diskRadius);
        newX = clamped.x;
        newY = clamped.y;
      }

      // Clamp to bounding box
      if (boundingBox) {
        const clamped = clampToBox(newX, newY, boundingBox);
        newX = clamped.x;
        newY = clamped.y;
      }

      nodes[i].x = newX;
      nodes[i].y = newY;
    }

    // --- Cool temperature (linear annealing) ---
    temperature *= 1 - (iter + 1) / iterations;
    if (temperature < minTemp) temperature = minTemp;

    // --- Tick callback for animated rendering ---
    if (onTick) {
      onTick(nodes);
    }
  }

  if (onComplete) {
    onComplete(nodes);
  }

  return nodes;
}

/**
 * Fruchterman-Reingold force-directed layout.
 *
 * Simulates physical forces — repulsion between all node pairs and attraction along edges —
 * to produce an aesthetically pleasing arrangement. Supports Poincare disk clamping,
 * gravity toward the origin, and weighted edges/masses.
 *
 * @example
 * ```ts
 * import { forceLayout } from '@nietzsche/perspektive/layouts';
 *
 * const positioned = forceLayout.run(nodes, edges, {
 *   iterations: 500,
 *   hyperbolicClamp: true,
 * });
 * ```
 */
export const forceLayout: Layout = {
  name: 'force',
  run,
};
