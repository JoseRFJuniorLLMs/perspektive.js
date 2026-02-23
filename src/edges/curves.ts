/**
 * curves.ts -- Curve Generation for Edge Paths (Pure Math)
 *
 * Provides multiple curve generation strategies for edges:
 *   - straightLine: Linear interpolation between two points
 *   - bezierCurve: Quadratic Bezier with perpendicular control point offset
 *   - arcCurve: Circular arc between two endpoints
 *   - selfLoop: Teardrop/loop shape emanating from and returning to a node
 *   - bundleEdges: Group parallel edges and offset them to avoid overlap
 *
 * All functions return Vec3[] arrays ([number, number, number][]) directly
 * compatible with Three.js and the @react-three/drei <Line> component.
 *
 * No React or Three.js runtime dependencies -- pure TypeScript math.
 */

import type { Vec3, AdvancedEdgeData } from './types';

/**
 * Generate a straight line between two 3D points with evenly spaced samples.
 *
 * @param p1 - Start point [x, y, z]
 * @param p2 - End point [x, y, z]
 * @param segments - Number of line segments (default 1, meaning 2 points)
 * @returns Array of 3D points forming the straight line
 *
 * @example
 * ```ts
 * const pts = straightLine([0, 0, 0], [1, 1, 0], 10);
 * // 11 evenly spaced points from origin to (1,1,0)
 * ```
 */
export function straightLine(
  p1: Vec3,
  p2: Vec3,
  segments: number = 1,
): Vec3[] {
  const count = Math.max(segments, 1);
  const points: Vec3[] = [];

  for (let i = 0; i <= count; i++) {
    const t = i / count;
    points.push([
      p1[0] + (p2[0] - p1[0]) * t,
      p1[1] + (p2[1] - p1[1]) * t,
      p1[2] + (p2[2] - p1[2]) * t,
    ]);
  }

  return points;
}

/**
 * Generate a quadratic Bezier curve between two 3D points.
 * The control point is offset perpendicular to the straight line between p1 and p2,
 * creating a smooth outward bow. The curvature parameter controls how far the
 * control point is displaced.
 *
 * @param p1 - Start point [x, y, z]
 * @param p2 - End point [x, y, z]
 * @param curvature - Perpendicular offset as a fraction of the edge length
 *   (default 0.3). Positive values bow "left" (relative to the direction p1->p2),
 *   negative values bow "right".
 * @param segments - Number of curve segments (default 32)
 * @returns Array of 3D points forming the Bezier curve
 *
 * @example
 * ```ts
 * const pts = bezierCurve([0, 0, 0], [1, 0, 0], 0.3, 32);
 * // Smooth arc bowing upward (in Z=0 plane, bows in +Y direction)
 * ```
 */
