# Perspektive.js
**A hyperbolic telescope for artificial minds.**

Unified WebGL visualization engine for [NietzscheDB](https://github.com/JoseRFJuniorLLMs/NietzscheDB) — the world's only hyperbolic vector database. Renders knowledge graphs in real non-Euclidean geometry, with mathematically exact geodesics, at 60 FPS on the GPU.

"Perspektive" is the German spelling of "perspective". Friedrich Nietzsche — the philosopher who gives the database its name — coined the concept of **Perspektivismus**: the idea that every truth depends on the observer's point of view. This library materializes that literally: the same knowledge graph can be viewed through 4 different geometric "lenses" (Poincaré, Riemann, Minkowski, Emotion), each revealing a hidden truth about the data.

---

## Why does it exist?
NietzscheDB stores AI memories in a **Poincaré ball** — not in flat Euclidean space. No existing graph library (D3, Cytoscape, Cosmograph, Sigma.js) can draw:

- **Hyperbolic geodesics** (circular arcs orthogonal to the boundary, not straight lines)
- **Möbius zoom** (hyperbolic translation, not linear pan)
- **Minkowski light cones** (spacetime causality)
- **Dialectical synthesis on the Riemann sphere** (opposites at the poles, synthesis at the equator)

The previous dashboard used Cosmograph and covered **~21% of features**. Perspektive.js was built to cover the other 79%.

---

## What does it do?

### The Cockpit (Navigation HUD) 🕹️
Integrated overlay for precise control over the artificial mind:

- **Search Bar Cibernética:** Real-time fuzzy search with **Dimming Effect**. Non-matching nodes lose focus and size, highlighting only the relevant nodes without breaking the layout.
- **Filter Panel:** Interactive chips for filtering by cortex type and a dual-thumb slider for Energy range.
- **Camera Tools:** Integrated HUD with Zoom (+/-) and Fit View controls directly accessing the `OrbitControls` API.
- **Labels SDF:** High-performance 3D text labels for "Elite" nodes and search results, using Signed Distance Fields for crisp rendering.

### The Manifold Switcher — 4 Lenses on the same data

| Lens | Geometry | What it reveals |
| --- | --- | --- |
| **Poincaré** (default) | 2D hyperbolic disk | Hierarchy: abstract concepts at center, specific memories at the edges |
| **Riemann** | 3D rotatable sphere | Dialectical opposites at poles, synthesis at equator (Hegelian engine) |
| **Minkowski** | 3D spacetime | Causality: light cones, Timelike/Spacelike/Lightlike edges |
| **Emotion** | 2D Cartesian | Russell Circumplex: Valence × Arousal = the AI's memory "mood" |

---

## Architecture (Modular)
Perspektive.js is built as a modular system of 10 specialized agents:

1. **Layout Algorithms** (`src/layouts/`): Pure TS implementations of Force, Tree, Radial, and Concentric layouts.
2. **Node Interaction** (`src/interaction/`): Hooks for dragging, box-selection, and context menus.
3. **Graph Algorithms** (`src/algorithms/`): Centrality (PageRank, Betweenness), Pathfinding (Dijkstra, A*), and Community detection.
4. **Export System** (`src/export/`): High-res snapshotting to SVG, PNG, JSON, and GraphML.
5. **Theming/Styling** (`src/theme/`): Context-based theme system with Cyberpunk, Monochrome, and E-Ink presets.
6. **Advanced Edges** (`src/edges/`): Geodesic arcs, bundle routing, and temporal trails.
7. **Search & Filtering** (`src/search/`): Zustand-powered search engine with fuzzy matching and NodeLabels.
8. **Delta Streaming** (`src/streaming/`): `GraphStore` optimized for high-frequency incremental updates.
9. **Accessibility** (`src/a11y/`): Semantic descriptions and screen-reader support for graph structures.
10. **Test Suite** (`src/__tests__/`): Comprehensive validation of math and layout logic.

---

## Development Status

| Component | Status | Description |
| --- | --- | --- |
| Hyperbolic math (`poincare.ts`) | ✅ Done | Geodesics, distance, conformal scaling, WebGL vertices |
| Klein math (`klein.ts`) | ✅ Done | Poincaré↔Klein conversion, O(1) collinearity |
| Riemann math (`riemann.ts`) | ✅ Done | Stereographic projection, spherical midpoint |
| WebGL engine (`PoincareView.tsx`) | ✅ Done | InstancedMesh + Bloom HDR + AdditiveBlending |
| Cockpit UI (Search/Filter) | ✅ Done | Search dimming, Filter Panel, Camera HUD |
| Labels SDF | ✅ Done | High-perf labels for Elite/Searched nodes |
| Manifold Switcher | ✅ Done | 4 lenses with smooth Lerp 3D transitions |
| SSE & Delta Streaming | ✅ Done | EventSource + GraphStore mutation logic |
| 10 Internal Modules | ✅ Done | Full implementation of layouts, algorithms, interaction, etc. |
| Raycaster hover + tooltip | ✅ Done | Cyberpunk tooltip with ID, Energy, Type, Valence |
| Riemann sphere (3D) | ✅ Done | Stereographic projection + wireframe + OrbitControls |
| Minkowski light cones (3D) | ✅ Done | Cyan/magenta cones on elite nodes + spacetime grid |
| Backend REST (`nietzsche-server`) | 🟡 Pending | Verify `GET /api/graph` returns `embedding` array |
| WebSocket Protocol (v0.3.0) | ✅ Done | Full binary WebSocket protocol with NodeDelta support |

---

## Implemented Mathematics

### Geodesics on the Poincaré Disk
In hyperbolic space, the shortest path between two points **is not a straight line**. It is a circular arc that crosses the disk boundary at exactly 90 degrees (orthogonally).

Uses **Cramer's Rule** to find the center `(cx, cy)` of the orthogonal circle:
```typescript
cx = ((1 + ‖p1‖²) · p2.y - (1 + ‖p2‖²) · p1.y) / (2 · (p1.x · p2.y - p2.x · p1.y))
radius = √(cx² + cy² - 1)
```
Exception: if points are collinear with the origin, the geodesic is a Euclidean straight line.

### Hyperbolic Distance
```typescript
d(u,v) = acosh(1 + 2·‖u-v‖² / ((1-‖u‖²)(1-‖v‖²)))
```
Corresponds exactly to `HYPERBOLIC_DIST()` in NQL (NietzscheDB's query language).

### Conformal Factor (Visual Correction)
Nodes near the disk boundary appear smaller on screen, but in hyperbolic space they maintain their size. The `getVisualRadius()` function compensates using:
```typescript
conformalFactor = 2 / (1 - ‖x‖²)
visualRadius = baseEnergy / conformalFactor
```

### 256d → 2D Projection (The Radius Hack)
High-dimensional vectors are projected to the 2D disk while preserving hierarchy:
- **Direction**: first 2 embedding dimensions (angle on the disk)
- **Radius**: full vector norm (hyperbolic depth)

This ensures that abstract concepts (center) and specific memories (boundary) maintain their hierarchical positions even after dimensional flattening.

---

## Visual Aesthetics

### Cyberpunk Neon HDR
The visualization uses **HDR colors** (High Dynamic Range) — values above 1.0 that "bleed" light into neighboring pixels via Bloom:

| NodeType | Color | HDR Multiplier |
| --- | --- | --- |
| Semantic | `#00ff66` Matrix Emerald | 2× |
| Episodic | `#00f0ff` Electric Cyan | 2× |
| Concept | `#f59e0b` Amber | 2× |
| DreamSnapshot | `#8b5cf6` Violet | 2× |
| Pruned | `#1e293b` Dark Gray | 1× (no glow) |
| **Übermensch** (energy > 0.8) | `#ff00ff` Pure Magenta | **4×** (explosive halo) |

### AdditiveBlending on Edges
When geodesics overlap, WebGL **sums** the colors (`THREE.AdditiveBlending`). High-density zones in the graph glow like a biological brain with zero additional post-processing.

### Organic Breathing
Nodes interpolate smoothly to their target positions via Lerp (5% per frame), giving the sensation of a living organism. When the AI's energy changes, nodes don't teleport — they flow.

---

## Installation
```bash
npm install @nietzsche/perspektive
```

Or clone and run locally:
```bash
git clone https://github.com/JoseRFJuniorLLMs/perspektive.js.git
cd perspektive.js
npm install
npm run dev
```

---

## Usage

### Full Dashboard (recommended)
```tsx
import { PerspektiveEngine } from '@nietzsche/perspektive';

function App() {
  return <PerspektiveEngine collection="eva_core" apiBase="http://localhost:8080" />;
}
```

---

## Context: NietzscheDB
[NietzscheDB](https://github.com/JoseRFJuniorLLMs/NietzscheDB) is a hyperbolic graph database written in Rust, designed to be the long-term memory of autonomous AIs. Its features include:

- **Poincaré ball embeddings** — natural hierarchy (depth = radius)
- **4 geometries** — Poincaré, Klein, Riemann, Minkowski
- **L-System** — autonomous fractal node growth
- **Sleep cycle** — memory reconsolidation (perturbation + Hausdorff check)
- **Zaratustra** — autonomous evolution (Will-to-Power, Eternal Recurrence, Übermensch)
- **Daemons** — autonomous agents patrolling the graph
- **Heat kernel diffusion** — multi-scale activation propagation
- **Dream queries** — speculative exploration with rollback
- **Schrödinger edges** — probabilistic edges with contextual collapse
- **NQL** — query language with 19+ types and built-in geometric functions

Perspektive.js exists to make all of this **visible**.

---

## Why "Perspektive"?
Three reasons:
1. **Nietzsche was German.** The database is called NietzscheDB. The visualization library honors this with the German spelling.
2. **Perspektivismus.** Nietzsche argued there is no "objective truth" — every truth is a perspective. This library materializes that: the same graph viewed through the Poincaré disk reveals hierarchy; through the Riemann sphere reveals dialectical opposites; through Minkowski reveals causality; through the Circumplex reveals emotion.
3. **Perspektive is an optics project.** It transforms coordinates from high-dimensional hyperbolic space to a 2D monitor screen while preserving meaning. It is a lens.

---

## License
MIT

---

*Built for NietzscheDB by [Jose Ricardo Figueroa Junior](https://github.com/JoseRFJuniorLLMs).*
