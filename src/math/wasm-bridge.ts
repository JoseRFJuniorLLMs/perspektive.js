import init, { 
    poincare_distance, 
    calculate_geodesic, 
    stereographic_project, 
    conformal_factor 
} from '../wasm-pkg/perspektive_wasm';

let wasmReady = false;

/**
 * Initialize the WASM module.
 * This should be called once at the start of the application.
 */
export async function initWasm() {
    if (wasmReady) return;
    await init();
    wasmReady = true;
    console.log('🚀 Perspektive WASM Math Core Initialized');
}

export function isWasmReady() {
    return wasmReady;
}

export function getWasmDistance(p1: { x: number, y: number }, p2: { x: number, y: number }): number {
    if (!wasmReady) return 0;
    try {
        return poincare_distance(p1, p2);
    } catch (e) {
        console.error('WASM Math Error (distance):', e);
        return 0;
    }
}

export function getWasmGeodesic(p1: { x: number, y: number }, p2: { x: number, y: number }) {
    if (!wasmReady) return { cx: 0, cy: 0, radius: 0, is_linear: true };
    try {
        return calculate_geodesic(p1, p2);
    } catch (e) {
        console.error('WASM Math Error (geodesic):', e);
        return { cx: 0, cy: 0, radius: 0, is_linear: true };
    }
}

export function getWasmStereographic(p: { x: number, y: number }) {
    if (!wasmReady) return { x: 0, y: 0, z: -1 };
    try {
        return stereographic_project(p);
    } catch (e) {
        console.error('WASM Math Error (stereographic):', e);
        return { x: 0, y: 0, z: -1 };
    }
}

export function getWasmConformalFactor(p: { x: number, y: number }): number {
    if (!wasmReady) return 1;
    try {
        return conformal_factor(p);
    } catch (e) {
        console.error('WASM Math Error (conformal):', e);
        return 1;
    }
}
