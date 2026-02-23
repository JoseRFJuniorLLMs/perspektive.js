/**
 * arrows.ts -- Arrow Head Geometry Generation (Pure Math)
 *
 * Computes the three vertices of an equilateral arrow-head triangle at any
 * position along a polyline path. Works correctly on curved edges (geodesics,
 * Bezier curves, arcs) by deriving the tangent from neighboring sample points.
 *
 * No React, no Three.js runtime -- only pure TypeScript math.
 */

import type { Vec3, ArrowHeadVertices } from './types';

/**
 * Linearly interpolate between two 3D points.
 *
 * @param a - Start point
 * @param b - End point
 * @param t - Interpolation factor [0, 1]
 * @returns Interpolated point
 */
function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/**
 * Compute the Euclidean distance between two 3D points.
 *
 * @param a - First point
 * @param b - Second point
 * @returns Distance
 */
function dist3(a: Vec3, b: Vec3): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Normalize a 3D vector to unit length.
 * Returns a zero vector if the input has zero length.
 *
 * @param v - Input vector
 * @returns Normalized vector
 */
function normalize3(v: Vec3): Vec3 {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (len < 1e-10) return [0, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

/**
 * Compute the cross product of two 3D vectors.
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Cross product a x b
 */
function cross3(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/**
 * Compute cumulative arc-length distances for a polyline.
 * The first entry is 0, the last entry is the total arc length.
 *
 * @param points - Polyline vertices
 * @returns Array of cumulative distances (same length as points)
 */
function cumulativeArcLengths(points: Vec3[]): number[] {
  const lengths: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    lengths.push(lengths[i - 1] + dist3(points[i - 1], points[i]));
  }
  return lengths;
}

/**
 * Sample a point at a fractional position along a polyline using arc-length
 * parameterization. Also returns the index of the segment containing that point.
 *
 * @param points - Polyline vertices
 * @param lengths - Cumulative arc lengths (from cumulativeArcLengths)
 * @param t - Position along the polyline [0, 1]
 * @returns Object with the sampled point and the segment index
 */
function sampleAtArcLength(
  points: Vec3[],
  lengths: number[],
  t: number,
): { point: Vec3; segmentIndex: number } {
  const totalLength = lengths[lengths.length - 1];
  const targetLength = Math.max(0, Math.min(1, t)) * totalLength;

  // Find the segment containing targetLength via binary search
  let lo = 0;
  let hi = lengths.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (lengths[mid] <= targetLength) lo = mid;
    else hi = mid;
  }

  const segStart = lengths[lo];
  const segEnd = lengths[hi];
  const segLength = segEnd - segStart;
  const localT = segLength > 1e-10 ? (targetLength - segStart) / segLength : 0;

  return {
    point: lerp3(points[lo], points[hi], localT),
    segmentIndex: lo,
  };
}

/**
 * Calculate the tangent direction at a given position along a polyline.
 * Uses the two nearest sample points to derive the tangent, which handles
 * curved edges (geodesics, Bezier, arcs) naturally.
 *
 * @param points - Polyline vertices (at least 2)
 * @param lengths - Cumulative arc lengths
 * @param t - Position along the polyline [0, 1]
 * @returns Normalized tangent vector pointing in the direction of travel
 */
function tangentAt(points: Vec3[], lengths: number[], t: number): Vec3 {
  const totalLength = lengths[lengths.length - 1];
  if (totalLength < 1e-10 || points.length < 2) return [1, 0, 0];

  // Sample two nearby points to get a finite-difference tangent
  const epsilon = Math.min(0.01, 0.5 / points.length);
  const tA = Math.max(0, t - epsilon);
  const tB = Math.min(1, t + epsilon);

  const pA = sampleAtArcLength(points, lengths, tA).point;
  const pB = sampleAtArcLength(points, lengths, tB).point;

  const tangent: Vec3 = [pB[0] - pA[0], pB[1] - pA[1], pB[2] - pA[2]];
  return normalize3(tangent);
}

/**
 * Calculate arrow head triangle vertices at a given position along a polyline.
 *
 * The arrow is an equilateral triangle with its tip pointing along the tangent
 * direction at the specified position. The triangle lies in the plane perpendicular
 * to a reference "up" vector (defaults to Z-axis, falls back to Y-axis for
 * edges aligned with Z).
 *
 * @param points - Polyline vertices defining the edge path (minimum 2 points)
 * @param position - Fractional position along the edge [0, 1] where:
 *   - 0 = at the source node
 *   - 0.5 = at the midpoint
 *   - 1 = at the target node (default arrow placement for directed edges)
 * @param size - Size of the arrow head triangle (world units, default 0.02)
 * @returns Arrow head vertices: tip, left wing, and right wing
 *
 * @example
 * ```ts
 * const path = straightLine([0,0,0], [1,0,0], 10);
 * const arrow = calculateArrowHead(path, 1.0, 0.02);
 * // arrow.tip is at the end of the path
 * // arrow.left and arrow.right form the base of the triangle
 * ```
 */
export function calculateArrowHead(
  points: Vec3[],
  position: number = 1.0,
  size: number = 0.02,
): ArrowHeadVertices {
  if (points.length < 2) {
    return { tip: [0, 0, 0], left: [0, 0, 0], right: [0, 0, 0] };
  }

  const lengths = cumulativeArcLengths(points);
  const { point: anchorPoint } = sampleAtArcLength(points, lengths, position);
  const tangent = tangentAt(points, lengths, position);

  // Find a perpendicular vector.
  // Default "up" is Z-axis; if the tangent is nearly parallel to Z, use Y instead.
  let up: Vec3 = [0, 0, 1];
  const dotWithZ = Math.abs(tangent[0] * up[0] + tangent[1] * up[1] + tangent[2] * up[2]);
  if (dotWithZ > 0.95) {
    up = [0, 1, 0];
  }

  // Perpendicular vector in the plane of the edge
  let perp = cross3(tangent, up);
  perp = normalize3(perp);

  // If cross product is degenerate (edge lies exactly in the up plane),
  // use a secondary perpendicular
  const perpLen = Math.sqrt(perp[0] * perp[0] + perp[1] * perp[1] + perp[2] * perp[2]);
  if (perpLen < 1e-10) {
    perp = normalize3(cross3(tangent, [1, 0, 0]));
  }

  // Arrow tip: slightly ahead of the anchor point along the tangent
  const tip: Vec3 = [
    anchorPoint[0] + tangent[0] * size * 0.5,
    anchorPoint[1] + tangent[1] * size * 0.5,
    anchorPoint[2] + tangent[2] * size * 0.5,
  ];

  // Arrow base: behind the tip, with left/right wings spread perpendicular
  const baseCenter: Vec3 = [
    anchorPoint[0] - tangent[0] * size * 0.5,
    anchorPoint[1] - tangent[1] * size * 0.5,
    anchorPoint[2] - tangent[2] * size * 0.5,
  ];

  const halfWidth = size * 0.5;

  const left: Vec3 = [
    baseCenter[0] + perp[0] * halfWidth,
    baseCenter[1] + perp[1] * halfWidth,
    baseCenter[2] + perp[2] * halfWidth,
  ];

  const right: Vec3 = [
    baseCenter[0] - perp[0] * halfWidth,
    baseCenter[1] - perp[1] * halfWidth,
    baseCenter[2] - perp[2] * halfWidth,
  ];

  return { tip, left, right };
}

/**
 * Calculate arrow heads for a bidirectional edge.
 * Returns two arrow head vertex sets: one at the target end and one at the source end.
 *
 * @param points - Polyline vertices defining the edge path
 * @param size - Size of each arrow head triangle (world units)
 * @returns Tuple of [forward arrow (at target), backward arrow (at source)]
 *
 * @example
 * ```ts
 * const [fwd, bwd] = calculateBidirectionalArrows(path, 0.02);
 * ```
 */
export function calculateBidirectionalArrows(
  points: Vec3[],
  size: number = 0.02,
): [ArrowHeadVertices, ArrowHeadVertices] {
  const forward = calculateArrowHead(points, 0.85, size);

  // For the backward arrow, reverse the points so the tangent is flipped
  const reversed = [...points].reverse();
  const backward = calculateArrowHead(reversed, 0.85, size);

  return [forward, backward];
}

/**
 * Get the position (3D point) at a fractional distance along a polyline.
 * Useful for positioning labels, decorators, or other overlays on an edge.
 *
 * @param points - Polyline vertices
 * @param t - Fractional position [0, 1]
 * @returns The 3D point at that position
 */
export function getPointAlongPath(points: Vec3[], t: number): Vec3 {
  if (points.length === 0) return [0, 0, 0];
  if (points.length === 1) return points[0];

  const lengths = cumulativeArcLengths(points);
  return sampleAtArcLength(points, lengths, t).point;
}

/**
 * Get the tangent direction at a fractional distance along a polyline.
 * Useful for orienting labels or decorators to follow the edge curvature.
 *
 * @param points - Polyline vertices
 * @param t - Fractional position [0, 1]
 * @returns Normalized tangent vector
 */
export function getTangentAlongPath(points: Vec3[], t: number): Vec3 {
  if (points.length < 2) return [1, 0, 0];

  const lengths = cumulativeArcLengths(points);
  return tangentAt(points, lengths, t);
}
