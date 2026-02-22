# Perspektive.js

**A hyperbolic telescope for artificial minds.**

Unified WebGL visualization engine for [NietzscheDB](https://github.com/JoseRFJuniorLLMs/NietzscheDB) — the world's only hyperbolic vector database. Renders knowledge graphs in real non-Euclidean geometry, with mathematically exact geodesics, at 60 FPS on the GPU.

> *"Perspektive"* is the German spelling of "perspective". Friedrich Nietzsche — the philosopher who gives the database its name — coined the concept of **Perspektivismus**: the idea that every truth depends on the observer's point of view. This library materializes that literally: the same knowledge graph can be viewed through 4 different geometric "lenses" (Poincaré, Riemann, Minkowski, Emotion), each revealing a hidden truth about the data.

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

### The Manifold Switcher — 4 Lenses on the same data

| Lens | Geometry | What it reveals |
|---|---|---|
| **Poincaré** (default) | 2D hyperbolic disk | Hierarchy: abstract concepts at center, specific memories at the edges |
| **Riemann** | 3D rotatable sphere | Dialectical opposites at poles, synthesis at equator (Hegelian engine) |
| **Minkowski** | 3D spacetime | Causality: light cones, Timelike/Spacelike/Lightlike edges |
| **Emotion** | 2D Cartesian | Russell Circumplex: Valence × Arousal = the AI's memory "mood" |

### Overlays (on top of any lens)

- **Diffusion Heatmap** — `DIFFUSE FROM $seed` result as a thermal camera
- **Energy Pulse** — nodes "breathe" based on the `energy` property

---

## Architecture

```
NietzscheDB REST API (/api/graph)
         │
         ▼
   PerspektiveEngine        SSE streaming + REST fallback
   projectToManifold()      256d → 2D/3D preserving hyperbolic depth
         │
         ▼
   GraphNodes                React Three Fiber (declarative Three.js)
   InstancedMesh             1 draw call = 100k+ nodes
   GraphEdges                Geodesics via Cramer's Rule → EllipseCurve
         │
         ▼
   GPU (WebGL)               Bloom HDR + AdditiveBlending = Neon Cyberpunk
```

### Tech Stack

| Layer | Technology |
|---|---|
| Rendering | Three.js via `@react-three/fiber` (R3F) |
| Post-processing | `@react-three/postprocessing` (HDR Bloom) |
| Data fetching | `@tanstack/react-query` + SSE (EventSource) |
| State management | `zustand` (Manifold Switcher) |
| Shaders | Custom GLSL (Vertex + Fragment) |
| Build | Vite (lib mode, tree-shakeable) |

---

## Project Structure

```
perspektive.js/
├── package.json                 @nietzsche/perspektive v0.1.0
├── tsconfig.json                strict, ESNext, react-jsx
├── vite.config.ts               lib mode, externals React/Three
│
├── docs/
│   └── biblioteca.md            Full architectural spec (7 libraries → 1 engine)
│
└── src/
    ├── index.ts                 Public exports
    │
    ├── core/
    │   ├── Engine.tsx           Main WebGL canvas (orchestrates manifolds)
    │   └── ManifoldContext.tsx   State: which lens is active + transitions
    │
    ├── math/                    Mathematical brain (zero UI dependencies)
    │   ├── poincare.ts          Geodesics, acosh distance, conformal factor, WebGL vertices
    │   ├── klein.ts             Poincaré↔Klein conversion, O(1) collinearity
    │   └── riemann.ts           Stereographic projection, spherical midpoint
    │
    ├── manifolds/               Geometry-specific renderers
    │   ├── PoincareView.tsx     Hyperbolic disk (Bloom + InstancedMesh)
    │   ├── MinkowskiView.tsx    Spacetime light cones
    │   └── EmotionView.tsx      Russell Circumplex (Valence × Arousal)
    │
    └── components/              Live data connectors
        ├── LivePoincareMap.tsx   REST fetch + projectTo2D + HUD overlay
        └── PerspektiveEngine.tsx Full dashboard: 4 manifolds, hover, lerp, SSE
```

---

## Implemented Mathematics

### Geodesics on the Poincaré Disk

In hyperbolic space, the shortest path between two points **is not a straight line**. It is a circular arc that crosses the disk boundary at exactly 90 degrees (orthogonally).

```
calculateGeodesic(p1, p2) → ArcGeodesic | LineGeodesic
```

Uses **Cramer's Rule** to find the center `(cx, cy)` of the orthogonal circle:

```
cx = ((1 + ‖p1‖²) · p2.y - (1 + ‖p2‖²) · p1.y) / (2 · (p1.x · p2.y - p2.x · p1.y))
radius = √(cx² + cy² - 1)
```

Exception: if points are collinear with the origin, the geodesic is a Euclidean straight line.

### Hyperbolic Distance

```
d(u,v) = acosh(1 + 2·‖u-v‖² / ((1-‖u‖²)(1-‖v‖²)))
```

Corresponds exactly to `HYPERBOLIC_DIST()` in NQL (NietzscheDB's query language).

### Conformal Factor (Visual Correction)

Nodes near the disk boundary appear smaller on screen, but in hyperbolic space they maintain their size. The `getVisualRadius()` function compensates using:

```
conformalFactor = 2 / (1 - ‖x‖²)
visualRadius = baseEnergy / conformalFactor
```

### 256d → 2D Projection (The Radius Hack)

High-dimensional vectors are projected to the 2D disk while preserving hierarchy:
- **Direction**: first 2 embedding dimensions (angle on the disk)
- **Radius**: full vector norm (hyperbolic depth)

This ensures that abstract concepts (center) and specific memories (boundary) maintain their hierarchical positions even after dimensional flattening.

### Stereographic Projection (Riemann Mode)

Maps the 2D plane onto the S² sphere using inverse stereographic projection:

```
x_sphere = 2·px / (1 + px² + py²)
y_sphere = 2·py / (1 + px² + py²)
z_sphere = (px² + py² - 1) / (1 + px² + py²)
```

Diametrically opposed concepts land at antipodal poles. Dialectical synthesis sits at the equator.

### Minkowski Spacetime (Causal Mode)

Maps the graph onto a 3D spacetime tower where Y = Time:
- **X, Z axes** = spatial dimensions (from embedding)
- **Y axis** = temporal dimension (derived from node energy)
- **Light cones** = translucent cones on elite nodes (energy > 0.8)
  - Cyan cone = future (pointing up)
  - Magenta cone = past (pointing down)

---

## Visual Aesthetics

### Cyberpunk Neon HDR

The visualization uses **HDR colors** (High Dynamic Range) — values above 1.0 that "bleed" light into neighboring pixels via Bloom:

| NodeType | Color | HDR Multiplier |
|---|---|---|
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

## Development Status

| Component | Status | Description |
|---|---|---|
| Hyperbolic math (`poincare.ts`) | ✅ Done | Geodesics, distance, conformal scaling, WebGL vertices |
| Klein math (`klein.ts`) | ✅ Done | Poincaré↔Klein conversion, O(1) collinearity |
| Riemann math (`riemann.ts`) | ✅ Done | Stereographic projection, spherical midpoint |
| WebGL engine (`PoincareView.tsx`) | ✅ Done | InstancedMesh + Bloom HDR + AdditiveBlending |
| React integration (`LivePoincareMap.tsx`) | ✅ Done | TanStack Query + projectTo2D + cyberpunk HUD |
| Manifold Switcher (`PerspektiveEngine.tsx`) | ✅ Done | 4 lenses with smooth Lerp 3D transitions |
| Raycaster hover + tooltip | ✅ Done | Cyberpunk tooltip with ID, Energy, Type, Valence |
| Riemann sphere (3D) | ✅ Done | Stereographic projection + wireframe + OrbitControls |
| Minkowski light cones (3D) | ✅ Done | Cyan/magenta cones on elite nodes + spacetime grid |
| SSE streaming | ✅ Done | EventSource with REST fallback |
| Smooth Lerp animation | ✅ Done | 3D position interpolation at 60fps |
| Backend REST (`nietzsche-server`) | 🟡 Pending | Verify `GET /api/graph` returns `embedding` array |
| Real-time delta streaming | ❌ Future | WebSocket/SSE sending only born/died deltas for 1M+ nodes |

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
npm run typecheck
```

## Usage

### Full Dashboard (recommended)

```tsx
import { PerspektiveEngine } from '@nietzsche/perspektive';

function App() {
  return <PerspektiveEngine collection="eva_core" apiBase="http://localhost:8080" />;
}
```

Includes: Manifold Switcher, SSE streaming, hover tooltips, Lerp animation, HUD overlay.

### Poincaré-only with TanStack Query

```tsx
import { LivePoincareMap } from '@nietzsche/perspektive';

function App() {
  return <LivePoincareMap collection="eva_core" apiBase="http://localhost:8080" />;
}
```

### Raw WebGL engine with your own data

```tsx
import { PoincareView } from '@nietzsche/perspektive';

const nodes = [
  { id: '1', x: 0.0, y: 0.0, energy: 0.95, node_type: 'Concept' },
  { id: '2', x: 0.6, y: 0.3, energy: 0.40, node_type: 'Episodic' },
];
const edges = [{ source: '1', target: '2', weight: 0.8 }];

function App() {
  return <PoincareView nodes={nodes} edges={edges} />;
}
```

### Standalone math functions

```typescript
import { poincare, klein, riemann } from '@nietzsche/perspektive';

// Hyperbolic distance (matches NQL's HYPERBOLIC_DIST)
const dist = poincare.poincareDistance({ x: 0.1, y: 0.2 }, { x: 0.5, y: 0.7 });

// Geodesic arc parameters for rendering
const geo = poincare.calculateGeodesic({ x: 0.3, y: -0.2 }, { x: -0.4, y: 0.6 });

// Poincaré → Klein conversion (geodesics become straight lines)
const kp = klein.poincareToKlein({ x: 0.5, y: 0.3 });

// Stereographic projection to S² sphere
const sphere = riemann.stereographicProject({ x: 0.4, y: -0.2 });
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

2. **Perspektivismus.** Nietzsche argued there is no "objective truth" — every truth is a perspective. This library materializes that: the same graph viewed through the Poincaré disk reveals hierarchy; through the Riemann sphere reveals dialectical opposites; through Minkowski reveals causality; through the Circumplex reveals emotion. Four truths. None complete on its own.

3. **Perspektive is an optics project.** Literally: it transforms coordinates from one space (256-dimensional hyperbolic) to another (2D monitor screen) while preserving meaning. It is a lens.

---

## License

MIT

---

*Built for NietzscheDB by [Jose Ricardo Figueroa Junior](https://github.com/JoseRFJuniorLLMs) and Claude.*
