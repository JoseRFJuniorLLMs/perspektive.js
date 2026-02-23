/**
 * ArrowHead.tsx -- Arrow Head Mesh Component
 *
 * Renders a small triangle mesh oriented along the edge tangent direction.
 * Uses raw BufferGeometry with three vertices for maximum performance.
 * Supports HDR colors with bloom (toneMapped={false}) and additive blending.
 *
 * The arrow can be placed at any position along the edge path (0-1) and
 * automatically orients itself to follow the edge curvature at that point.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { calculateArrowHead } from './arrows';
import type { Vec3 } from './types';

/**
 * Props for the ArrowHead component.
 */
export interface ArrowHeadProps {
  /** Polyline points defining the edge path. */
  points: Vec3[];
  /** Position along the edge [0, 1] where the arrow is placed. */
  position?: number;
  /** Size of the arrow head in world units. */
  size?: number;
  /** Color of the arrow head (Three.js Color-compatible value). */
  color?: THREE.ColorRepresentation;
  /** HDR color multiplier for bloom glow. */
  hdrMultiplier?: number;
  /** Whether the arrow is filled (true) or wireframe (false). */
  filled?: boolean;
  /** Opacity of the arrow. */
  opacity?: number;
  /** Blending mode. */
  blending?: THREE.Blending;
}

/**
 * ArrowHead renders a small triangle mesh at a given position along an edge path.
 *
 * The triangle vertices are computed by `calculateArrowHead()` from the arrows
 * module, which derives the tangent direction from the edge polyline to ensure
 * correct orientation even on curved geodesic arcs.
 *
 * @example
 * ```tsx
 * <ArrowHead
 *   points={edgePath}
 *   position={0.85}
 *   size={0.015}
 *   color="#00d8ff"
 *   hdrMultiplier={1.5}
 * />
 * ```
 */
export const ArrowHead = ({
  points,
  position = 1.0,
  size = 0.02,
  color = '#00d8ff',
  hdrMultiplier = 1.5,
  filled = true,
  opacity = 1.0,
  blending = THREE.AdditiveBlending,
}: ArrowHeadProps) => {
  const geometry = useMemo(() => {
    if (points.length < 2) return null;

    const { tip, left, right } = calculateArrowHead(points, position, size);

    const vertices = new Float32Array([
      tip[0], tip[1], tip[2],
      left[0], left[1], left[2],
      right[0], right[1], right[2],
    ]);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

    // Compute face normal for consistent lighting (even though we use meshBasicMaterial)
    geo.computeVertexNormals();

    return geo;
  }, [points, position, size]);

  const material = useMemo(() => {
    const hdrColor = new THREE.Color(color).multiplyScalar(hdrMultiplier);

    return new THREE.MeshBasicMaterial({
      color: hdrColor,
      side: THREE.DoubleSide,
      transparent: opacity < 1.0,
      opacity,
      blending,
      depthWrite: false,
      toneMapped: false, // Critical for HDR bloom support
      wireframe: !filled,
    });
  }, [color, hdrMultiplier, filled, opacity, blending]);

  if (!geometry) return null;

  return <mesh geometry={geometry} material={material} />;
};

/**
 * Props for the BidirectionalArrows component.
 */
export interface BidirectionalArrowsProps {
  /** Polyline points defining the edge path. */
  points: Vec3[];
  /** Size of each arrow head in world units. */
  size?: number;
  /** Color of the arrow heads. */
  color?: THREE.ColorRepresentation;
  /** HDR color multiplier. */
  hdrMultiplier?: number;
  /** Opacity of the arrows. */
  opacity?: number;
}

/**
 * BidirectionalArrows renders two arrow heads on a single edge:
 * one near the target end and one near the source end, indicating
 * that the relationship flows in both directions.
 *
 * @example
 * ```tsx
 * <BidirectionalArrows
 *   points={edgePath}
 *   size={0.012}
 *   color="#ff00ff"
 * />
 * ```
 */
export const BidirectionalArrows = ({
  points,
  size = 0.015,
  color = '#00d8ff',
  hdrMultiplier = 1.5,
  opacity = 1.0,
}: BidirectionalArrowsProps) => {
  if (points.length < 2) return null;

  return (
    <group>
      {/* Forward arrow near the target end */}
      <ArrowHead
        points={points}
        position={0.85}
        size={size}
        color={color}
        hdrMultiplier={hdrMultiplier}
        opacity={opacity}
      />
      {/* Backward arrow near the source end (reversed path for correct orientation) */}
      <ArrowHead
        points={[...points].reverse()}
        position={0.85}
        size={size}
        color={color}
        hdrMultiplier={hdrMultiplier}
        opacity={opacity}
      />
    </group>
  );
};
