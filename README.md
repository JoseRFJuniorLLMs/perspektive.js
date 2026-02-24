<p align="center">
  <img src="img/logo.gif" alt="Perspektive.js" width="400" />
</p>

<h1 align="center">Perspektive.js</h1>

<p align="center"><strong>A hyperbolic telescope for artificial minds.</strong></p>

Unified WebGL visualization engine for [NietzscheDB](https://github.com/JoseRFJuniorLLMs/NietzscheDB) — the world's only hyperbolic vector database. Renders knowledge graphs in real non-Euclidean geometry, with mathematically exact geodesics, at 60 FPS on the GPU.

> *"Perspektive"* is the German spelling of *"perspective"*. Friedrich Nietzsche coined the concept of **Perspektivismus**: the idea that every truth depends on the observer's point of view. This library materializes that literally — the same knowledge graph can be viewed through 4 different geometric lenses, each revealing a hidden structure in the data.

---

## Why does it exist?

NietzscheDB stores AI memories in a **Poincaré ball** — not in flat Euclidean space. No existing graph library (D3, Cytoscape, Cosmograph, Sigma.js) can draw:

- **Hyperbolic geodesics** — circular arcs orthogonal to the boundary, not straight lines
- **Möbius zoom** — hyperbolic translation, not linear pan
- **Minkowski light cones** — spacetime causality visualization
- **Dialectical synthesis on the Riemann sphere** — opposites at the poles, synthesis at the equator

The previous dashboard used Cosmograph and covered ~21% of NietzscheDB's feature surface. Perspektive.js covers the remaining 79% with a custom WASM-accelerated math core.

---

## The 4 Manifold Lenses

| Lens | Geometry | What it reveals |
|---|---|---|
| **Poincaré** (default) | 2D hyperbolic disk | Hierarchy: abstract concepts at center, specific memories at the edges |
| **Riemann** | 3D rotatable sphere | Dialectical opposites at poles, synthesis at equator (Hegelian engine) |
| **Minkowski** | 3D spacetime | Causality: light cones, Timelike / Spacelike / Lightlike edges |
| **Emotion** | 2D Cartesian | Russell Circumplex: Valence × Arousal = the AI's "mood" |

Switch between lenses at runtime via the Manifold Switcher — same data, different geometric truths.

---

## Core Capabilities

### The Cockpit (Navigation HUD)
- **Search Bar Cibernética** — real-time fuzzy search with shader-based **Dimming Effect** (non-matching nodes lose focus and size)
- **Filter Panel** — interactive chips for cortex type + dual-thumb sliders for Energy / Valence / Arousal
- **Semantic Camera** — HUD with Zoom, Fit View, and **Möbius navigation** support
- **SDF Labels** — high-performance 3D text using Signed Distance Fields, rendered only for "Elite" nodes or search matches

### AGI Visualization (Introspection Layer)
- **Schrödinger Edges** — probabilistic edges that flicker based on context collapse probability (custom GLSL shaders + `SchrodingerEdgeMaterial`)
- **Kinetic Heat Flow** — activation propagation (Chebyshev diffusion) as particles traveling along hyperbolic geodesics via `DiffusionHeatmap` overlay
- **Daemon Renderer** — visual representation of autonomous background agents (Wiederkehr Daemons) as geometric anomalies
- **Energy Pulse** — real-time overlay showing energy flow and activation patterns
- **Reasoning Trace** — visual path tracking of multi-hop queries and logical deductions

### Interaction System
- **Drag & Drop** — move nodes with `useDrag` hook
- **Selection** — click, multi-select, and **box select** with visual overlay
- **Context Menu** — right-click contextual actions on nodes and edges
- **Möbius Zoom** — true hyperbolic zoom (not linear scaling)
- **Situational Modulator** — adaptive interaction behavior based on graph density

### Graph Algorithms
Built-in algorithms that run directly on the hyperbolic graph:
- **Centrality** — degree, betweenness, closeness, eigenvector
- **Pathfinding** — shortest path, A*, all-pairs
- **Community detection** — Louvain, label propagation
- **Traversal** — BFS, DFS, connected components
- **Topological Data Analysis** — Betti numbers (β₀, β₁) for structural invariants

### Layouts
Six pluggable layout engines (+ custom registration via `registerLayout`):
- **Force-directed** — classic spring-embedder adapted for hyperbolic space
- **Radial** — concentric rings by depth/centrality
- **Tree** — hierarchical top-down layout
- **Grid** — uniform grid placement
- **Concentric** — layered rings by attribute
- **WebGPU** — GPU-accelerated force layout for large graphs

### Export
- **PNG / JPEG** — rasterized canvas snapshots
- **SVG** — scalable vector graphics export
- **JSON** — raw graph data serialization
- **GraphML** — interoperable XML graph format

### Theming
- Built-in theme presets with `PerspektiveThemeProvider`
- Full customization via `PerspektiveTheme` type
- Dynamic theme switching at runtime via `useTheme` hook

### Accessibility
- Screen reader descriptions for graph structure and node properties
- ARIA-compatible output via the `a11y/descriptions` module

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Math Core** | Rust → **WASM** (exact hyperbolic geodesics, Möbius transforms, Klein model) |
| **Render** | **Three.js** + **React Three Fiber** + InstancedMesh (100k+ nodes) |
| **Shaders** | Custom **GLSL** (`GeodesicEdgeShader`, `WillToPowerKernel`) |
| **GPU Compute** | **WebGPU**-accelerated force-directed layout |
| **Streaming** | Binary WebSocket + **FlatBuffers** schema + Zstandard compression |
| **State** | **Zustand** reactive graph store + `SpatialIndex` for O(log n) lookups |
| **Data Fetching** | **TanStack React Query** for API state management |
| **Post-processing** | **@react-three/postprocessing** for bloom, glow, and edge effects |
| **Build** | **Vite** + vite-plugin-wasm + top-level-await |
| **Testing** | **Vitest** + React Testing Library + jsdom |

---

## Project Structure

```
perspektive.js/
├── src/
│   ├── a11y/              # Accessibility descriptions
│   ├── agents/            # Daemon renderer (Wiederkehr agents)
│   ├── algorithms/        # Centrality, pathfinding, community, traversal
│   ├── analysis/          # Topological Data Analysis (Betti numbers)
│   ├── components/        # PerspektiveEngine, LivePoincareMap, overlays
│   ├── core/              # Engine core, ManifoldContext
│   ├── edges/             # QuantumEdgeEngine, arrows, curves
│   ├── engine/            # Low-level engine internals
│   ├── export/            # PNG, SVG, JSON, GraphML exporters
│   ├── interaction/       # Drag, selection, context menu, Möbius zoom
│   ├── layouts/           # Force, radial, tree, grid, concentric, WebGPU
│   ├── manifolds/         # PoincareView, MinkowskiView, EmotionView
│   ├── materials/         # SchrodingerEdgeMaterial
│   ├── math/              # Poincaré, Klein, Riemann math + WASM bridge
│   ├── search/            # SearchBar, FilterPanel, NodeLabels
│   ├── shaders/           # GLSL: GeodesicEdgeShader, WillToPowerKernel
│   ├── streaming/         # WebSocket, BinaryDecoder, GraphStore, SpatialIndex
│   ├── theme/             # ThemeContext, presets, stylesheet
│   ├── wasm-pkg/          # Compiled WASM package
│   └── index.ts           # Public API exports
├── wasm/                  # Rust source for WASM math core
│   ├── src/lib.rs
│   ├── Cargo.toml
│   └── Cargo.lock
├── docs/                  # Documentation
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

---

## Installation

```bash
npm install @nietzsche/perspektive
```

Or run locally:

```bash
git clone https://github.com/JoseRFJuniorLLMs/perspektive.js.git
cd perspektive.js
npm install
npm run dev
```

---

## Quick Start

```tsx
import { PerspektiveEngine } from '@nietzsche/perspektive';

function App() {
  return (
    <PerspektiveEngine
      collection="eva_core"
      apiBase="http://localhost:8080"
      streamingMode="ws"
      wsUrl="ws://localhost:8080/stream"
    />
  );
}
```

### Live Data Connection

```tsx
import { LivePoincareMap } from '@nietzsche/perspektive';

function Dashboard() {
  return (
    <LivePoincareMap
      collection="eva_core"
      apiBase="http://localhost:8080"
      wsUrl="ws://localhost:8080/stream"
    />
  );
}
```

### Using Individual Modules

```tsx
import { PoincareView, EmotionView, MinkowskiView } from '@nietzsche/perspektive';
import { GraphStore, WebSocketClient } from '@nietzsche/perspektive';
import { exportToPNG, exportToSVG } from '@nietzsche/perspektive';
import * as poincare from '@nietzsche/perspektive';
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | TypeScript + Vite production build |
| `npm run preview` | Preview production build |
| `npm run test` | Run tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run lint` | Lint source with ESLint |
| `npm run typecheck` | Type-check without emitting |

---

## Requirements

- **React** >= 18.0.0
- **Node.js** >= 18
- Browser with **WebGL 2.0** support (WebGPU optional, for GPU layouts)

---

## License

MIT — Built for [NietzscheDB](https://github.com/JoseRFJuniorLLMs/NietzscheDB) by [Jose R F Junior](https://github.com/JoseRFJuniorLLMs).
