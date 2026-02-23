/**
 * SpatialIndex.ts — Grid-based spatial index for perspektive.js
 *
 * Divides 2D world space into an NxN grid for O(1) spatial queries.
 * Optimized for the common case in graph visualization: most nodes
 * don't move most frames, and the working space is bounded (Poincare
 * disk = [-1, 1], other manifolds slightly wider).
 *
 * This is deliberately a fixed grid rather than a quadtree — simpler,
 * faster for the roughly-uniform distributions produced by hyperbolic
 * embeddings, and trivially supports the viewport-query pattern.
 *
 * @module streaming/SpatialIndex
 */

import type { ViewportBounds } from './types';

// ---------------------------------------------------------------------------
// Internal Types
// ---------------------------------------------------------------------------

/** Stored position for a tracked node. */
interface NodePosition {
  x: number;
  y: number;
  /** Grid cell index (row * gridSize + col). */
  cellIndex: number;
}

// ---------------------------------------------------------------------------
// SpatialIndex Class
// ---------------------------------------------------------------------------

/**
 * A fixed-resolution grid index over 2D space.
 *
 * The grid covers the range [minBound, maxBound] in both X and Y.
 * Nodes outside this range are clamped to the boundary cells.
 *
 * @example
 * ```ts
 * const idx = new SpatialIndex(32, -1.5, 1.5);
 * idx.insert('node-1', 0.3, -0.4);
 * idx.insert('node-2', 0.31, -0.39);
 * const visible = idx.query({ minX: 0, maxX: 0.5, minY: -0.5, maxY: 0, zoom: 1 });
 * // visible contains both 'node-1' and 'node-2'
 * ```
 */
export class SpatialIndex {
  /** Number of cells per axis. Total cells = gridSize * gridSize. */
  private readonly gridSize: number;

  /** Lower bound of the indexed space (both X and Y). */
  private readonly minBound: number;

  /** Width/height of a single grid cell. */
  private readonly cellSize: number;

  /** Inverse of cellSize for fast coordinate-to-cell math. */
  private readonly invCellSize: number;

  /**
   * Grid cells: each cell is a Set of node IDs.
   * Indexed as cells[row * gridSize + col].
   */
  private readonly cells: Set<string>[];

  /** Node ID -> position + cell index. O(1) lookup for move/remove. */
  private readonly positions: Map<string, NodePosition>;

  /**
   * Create a new SpatialIndex.
   *
   * @param gridSize - Number of cells per axis (default 32 = 1024 total cells).
   * @param minBound - Lower bound of indexed space (default -1.5, covers Poincare + margin).
   * @param maxBound - Upper bound of indexed space (default 1.5).
   */
  constructor(gridSize = 32, minBound = -1.5, maxBound = 1.5) {
    this.gridSize = gridSize;
    this.minBound = minBound;

    const range = maxBound - minBound;
    this.cellSize = range / gridSize;
    this.invCellSize = gridSize / range;

    // Pre-allocate all cells as empty Sets
    const totalCells = gridSize * gridSize;
    this.cells = new Array(totalCells);
    for (let i = 0; i < totalCells; i++) {
      this.cells[i] = new Set();
    }

    this.positions = new Map();
  }

  // -----------------------------------------------------------------------
  // Coordinate -> Cell mapping
  // -----------------------------------------------------------------------

  /**
   * Convert a world-space coordinate to a grid cell index along one axis.
   * Clamps to [0, gridSize - 1].
   */
  private coordToCell(v: number): number {
    const normalized = (v - this.minBound) * this.invCellSize;
    if (normalized < 0) return 0;
    if (normalized >= this.gridSize) return this.gridSize - 1;
    return normalized | 0; // Fast floor via bitwise OR
  }

  /**
   * Compute the flat cell index from world coordinates.
   */
  private getCellIndex(x: number, y: number): number {
    const col = this.coordToCell(x);
    const row = this.coordToCell(y);
    return row * this.gridSize + col;
  }

  // -----------------------------------------------------------------------
  // Mutation Operations
  // -----------------------------------------------------------------------

  /**
   * Insert a node into the spatial index.
   * If the node already exists, it is moved to the new position.
   *
   * @param id - Unique node identifier.
   * @param x - World X coordinate.
   * @param y - World Y coordinate.
   */
  insert(id: string, x: number, y: number): void {
    const existing = this.positions.get(id);
    if (existing !== undefined) {
      // Already tracked — delegate to move
      this.move(id, x, y);
      return;
    }

    const cellIndex = this.getCellIndex(x, y);
    this.cells[cellIndex].add(id);
    this.positions.set(id, { x, y, cellIndex });
  }

  /**
   * Remove a node from the spatial index.
   * No-op if the node is not tracked.
   *
   * @param id - Unique node identifier.
   */
  remove(id: string): void {
    const pos = this.positions.get(id);
    if (pos === undefined) return;

    this.cells[pos.cellIndex].delete(id);
    this.positions.delete(id);
  }

  /**
   * Move a node to a new position.
   * Only updates the grid cell assignment if the node crossed a cell boundary.
   *
   * @param id - Unique node identifier.
   * @param newX - New world X coordinate.
   * @param newY - New world Y coordinate.
   */
  move(id: string, newX: number, newY: number): void {
    const pos = this.positions.get(id);
    if (pos === undefined) {
      // Not tracked yet — insert instead
      this.insert(id, newX, newY);
      return;
    }

    const newCellIndex = this.getCellIndex(newX, newY);

    // Only touch the grid sets if the cell actually changed
    if (newCellIndex !== pos.cellIndex) {
      this.cells[pos.cellIndex].delete(id);
      this.cells[newCellIndex].add(id);
      pos.cellIndex = newCellIndex;
    }

    pos.x = newX;
    pos.y = newY;
  }

