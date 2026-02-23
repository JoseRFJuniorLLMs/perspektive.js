/**
 * @nietzsche/lens (perspektive.js)
 *
 * Motor unificado de visualizacao para NietzscheDB.
 * Um unico engine WebGL com "Lentes" (manifolds) alternaveis.
 *
 * Modos:
 *   - Poincare  (disco hiperbolico — padrao)
 *   - Riemann   (esfera 3D — sintese dialetica)
 *   - Minkowski (espaco-tempo — causalidade)
 *   - Emotion   (circumplex de Russell — valence x arousal)
 *
 * Overlays:
 *   - Diffusion Heatmap (camera termica pos-DIFFUSE)
 *   - Energy Pulse (respiracao de nos por energy)
 */

// Math
export * as poincare from './math/poincare';
export * as klein from './math/klein';
export * as riemann from './math/riemann';

// Manifolds
export { PoincareView } from './manifolds/PoincareView';
export type { NodeData, EdgeData } from './manifolds/PoincareView';

// Components (Live data connectors)
export { LivePoincareMap } from './components/LivePoincareMap';
export type { LivePoincareMapProps } from './components/LivePoincareMap';
export { PerspektiveEngine } from './components/PerspektiveEngine';
export type { PerspektiveEngineProps, ManifoldType } from './components/PerspektiveEngine';

// Layouts
export * as layouts from './layouts';
export { getLayout, registerLayout, getLayoutNames } from './layouts';
export type { LayoutNode, LayoutEdge, LayoutOptions, Layout } from './layouts';

// Utilities
export { ErrorBoundary } from './components/ErrorBoundary';
