/**
 * CommunityHulls.tsx — P2: Visualização de Algoritmos — Community Hulls
 *
 * Renderiza hulls convexos coloridos para cada comunidade detectada
 * pelo algoritmo de Louvain (ou qualquer partição em comunidades).
 *
 * Cada comunidade recebe uma cor única e um hull semi-transparente
 * usando THREE.Shape (polígono convexo) em WebGL.
 *
 * Funciona em todos os manifolds, mas é especialmente impressionante
 * no Poincaré disk onde os clusters aparecem como "bolhas" de memória.
 */

import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { NodeData } from './PerspektiveEngine';

// ==========================================
// TYPES
// ==========================================

export interface CommunityMap {
  /** nodeId → communityId */
  [nodeId: string]: number | string;
}

export interface CommunityHullsProps {
  nodes: NodeData[];
  /** Map of nodeId → communityId from Louvain or any algorithm */
  communityMap: CommunityMap;
  /** Alpha of hull fill [0..1] */
  fillOpacity?: number;
  /** Whether to show community label */
  showLabels?: boolean;
}

// ==========================================
// PALETTE — HSL-based distinct colors
// ==========================================

function communityColor(index: number): THREE.Color {
  const hue = (index * 137.508) % 360; // golden angle
  const color = new THREE.Color();
  color.setHSL(hue / 360, 0.7, 0.5);
  return color;
}

// ==========================================
// CONVEX HULL ALGORITHM (Andrew's Monotone Chain)
// ==========================================

type Point2 = { x: number; y: number };

function cross(O: Point2, A: Point2, B: Point2): number {
  return (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
}

function convexHull(points: Point2[]): Point2[] {
  if (points.length <= 2) return points;
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const lower: Point2[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Point2[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

// ==========================================
// HULL MESH
// ==========================================

const HullMesh: React.FC<{ hull: Point2[]; color: THREE.Color; opacity: number }> = ({
  hull,
  color,
  opacity,
}) => {
  const geometry = useMemo(() => {
    if (hull.length < 3) return null;
    const shape = new THREE.Shape();
    shape.moveTo(hull[0].x, hull[0].y);
    for (let i = 1; i < hull.length; i++) {
      shape.lineTo(hull[i].x, hull[i].y);
    }
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, [hull]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} position={[0, 0, -0.01]}>
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

// Outline of hull
const HullOutline: React.FC<{ hull: Point2[]; color: THREE.Color }> = ({ hull, color }) => {
  const points = useMemo(() => {
    const pts = [...hull, hull[0]]; // close the loop
    return pts.map(p => new THREE.Vector3(p.x, p.y, 0));
  }, [hull]);

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[new Float32Array(points.flatMap(p => [p.x, p.y, p.z])), 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent opacity={0.6} linewidth={1} />
    </line>
  );
};

// ==========================================
// MAIN COMPONENT
// ==========================================

export const CommunityHulls: React.FC<CommunityHullsProps> = ({
  nodes,
  communityMap,
  fillOpacity = 0.08,
  showLabels = true,
}) => {
  // Group nodes by community
  const communities = useMemo(() => {
    const map = new Map<string | number, NodeData[]>();
    for (const node of nodes) {
      const cid = communityMap[node.id];
      if (cid === undefined) continue;
      if (!map.has(cid)) map.set(cid, []);
      map.get(cid)!.push(node);
    }
    return map;
  }, [nodes, communityMap]);

  // Build hulls
  const hulls = useMemo(() => {
    const result: Array<{
      cid: string | number;
      hull: Point2[];
      color: THREE.Color;
      centroid: Point2;
    }> = [];

    let idx = 0;
    for (const [cid, members] of communities) {
      if (members.length < 3) { idx++; continue; }

      const points: Point2[] = members.map(n => ({
        x: n.x ?? 0,
        y: n.y ?? 0,
      }));

      // Add a small padding to the hull
      const hull = convexHull(points);
      const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length;
      const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length;

      // Expand hull by 0.05 world units from centroid
      const expanded = hull.map(p => ({
        x: cx + (p.x - cx) * 1.15 + (p.x - cx > 0 ? 0.05 : -0.05),
        y: cy + (p.y - cy) * 1.15 + (p.y - cy > 0 ? 0.05 : -0.05),
      }));

      result.push({ cid, hull: expanded, color: communityColor(idx), centroid: { x: cx, y: cy } });
      idx++;
    }
    return result;
  }, [communities]);

  return (
    <group name="community-hulls">
      {hulls.map(({ cid, hull, color, centroid }) => (
        <group key={String(cid)}>
          <HullMesh hull={hull} color={color} opacity={fillOpacity} />
          <HullOutline hull={hull} color={color} />
        </group>
      ))}
    </group>
  );
};

export default CommunityHulls;
