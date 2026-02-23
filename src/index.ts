/**
 * @nietzsche/perspektive.js — Public API
 *
 * Motor unificado de visualizacao hiperbólica para NietzscheDB.
 *
 * Modos (Manifolds):
 *   - Poincaré  (disco hiperbólico — padrão)
 *   - Riemann   (esfera 3D — síntese dialética)
 *   - Minkowski (espaço-tempo — causalidade)
 *   - Emotion   (circumplex de Russell — valence × arousal)
 *
 * @module @nietzsche/perspektive
 */

// ── Core Engine ────────────────────────────────────────────────────────────
export { PerspektiveEngine } from './components/PerspektiveEngine';
export type {
  PerspektiveEngineProps,
  ManifoldType,
  NodeData,
  EdgeData,
  StreamingMode,
} from './components/PerspektiveEngine';

// ── Manifolds ───────────────────────────────────────────────────────────────
export { PoincareView } from './manifolds/PoincareView';
export { EmotionView } from './manifolds/EmotionView';
export { MinkowskiView } from './manifolds/MinkowskiView';
export type { NodeData as PoincareNodeData, EdgeData as PoincareEdgeData } from './manifolds/PoincareView';

// ── Live Data Connectors ────────────────────────────────────────────────────
export { LivePoincareMap } from './components/LivePoincareMap';
export type { LivePoincareMapProps } from './components/LivePoincareMap';

// ── Math Modules ────────────────────────────────────────────────────────────
export * as poincare from './math/poincare';
export * as klein from './math/klein';
export * as riemann from './math/riemann';

// ── Streaming ───────────────────────────────────────────────────────────────
export { GraphStore } from './streaming/GraphStore';
export type { GraphSnapshot, StoreListener } from './streaming/GraphStore';
export { SpatialIndex } from './streaming/SpatialIndex';
export { BinaryDecoder } from './streaming/BinaryDecoder';
export { WebSocketClient } from './streaming/WebSocketClient';
export type { WSStatus, WebSocketClientOptions } from './streaming/WebSocketClient';
export { useWebSocket } from './streaming/useWebSocket';
export type { UseWebSocketOptions, UseWebSocketReturn } from './streaming/useWebSocket';
export type {
  NodePayload, EdgePayload, GraphDelta, GraphSnapshot as GraphSnapshotType,
} from './streaming/types';

// ── Interaction ─────────────────────────────────────────────────────────────
export { useDrag } from './interaction/useDrag';
export { useSelection } from './interaction/useSelection';
export { useBoxSelect } from './interaction/useBoxSelect';
export { BoxSelectOverlay } from './interaction/BoxSelectOverlay';
export { SelectionHighlight, HoverHighlight } from './interaction/SelectionHighlight';
export { ContextMenu } from './interaction/ContextMenu';
export { MobiusZoom } from './interaction/MobiusZoom';
export type {
  SelectionState, BoxSelectRect, ContextMenuItem, ContextMenuState,
  InteractionCallbacks, DragState, InteractionConfig,
} from './interaction/types';

// ── Export Utilities ────────────────────────────────────────────────────────
export { exportToPNG, exportToJPEG } from './export/png';
export { exportToSVG } from './export/svg';
export { exportToJSON } from './export/json';
export { exportToGraphML } from './export/graphml';
export type { ExportOptions } from './export/types';

// ── Theme ───────────────────────────────────────────────────────────────────
export { PerspektiveThemeProvider, useTheme, useThemeValue } from './theme/ThemeContext';
export type { ThemeContextValue, PerspektiveThemeProviderProps } from './theme/ThemeContext';
export { PRESETS as ThemePresets, defaultTheme } from './theme/presets';
export type { PerspektiveTheme } from './theme/types';

// ── Search & Filter ─────────────────────────────────────────────────────────
export { SearchBar } from './search/SearchBar';
export { FilterPanel } from './search/FilterPanel';
export { NodeLabels } from './search/NodeLabels';
export { useFilter } from './search/useFilter';

// ── Algorithms ──────────────────────────────────────────────────────────────
export * from './algorithms/centrality';
export * from './algorithms/pathfinding';
export * from './algorithms/community';
export * from './algorithms/traversal';

// ── Topological Analysis ────────────────────────────────────────────────────
export { computeBetti0, computeBetti1 } from './analysis/tda';

// ── Layouts ─────────────────────────────────────────────────────────────────
export { getLayout, registerLayout, getLayoutNames } from './layouts';
export type { LayoutNode, LayoutEdge, LayoutOptions, Layout } from './layouts';

// ── Accessibility ────────────────────────────────────────────────────────────
export * from './a11y/descriptions';

// ── Overlays ────────────────────────────────────────────────────────────────
export { DiffusionHeatmap } from './components/overlays/DiffusionHeatmap';
export { EnergyPulse } from './components/overlays/EnergyPulse';
export { ExportToolbar } from './components/overlays/ExportToolbar';
export type { DiffusionHeatmapProps } from './components/overlays/DiffusionHeatmap';
export type { EnergyPulseProps } from './components/overlays/EnergyPulse';

// ── Utilities ────────────────────────────────────────────────────────────────
export { ErrorBoundary } from './components/ErrorBoundary';