export function bezierCurve(
  p1: Vec3,
  p2: Vec3,
  curvature: number = 0.3,
  segments: number = 32,
): Vec3[] {
  // Midpoint between p1 and p2
  const mid: Vec3 = [
    (p1[0] + p2[0]) * 0.5,
    (p1[1] + p2[1]) * 0.5,
    (p1[2] + p2[2]) * 0.5,
  ];

  // Direction vector from p1 to p2
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const dz = p2[2] - p1[2];
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (length < 1e-10) {
    return [p1, p2];
  }

  // Find a perpendicular vector.
  // For edges mostly in the XY plane (z ~ constant), perpendicular is (-dy, dx, 0).
  // For general 3D, we cross the direction with a reference axis.
  let perp: Vec3;
  const dirNorm: Vec3 = [dx / length, dy / length, dz / length];

  // Check if the edge is mostly in the XY plane (common for Poincare/Emotion modes)
  if (Math.abs(dz) < length * 0.9) {
    // Perpendicular in the XY plane: rotate direction 90 degrees
    perp = [-dy / length, dx / length, 0];
  } else {
    // 3D case: cross product with X-axis
    const cross: Vec3 = [
      dirNorm[1] * 0 - dirNorm[2] * 0,
      dirNorm[2] * 1 - dirNorm[0] * 0,
      dirNorm[0] * 0 - dirNorm[1] * 1,
    ];
    const crossLen = Math.sqrt(cross[0] ** 2 + cross[1] ** 2 + cross[2] ** 2);
    if (crossLen < 1e-10) {
      // Direction is parallel to X-axis, use Y-axis as reference
      perp = [0, 1, 0];
    } else {
      perp = [cross[0] / crossLen, cross[1] / crossLen, cross[2] / crossLen];
    }
  }

  // Control point: midpoint + perpendicular offset
  const offset = curvature * length;
  const cp: Vec3 = [
    mid[0] + perp[0] * offset,
    mid[1] + perp[1] * offset,
    mid[2] + perp[2] * offset,
  ];

  // Evaluate quadratic Bezier: B(t) = (1-t)^2 * P0 + 2(1-t)t * CP + t^2 * P1
  const points: Vec3[] = [];
  const count = Math.max(segments, 2);

  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const u = 1 - t;
    points.push([
      u * u * p1[0] + 2 * u * t * cp[0] + t * t * p2[0],
      u * u * p1[1] + 2 * u * t * cp[1] + t * t * p2[1],
      u * u * p1[2] + 2 * u * t * cp[2] + t * t * p2[2],
    ]);
  }

  return points;
}

/**
 * Generate a circular arc between two 3D points.
 * The arc bows outward perpendicular to the straight line, similar to bezierCurve
 * but following a true circular path. The curvature controls the arc's "bulge".
 *
 * @param p1 - Start point [x, y, z]
 * @param p2 - End point [x, y, z]
 * @param curvature - How much the arc bows outward. 0 = straight line,
 *   1 = semicircle. (default 0.3). Can be negative for opposite direction.
 * @param segments - Number of arc segments (default 32)
 * @returns Array of 3D points forming the circular arc
 *
 * @example
 * ```ts
 * const pts = arcCurve([0, 0, 0], [1, 0, 0], 0.5, 32);
 * ```
 */
