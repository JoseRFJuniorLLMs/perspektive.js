/**
 * useFractalLoader.ts — Pilar 3 da EVA: Navegação Fractal (Lazy Loading Hiperbólico)
 *
 * Implementa o "Google Maps da Memória" para o Disco de Poincaré:
 * - Monitora o nível de zoom da câmera
 * - Quando o usuário dá zoom em uma região da borda do disco, detecta a célula
 *   espacial e faz fetch incremental de um subgrafo adicional da API
 * - Usa GraphStore.loadFull() em modo merge para expansão fractal infinita
 * - Evita re-fetches da mesma célula (cache de regiões carregadas)
 *
 * Analogia: igual ao Google Maps que carrega tiles ao dar zoom —
 * aqui carregamos "tiles semânticos" do espaço hiperbólico.
 */

import { useRef, useState, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GraphStore } from './GraphStore';
import type { NodePayload, EdgePayload } from './types';

// ==========================================
// TYPES
// ==========================================

export interface FractalRegion {
  /** Grid cell key "x:y" */
  key: string;
  cx: number;
  cy: number;
  radius: number;
}

export interface FractalLoaderOptions {
  /** The GraphStore to push newly loaded subgraphs into */
  store: GraphStore;
  /** Base URL for the subgraph API. Appended with ?cx=&cy=&r=&limit= */
  apiBase: string;
  /** API collection name */
  collection?: string;
  /** Maximum nodes per subgraph fetch request */
  limitPerTile?: number;
  /** Zoom threshold at which fractal loading kicks in (world units visible) */
  zoomThreshold?: number;
  /** Poincaré disk radius to monitor */
  diskRadius?: number;
  /** Number of grid sectors to divide the disk into */
  gridSectors?: number;
}

export interface FractalLoaderState {
  /** Whether a fetch is currently in progress */
  isLoading: boolean;
  /** Last loaded region */
  lastRegion: FractalRegion | null;
  /** Total number of regions loaded this session */
  loadedCount: number;
  /** Force-load a specific region */
  loadRegion: (region: FractalRegion) => Promise<void>;
}

// ==========================================
// HELPERS
// ==========================================

/**
 * Convert camera zoom/frustum to an approximate world-space radius visible.
 * For OrthographicCamera: uses `zoom` and the frustum size.
 * For PerspectiveCamera: uses FOV and distance to z=0 plane.
 */
function getCameraVisibleRadius(camera: THREE.Camera): number {
  if (camera instanceof THREE.OrthographicCamera) {
    // OrthographicCamera: visible height = (top - bottom) / zoom
    return (camera.top - camera.bottom) / (2 * camera.zoom);
  } else if (camera instanceof THREE.PerspectiveCamera) {
    // PerspectiveCamera: visible height at z=0
    const dist = camera.position.z;
    return dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  }
  return 1;
}

/**
 * Given the camera center position and the current visible radius,
 * determine which Poincaré disk sectors are in focus.
 * Returns a list of sector keys (cx, cy, r) to fetch.
 */
function getSectorsInView(
  camX: number,
  camY: number,
  visibleRadius: number,
  diskRadius: number,
  gridSectors: number
): FractalRegion[] {
  const sectorSize = (diskRadius * 2) / gridSectors;
  const regions: FractalRegion[] = [];

  const minGx = Math.floor((camX - visibleRadius + diskRadius) / sectorSize);
  const maxGx = Math.ceil((camX + visibleRadius + diskRadius) / sectorSize);
  const minGy = Math.floor((camY - visibleRadius + diskRadius) / sectorSize);
  const maxGy = Math.ceil((camY + visibleRadius + diskRadius) / sectorSize);

  for (let gx = minGx; gx <= maxGx; gx++) {
    for (let gy = minGy; gy <= maxGy; gy++) {
      const cx = (gx + 0.5) * sectorSize - diskRadius;
      const cy = (gy + 0.5) * sectorSize - diskRadius;

      // Only sectors inside the Poincaré disk
      if (Math.sqrt(cx * cx + cy * cy) > diskRadius * 1.1) continue;

      regions.push({
        key: `${gx}:${gy}`,
        cx,
        cy,
        radius: sectorSize * 0.7,
      });
    }
  }

  return regions;
}

// ==========================================
// HOOK
// ==========================================

export function useFractalLoader({
  store,
  apiBase,
  collection = 'default',
  limitPerTile = 200,
  zoomThreshold = 0.25,
  diskRadius = 1.0,
  gridSectors = 8,
}: FractalLoaderOptions): FractalLoaderState {
  const { camera } = useThree();
  const [isLoading, setIsLoading] = useState(false);
  const [lastRegion, setLastRegion] = useState<FractalRegion | null>(null);
  const [loadedCount, setLoadedCount] = useState(0);

  /** Cache of already-loaded region keys to avoid duplicates */
  const loadedKeys = useRef(new Set<string>());
  /** Whether a fetch is in flight */
  const fetchInFlight = useRef(false);

  const loadRegion = useCallback(
    async (region: FractalRegion) => {
      if (loadedKeys.current.has(region.key)) return;
      if (fetchInFlight.current) return;

      fetchInFlight.current = true;
      setIsLoading(true);

      try {
        const url = new URL(`${apiBase}/graph/subgraph`);
        url.searchParams.set('collection', collection);
        url.searchParams.set('cx', String(region.cx));
        url.searchParams.set('cy', String(region.cy));
        url.searchParams.set('r', String(region.radius));
        url.searchParams.set('limit', String(limitPerTile));

        const resp = await fetch(url.toString());
        if (!resp.ok) throw new Error(`Subgraph fetch failed: ${resp.status}`);

        const data: { nodes: NodePayload[]; edges: EdgePayload[] } = await resp.json();

        if (data.nodes?.length > 0) {
          // Merge into the store without full reset
          // We rebuild snapshot by applying individual born-ops as a delta
          // Simple merge: just inject into a fresh delta
          store.loadFull(
            [...(store.getSnapshot().nodes as NodePayload[]), ...data.nodes],
            [...(store.getSnapshot().edges as EdgePayload[]), ...data.edges]
          );
        }

        loadedKeys.current.add(region.key);
        setLastRegion(region);
        setLoadedCount(c => c + 1);
      } catch (e) {
        console.warn('[FractalLoader] Failed to load subgraph for region', region.key, e);
      } finally {
        fetchInFlight.current = false;
        setIsLoading(false);
      }
    },
    [store, apiBase, collection, limitPerTile]
  );

  // Monitor camera every frame and trigger loads when zoomed in
  useFrame(() => {
    const visibleRadius = getCameraVisibleRadius(camera);

    // Only activate fractal loading when zoomed in enough
    if (visibleRadius > zoomThreshold) return;

    const camX = camera.position.x;
    const camY = camera.position.y;

    const candidateRegions = getSectorsInView(
      camX,
      camY,
      visibleRadius,
      diskRadius,
      gridSectors
    );

    for (const region of candidateRegions) {
      if (!loadedKeys.current.has(region.key)) {
        // Load the first unloaded region found (async, non-blocking)
        loadRegion(region);
        break;
      }
    }
  });

  return {
    isLoading,
    lastRegion,
    loadedCount,
    loadRegion,
  };
}
