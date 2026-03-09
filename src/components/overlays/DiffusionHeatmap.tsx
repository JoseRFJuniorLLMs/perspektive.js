/**
 * DiffusionHeatmap.tsx — Thermal density overlay for perspektive.js
 *
 * Renders inside the R3F Canvas. Bins node positions into a 64×64 grid,
 * computes density, and renders a fullscreen PlaneGeometry with a
 * DataTexture where hot = magenta (dense) and cool = transparent.
 *
 * Toggle via the `visible` prop from PerspektiveEngine HUD.
 */

import { useMemo, useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { NodeData } from '../PerspektiveEngine';

// ==========================================
// CONSTANTS
// ==========================================

const GRID = 64; // Resolution of the density grid

// ==========================================
// COMPONENT
// ==========================================

export interface DiffusionHeatmapProps {
  nodes: NodeData[];
  visible: boolean;
  /** World-space range of the disk. Default ±1.1 */
  range?: number;
  opacity?: number;
}

export const DiffusionHeatmap = ({
  nodes,
  visible,
  range = 1.1,
  opacity = 0.35,
}: DiffusionHeatmapProps) => {
  const { size: _size } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const texRef = useRef<THREE.DataTexture | null>(null);

  // Create DataTexture once
  const texture = useMemo(() => {
    const data = new Uint8Array(GRID * GRID * 4);
    const tex = new THREE.DataTexture(data, GRID, GRID, THREE.RGBAFormat);
    tex.needsUpdate = true;
    texRef.current = tex;
    return tex;
  }, []);

  // Recompute density whenever nodes change
  useEffect(() => {
    if (!visible) return;

    const data = texture.image.data as Uint8Array;
    data.fill(0);

    // Build density map
    const density = new Float32Array(GRID * GRID);
    let maxD = 0;

    for (const node of nodes) {
      const gx = Math.floor(((node.x + range) / (2 * range)) * (GRID - 1));
      const gy = Math.floor(((node.y + range) / (2 * range)) * (GRID - 1));
      if (gx < 0 || gx >= GRID || gy < 0 || gy >= GRID) continue;

      const idx = gy * GRID + gx;
      density[idx] += 1 + node.energy * 2; // Weight by energy
      if (density[idx] > maxD) maxD = density[idx];
    }

    if (maxD === 0) {
      texture.needsUpdate = true;
      return;
    }

    // Apply Gaussian blur (simple 3x3 box blur for perf)
    const blurred = new Float32Array(GRID * GRID);
    for (let y = 1; y < GRID - 1; y++) {
      for (let x = 1; x < GRID - 1; x++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            sum += density[(y + dy) * GRID + (x + dx)];
          }
        }
        blurred[y * GRID + x] = sum / 9;
      }
    }

    // Normalize and write RGBA (magenta heatmap)
    for (let i = 0; i < GRID * GRID; i++) {
      const t = Math.min(blurred[i] / maxD, 1.0);
      if (t < 0.05) continue; // Skip very low density

      const base = i * 4;
      // Heatmap: low=cyan (#00f0ff), high=magenta (#ff00ff)
      data[base + 0] = Math.floor(t * 255);       // R: 0→255 (cyan→magenta)
      data[base + 1] = Math.floor((1 - t) * 240); // G: decreases
      data[base + 2] = 255;                        // B: stays full
      data[base + 3] = Math.floor(t * 200);        // A
    }

    texture.needsUpdate = true;
  }, [nodes, visible, range, texture]);

  if (!visible) return null;

  return (
    <mesh ref={meshRef} position={[0, 0, -0.05]}>
      <planeGeometry args={[range * 2, range * 2]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
};