export function arcCurve(
  p1: Vec3,
  p2: Vec3,
  curvature: number = 0.3,
  segments: number = 32,
): Vec3[] {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const dz = p2[2] - p1[2];
  const chordLength = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (chordLength < 1e-10 || Math.abs(curvature) < 1e-10) {
    return straightLine(p1, p2, segments);
  }

  // The "sagitta" (height of the arc above the chord)
  const sagitta = curvature * chordLength * 0.5;

  // Radius of the circle from the chord length and sagitta:
  // R = (s/2) + (c^2 / (8*s)) where s = sagitta, c = chordLength
  const halfChord = chordLength * 0.5;
  const radius = Math.abs(sagitta * 0.5 + (halfChord * halfChord) / (2 * Math.abs(sagitta)));

  // Half-angle subtended by the chord: sin(theta) = halfChord / R
  const sinTheta = Math.min(halfChord / radius, 1.0);
  const halfAngle = Math.asin(sinTheta);
  const totalAngle = halfAngle * 2;

  // Build a local coordinate frame
  const dirNorm: Vec3 = [dx / chordLength, dy / chordLength, dz / chordLength];

  // Perpendicular direction (same logic as bezierCurve)
  let perp: Vec3;
  if (Math.abs(dz) < chordLength * 0.9) {
    perp = [-dy / chordLength, dx / chordLength, 0];
  } else {
    const cross: Vec3 = [
      dirNorm[1] * 0 - dirNorm[2] * 0,
      dirNorm[2] * 1 - dirNorm[0] * 0,
      dirNorm[0] * 0 - dirNorm[1] * 1,
    ];
    const crossLen = Math.sqrt(cross[0] ** 2 + cross[1] ** 2 + cross[2] ** 2);
    perp = crossLen > 1e-10
      ? [cross[0] / crossLen, cross[1] / crossLen, cross[2] / crossLen]
      : [0, 1, 0];
  }

  // Sign of curvature determines which side the arc bows toward
  const sign = curvature > 0 ? 1 : -1;

  // Midpoint of the chord
  const mid: Vec3 = [
    (p1[0] + p2[0]) * 0.5,
    (p1[1] + p2[1]) * 0.5,
    (p1[2] + p2[2]) * 0.5,
  ];

  // Center of the circle: displaced from midpoint perpendicular to chord
  const centerDist = Math.sqrt(Math.max(0, radius * radius - halfChord * halfChord));
  const center: Vec3 = [
    mid[0] - sign * perp[0] * centerDist,
    mid[1] - sign * perp[1] * centerDist,
    mid[2] - sign * perp[2] * centerDist,
  ];

  // Generate arc points by rotating around the center
  // Vector from center to p1
  const startVec: Vec3 = [p1[0] - center[0], p1[1] - center[1], p1[2] - center[2]];
  // Vector from center to midpoint of the arc (perpendicular to chord through center)
  // The arc sweeps from startVec to endVec

  const points: Vec3[] = [];
  const count = Math.max(segments, 2);

  for (let i = 0; i <= count; i++) {
    const t = i / count;
    // Angle from start: sweep from -halfAngle to +halfAngle relative to the
    // center-to-midpoint direction
    const angle = -halfAngle + totalAngle * t;

    // Rotate startVec by angle using Rodrigues' rotation formula.
    // We need an axis of rotation perpendicular to both the chord direction and perp.
    // This axis is parallel to the cross product of the chord plane.
    // For simplicity, we parameterize in the local frame.

    // Local basis: u = dirNorm (along chord), v = perp (perpendicular, in-plane)
    // Point on circle relative to center:
    //   P = center + radius * (cos(alpha) * eR + sin(alpha) * eT)
    // where eR and eT are radial and tangential unit vectors.
    // We can express this using the start angle relative to the center.

    // Actually, simplest: interpolate using the parameterization from p1 to p2
    // via the arc. Use slerp-like interpolation in the chord plane.
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    // Vectors from center: v1 = startVec rotated by the arc
    // Decompose startVec into components along dirNorm and perp
    const compDir = startVec[0] * dirNorm[0] + startVec[1] * dirNorm[1] + startVec[2] * dirNorm[2];
    const compPerp = startVec[0] * perp[0] + startVec[1] * perp[1] + startVec[2] * perp[2];

    // Rotation in the dir-perp plane
    const newCompDir = compDir * cosA - compPerp * sinA;
    const newCompPerp = compDir * sinA + compPerp * cosA;

    // Remaining component (orthogonal to the chord plane)
    const compOrtho0 = startVec[0] - compDir * dirNorm[0] - compPerp * perp[0];
    const compOrtho1 = startVec[1] - compDir * dirNorm[1] - compPerp * perp[1];
    const compOrtho2 = startVec[2] - compDir * dirNorm[2] - compPerp * perp[2];

    points.push([
      center[0] + newCompDir * dirNorm[0] + newCompPerp * perp[0] + compOrtho0,
      center[1] + newCompDir * dirNorm[1] + newCompPerp * perp[1] + compOrtho1,
      center[2] + newCompDir * dirNorm[2] + newCompPerp * perp[2] + compOrtho2,
    ]);
  }

  return points;
}

/**
 * Generate a teardrop-shaped self-loop emanating from and returning to a node.
 *
 * The shape is a "cardioid-like" teardrop: it exits the node center at a given
 * angle, loops outward to a maximum radius, then curves back to the node center.
 * The result is visually distinctive and avoids the ambiguity of a perfect circle.
 *
 * @param center - Position of the node [x, y, z]
 * @param radius - Maximum extent of the loop from the node center (default 0.08)
 * @param angle - Base angle in radians controlling the loop's orientation.
 *   0 = loop extends to the right, PI/2 = upward, etc. (default PI/2 = upward)
 * @param segments - Number of curve segments (default 48)
 * @returns Array of 3D points forming the teardrop loop
 *
 * @example
 * ```ts
 * const pts = selfLoop([0.5, 0.3, 0], 0.06, Math.PI / 2, 48);
 * // Teardrop loop extending upward from (0.5, 0.3, 0)
 * ```
 */