  // -----------------------------------------------------------------------
  // Query Operations
  // -----------------------------------------------------------------------

  /**
   * Find all node IDs within a rectangular viewport.
   *
   * Iterates only over grid cells that overlap the query bounds,
   * then performs exact point-in-rectangle checks on candidates.
   *
   * @param bounds - Axis-aligned bounding box in world coordinates.
   * @returns Set of node IDs that fall within the bounds.
   */
  query(bounds: ViewportBounds): Set<string> {
    const result = new Set<string>();

    const colMin = this.coordToCell(bounds.minX);
    const colMax = this.coordToCell(bounds.maxX);
    const rowMin = this.coordToCell(bounds.minY);
    const rowMax = this.coordToCell(bounds.maxY);

    for (let row = rowMin; row <= rowMax; row++) {
      const rowOffset = row * this.gridSize;
      for (let col = colMin; col <= colMax; col++) {
        const cell = this.cells[rowOffset + col];
        if (cell.size === 0) continue;

        // If the cell is entirely inside the bounds, add all nodes without checks
        const cellLeft = this.minBound + col * this.cellSize;
        const cellRight = cellLeft + this.cellSize;
        const cellBottom = this.minBound + row * this.cellSize;
        const cellTop = cellBottom + this.cellSize;

        const fullyInside =
          cellLeft >= bounds.minX &&
          cellRight <= bounds.maxX &&
          cellBottom >= bounds.minY &&
          cellTop <= bounds.maxY;

        if (fullyInside) {
          // Bulk add — no per-node checks needed
          for (const id of cell) {
            result.add(id);
          }
        } else {
          // Boundary cell — check each node's exact position
          for (const id of cell) {
            const pos = this.positions.get(id)!;
            if (
              pos.x >= bounds.minX &&
              pos.x <= bounds.maxX &&
              pos.y >= bounds.minY &&
              pos.y <= bounds.maxY
            ) {
              result.add(id);
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Find all node IDs within a circular radius from a center point.
   *
   * Uses the bounding box of the circle to select candidate cells,
   * then performs exact distance checks.
   *
   * @param cx - Center X in world coordinates.
   * @param cy - Center Y in world coordinates.
   * @param r - Radius of the query circle.
   * @returns Set of node IDs within the radius.
   */
  queryRadius(cx: number, cy: number, r: number): Set<string> {
    const result = new Set<string>();
    const r2 = r * r;

    const colMin = this.coordToCell(cx - r);
    const colMax = this.coordToCell(cx + r);
    const rowMin = this.coordToCell(cy - r);
    const rowMax = this.coordToCell(cy + r);

    for (let row = rowMin; row <= rowMax; row++) {
      const rowOffset = row * this.gridSize;
      for (let col = colMin; col <= colMax; col++) {
        const cell = this.cells[rowOffset + col];
        if (cell.size === 0) continue;

        for (const id of cell) {
          const pos = this.positions.get(id)!;
          const dx = pos.x - cx;
          const dy = pos.y - cy;
          if (dx * dx + dy * dy <= r2) {
            result.add(id);
          }
        }
      }
    }

    return result;
  }

  // -----------------------------------------------------------------------
  // Bulk Operations
  // -----------------------------------------------------------------------

  /**
   * Clear all tracked nodes and reset all cells.
   * Use this before a full rebuild (e.g., after a resync).
   */
  clear(): void {
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i].clear();
    }
    this.positions.clear();
  }

  /**
   * Rebuild the entire index from a map of node positions.
   * More efficient than individual insert() calls for bulk operations
   * because it clears first and avoids per-node existence checks.
   *
   * @param nodes - Map of node ID to { x, y } position.
   */
  rebuild(nodes: Map<string, { x: number; y: number }>): void {
    this.clear();

    for (const [id, pos] of nodes) {
      const cellIndex = this.getCellIndex(pos.x, pos.y);
      this.cells[cellIndex].add(id);
      this.positions.set(id, { x: pos.x, y: pos.y, cellIndex });
    }
  }

  // -----------------------------------------------------------------------
  // Diagnostics
  // -----------------------------------------------------------------------

  /** Total number of nodes currently tracked. */
  get size(): number {
    return this.positions.size;
  }

  /**
   * Get the position of a tracked node.
   * @returns The node's position or undefined if not tracked.
   */
  getPosition(id: string): { x: number; y: number } | undefined {
    const pos = this.positions.get(id);
    if (pos === undefined) return undefined;
    return { x: pos.x, y: pos.y };
  }

  /**
   * Return distribution statistics for diagnostics.
   * Useful for tuning the grid resolution.
   */
  getDistribution(): { emptyCells: number; maxCellSize: number; avgCellSize: number } {
    let emptyCells = 0;
    let maxCellSize = 0;
    let totalOccupied = 0;
    let occupiedCount = 0;

    for (let i = 0; i < this.cells.length; i++) {
      const s = this.cells[i].size;
      if (s === 0) {
        emptyCells++;
      } else {
        if (s > maxCellSize) maxCellSize = s;
        totalOccupied += s;
        occupiedCount++;
      }
    }

    return {
      emptyCells,
      maxCellSize,
      avgCellSize: occupiedCount > 0 ? totalOccupied / occupiedCount : 0,
    };
  }
}
