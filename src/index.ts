// ── Main Entry Point ─────────────────────────────────────────────────────────
export { PerspektiveView } from './PerspektiveView';
export type { PerspektiveProps, GraphData, NodeData, EdgeData, ManifoldType } from './PerspektiveView';

// ── Core Engine ──────────────────────────────────────────────────────────────
export { PerspektiveEngine } from './components/PerspektiveEngine';
export type {
  PerspektiveEngineProps,
  ManifoldType as EngineManifoldType,
  NodeData as EngineNodeData,
  EdgeData as EngineEdgeData,
  StreamingMode,
} from './components/PerspektiveEngine';

// ── P0: Counterfactual (Drag-and-Drop Quântico) ──────────────────────────────
export { CounterfactualOverlay } from './components/CounterfactualOverlay';
export type {
  CounterfactualEdge,
  CounterfactualOverlayProps,
} from './components/CounterfactualOverlay';

// ── P0: Fractal Loader (Lazy Loading Hiperbólico) ────────────────────────────
export { useFractalLoader } from './streaming/useFractalLoader';
export type {
  FractalLoaderOptions,
  FractalLoaderState,
  FractalRegion,
} from './streaming/useFractalLoader';

export { default as FractalLoadingHalo } from './components/FractalLoadingHalo';

// ── P1: Causal Scrubber (Máquina do Tempo Minkowski) ─────────────────────────
export { CausalScrubber } from './components/CausalScrubber';
export type {
  CausalScrubberProps,
  CausalSnapshot,
} from './components/CausalScrubber';

// ── P1: Live Diffusion WebSocket (Live Pregel) ───────────────────────────────
export { useDiffusionWebSocket } from './streaming/useDiffusionWebSocket';
export type {
  UseDiffusionWebSocketOptions,
  DiffusionWebSocketState,
  DiffusionStep,
} from './streaming/useDiffusionWebSocket';

// ── P2: Quantum Shaders (Bloch / Probability Clouds) ─────────────────────────
export { BlochMaterial, QuantumEdgeMaterial } from './materials/BlochMaterial';
export type { BlochMaterialParams } from './materials/BlochMaterial';

// ── P2: Algorithm Visualization ──────────────────────────────────────────────
export { CommunityHulls } from './components/CommunityHulls';
export type { CommunityHullsProps, CommunityMap } from './components/CommunityHulls';

export { PathHighlight } from './components/PathHighlight';
export type { PathHighlightProps } from './components/PathHighlight';

// ── Manifolds ────────────────────────────────────────────────────────────────
export { PoincareView } from './manifolds/PoincareView';
export { EmotionView } from './manifolds/EmotionView';
export { MinkowskiView } from './manifolds/MinkowskiView';

// ── Live Data Connectors ─────────────────────────────────────────────────────
export { LivePoincareMap } from './components/LivePoincareMap';
export type { LivePoincareMapProps } from './components/LivePoincareMap';

// ── Streaming ────────────────────────────────────────────────────────────────
export { GraphStore } from './streaming/GraphStore';
export type { GraphSnapshot, StoreListener } from './streaming/GraphStore';
export { WebSocketClient } from './streaming/WebSocketClient';
export type { WSStatus, WebSocketClientOptions } from './streaming/WebSocketClient';
export { useWebSocket } from './streaming/useWebSocket';

// ── Math Modules ─────────────────────────────────────────────────────────────
export * as poincare from './math/poincare';
export * as klein from './math/klein';
export * as riemann from './math/riemann';

// ── Interaction ──────────────────────────────────────────────────────────────
export { useDrag } from './interaction/useDrag';
export { useSelection } from './interaction/useSelection';
export { BoxSelectOverlay } from './interaction/BoxSelectOverlay';
export { MobiusZoom } from './interaction/MobiusZoom';
export { ContextMenu } from './interaction/ContextMenu';

// ── Algorithms ───────────────────────────────────────────────────────────────
export * from './algorithms/centrality';
export * from './algorithms/pathfinding';
export * from './algorithms/community';

// ── Topological Analysis ──────────────────────────────────────────────────────
export { computeBetti0, computeBetti1 } from './analysis/tda';

// ── Layouts ───────────────────────────────────────────────────────────────────
export { getLayout, registerLayout, getLayoutNames } from './layouts';
export type { LayoutNode, LayoutEdge, LayoutOptions, Layout } from './layouts';

// ── Theme ─────────────────────────────────────────────────────────────────────
export { PerspektiveThemeProvider, useTheme } from './theme/ThemeContext';
export { presets as ThemePresets, defaultTheme } from './theme/presets';
export type { PerspektiveTheme } from './theme/types';

// ── Export Utilities ──────────────────────────────────────────────────────────
export { exportToPNG, exportToJPEG } from './export/png';
export { exportToSVG } from './export/svg';
export { exportToJSON } from './export/json';
export { exportToGraphML } from './export/graphml';

// ── Utilities ────────────────────────────────────────────────────────────────
export { ErrorBoundary } from './components/ErrorBoundary';