export function selfLoop(
  center: Vec3,
  radius: number = 0.08,
  angle: number = Math.PI / 2,
  segments: number = 48,
): Vec3[] {
  const points: Vec3[] = [];
  const count = Math.max(segments, 8);

  // Parametric teardrop: a cardioid variant
  // r(t) = radius * (1 - cos(t)) where t goes from 0 to 2*PI
  // This gives r(0) = 0 (at the node), r(PI) = 2*radius (max extent), r(2*PI) = 0 (back)
  //
  // In Cartesian coordinates (local frame, then rotated by `angle`):
  //   x_local(t) = r(t) * cos(t) = radius * (1 - cos(t)) * cos(t)
  //   y_local(t) = r(t) * sin(t) = radius * (1 - cos(t)) * sin(t)

  const cosAngle = Math.cos(angle);
  const sinAngle = Math.sin(angle);

  for (let i = 0; i <= count; i++) {
    const t = (i / count) * Math.PI * 2;

    // Cardioid parameterization scaled by radius
    const r = radius * (1 - Math.cos(t));
    const localX = r * Math.cos(t);
    const localY = r * Math.sin(t);

    // Rotate by the base angle
    const rotatedX = localX * cosAngle - localY * sinAngle;
    const rotatedY = localX * sinAngle + localY * cosAngle;

    points.push([
      center[0] + rotatedX,
      center[1] + rotatedY,
      center[2],
    ]);
  }

  return points;
}

