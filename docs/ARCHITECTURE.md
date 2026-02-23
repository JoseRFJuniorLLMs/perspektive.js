# Architecture of Perspektive.js

Perspektive.js is designed as a modular, agentic visualization system. Instead of a monolithic graph renderer, it decomposes visualization tasks into specialized modules or "agents".

## 1. The 10-Agent Model

The system is organized into 10 core functional areas:

1. **Layout Algorithms** (`src/layouts/`): Pluggable layout logic (Force-directed, Circular, Concentric).
2. **Node Interaction** (`src/interaction/`): Handles Drag, Selection, and Context Menus.
3. **Graph Algorithms** (`src/algorithms/`): Client-side pathfinding and centrality.
4. **Export System** (`src/export/`): High-res snapshotting (SVG/PNG/GraphML).
5. **Theming/Styling** (`src/theme/`): Context-aware neon cyberpunk presets.
6. **Advanced Edges** (`src/edges/`): Geodesic arcs and temporal trails.
7. **Search & Filtering** (`src/search/`): State-managed fuzzy search with dimming shaders.
8. **Delta Streaming** (`src/streaming/`): Efficient incremental updates via Binary WS/SSE.
9. **Accessibility** (`src/a11y/`): Semantic descriptions for screen readers.
10. **Test Suite** (`src/__tests__/`): Mathematical verification of geodesics.

## 2. Technical Core

### WASM Math Bridge
Standard JavaScript `Math` objects lack the precision and speed for high-frequency hyperbolic coordinate transforms. Perspektive.js uses a Rust-compiled **WASM core** for:
- Poincaré distance calculations.
- Exact geodesic arc parameters (Cramer's Rule for orthogonal circles).
- Möbius transformations for "infinite" panning.

### WebGPU Layout Runner
For graphs >10k nodes, standard JS force-directed layouts stumble. Perspektive.js utilizes **WebGPU** (where available) to compute node attractions and repulsions in parallel on the GPU.

### Three.js Instanced Rendering
To achieve 60 FPS, the engine uses `THREE.InstancedMesh`. Instead of thousands of individual mesh objects, a single draw call handles all nodes, with attributes (position, color, scale) managed via 4x4 matrices.

## 3. Manifold Mapping Logic

The engine projects high-dimensional embeddings (256d+) into 3D manifolds using specialized projection logic:
- **Poincaré**: Spherical projection to a unit disk where radius represents depth/hierarchy.
- **Riemann**: Stereographic projection onto a sphere.
- **Minkowski**: Spacetime mapping where Y-axis represents energy/causality.
- **Emotion**: Russell Circumplex mapping (Valence vs. Arousal).

---

> [!IMPORTANT]
> The central source of truth is the `GraphStore` (Zustand), which orchestrates data between the streaming incoming deltas and the WebGL render loop.