/**
 * A canonical key for a pair of node IDs, regardless of direction.
 * Always puts the lexicographically smaller ID first.
 */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}||${b}` : `${b}||${a}`;
}

/**
 * Result of edge bundling: maps edge index to its offset point array.
 */
export interface BundleResult {
  /** Original edge index to its computed, offset point array. */
  edgePoints: Map<number, Vec3[]>;
  /** Parallel group info: maps edge index to [groupIndex, groupSize]. */
  parallelInfo: Map<number, { index: number; count: number }>;
}

/**
 * Bundle parallel edges between the same node pairs by offsetting them
 * perpendicular to the chord direction. This prevents multiple edges between
 * the same two nodes from overlapping into a single visual line.
 *
 * Single edges (no parallel siblings) pass through unchanged.
 * Self-loops are excluded from bundling (handled separately by selfLoop).
 *
 * @param edges - Array of edge data objects
 * @param nodePositions - Map from node ID to [x, y, z] position
 * @param strength - Offset distance between parallel edges (default 0.03).
 *   The total spread of N parallel edges is (N-1) * strength, centered on the
 *   straight line between the two nodes.
 * @param segments - Number of segments for each generated curve (default 32)
 * @returns BundleResult with offset point arrays and parallel group metadata
 *
 * @example
 * ```ts
 * const edges = [
 *   { source: 'a', target: 'b', weight: 0.5 },
 *   { source: 'a', target: 'b', weight: 0.8 },
 *   { source: 'b', target: 'a', weight: 0.3 },
 * ];
 * const positions = new Map([['a', [0,0,0]], ['b', [1,0,0]]]);
 * const result = bundleEdges(edges, positions, 0.03);
 * // result.edgePoints has 3 entries, each offset from the center line
 * ```
 */
export function bundleEdges(
  edges: AdvancedEdgeData[],
  nodePositions: Map<string, Vec3>,
  strength: number = 0.03,
  segments: number = 32,
): BundleResult {
  const edgePoints = new Map<number, Vec3[]>();
  const parallelInfo = new Map<number, { index: number; count: number }>();

  // Group edges by their (unordered) node pair
  const groups = new Map<string, number[]>();

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];

    // Self-loops are not bundled
    if (edge.source === edge.target) {
      parallelInfo.set(i, { index: 0, count: 1 });
      const pos = nodePositions.get(edge.source);
      if (pos) {
        edgePoints.set(i, selfLoop(pos));
      }
      continue;
    }

    const key = pairKey(edge.source, edge.target);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(i);
  }

  // Process each group
  for (const [_key, indices] of groups) {
    const count = indices.length;

    for (let g = 0; g < count; g++) {
      const edgeIdx = indices[g];
      const edge = edges[edgeIdx];
      const p1 = nodePositions.get(edge.source);
      const p2 = nodePositions.get(edge.target);

      if (!p1 || !p2) {
        parallelInfo.set(edgeIdx, { index: g, count });
        continue;
      }

      parallelInfo.set(edgeIdx, { index: g, count });

      if (count === 1) {
        // Single edge: straight line (no offset needed)
        edgePoints.set(edgeIdx, straightLine(p1, p2, segments));
      } else {
        // Multiple parallel edges: offset each one using a Bezier curve
        // Spread offsets symmetrically around 0: -((count-1)/2) ... +((count-1)/2)
        const offset = (g - (count - 1) / 2) * strength;
        edgePoints.set(edgeIdx, bezierCurve(p1, p2, offset, segments));
      }
    }
  }

  return { edgePoints, parallelInfo };
}

/**
 * Compute a perpendicular offset of an existing polyline path.
 * This shifts every point of the path sideways by `offset` distance,
 * useful for manually offsetting a geodesic or any pre-computed curve.
 *
 * @param points - Original polyline points
 * @param offset - Distance to shift perpendicular to the path.
 *   Positive = left of the travel direction, negative = right.
 * @returns New polyline with each point shifted perpendicularly
 */
export function offsetPolyline(points: Vec3[], offset: number): Vec3[] {
  if (points.length < 2 || Math.abs(offset) < 1e-10) {
    return points.map(p => [...p] as Vec3);
  }

  const result: Vec3[] = [];

  for (let i = 0; i < points.length; i++) {
    // Compute tangent at this point
    let tangent: Vec3;
    if (i === 0) {
      tangent = [
        points[1][0] - points[0][0],
        points[1][1] - points[0][1],
        points[1][2] - points[0][2],
      ];
    } else if (i === points.length - 1) {
      tangent = [
        points[i][0] - points[i - 1][0],
        points[i][1] - points[i - 1][1],
        points[i][2] - points[i - 1][2],
      ];
    } else {
      tangent = [
        points[i + 1][0] - points[i - 1][0],
        points[i + 1][1] - points[i - 1][1],
        points[i + 1][2] - points[i - 1][2],
      ];
    }

    const len = Math.sqrt(tangent[0] ** 2 + tangent[1] ** 2 + tangent[2] ** 2);
    if (len < 1e-10) {
      result.push([...points[i]] as Vec3);
      continue;
    }

    // Normalize tangent
    const tNorm: Vec3 = [tangent[0] / len, tangent[1] / len, tangent[2] / len];

    // Perpendicular: for XY-plane-dominant edges, use (-ty, tx, 0)
    // For 3D edges, cross with Z-axis (or Y-axis if tangent is parallel to Z)
    let perp: Vec3;
    if (Math.abs(tNorm[2]) < 0.95) {
      // XY-dominant: perpendicular in the XY plane
      const pLen = Math.sqrt(tNorm[0] ** 2 + tNorm[1] ** 2);
      if (pLen > 1e-10) {
        perp = [-tNorm[1] / pLen, tNorm[0] / pLen, 0];
      } else {
        perp = [0, 1, 0];
      }
    } else {
      // Edge is nearly vertical (along Z): perpendicular in XZ plane
      perp = [1, 0, 0];
    }

    result.push([
      points[i][0] + perp[0] * offset,
      points[i][1] + perp[1] * offset,
      points[i][2] + perp[2] * offset,
    ]);
  }

  return result;
}
