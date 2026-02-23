# Perspektive.js (v0.3.0)
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

The previous dashboard used Cosmograph and covered **~21% of features**. Perspektive.js covers the other 79% using a custom WASM-accelerated math core.

---

## Core Capabilities

### 🕹️ The Cockpit (Navigation HUD)
Integrated overlay for precise control over the artificial mind:
- **Search Bar Cibernética**: Real-time fuzzy search with **Dimming Effect**. Non-matching nodes lose focus and size via shader-based dimming.
- **Filter Panel**: Interactive chips for filtering by cortex type and dual-thumb sliders for Energy/Valence/Arousal.
- **Semantic Camera**: Integrated HUD with Zoom (+/-), Fit View, and Möbius navigation support.
- **Labels SDF**: High-performance 3D text labels using Signed Distance Fields, rendering only for "Elite" nodes or search matches.

### 🧠 AGI Visualization (The Introspection Layer)
- **Schrödinger Edges**: Probabilistic edges that "flicker" based on context collapse probability using custom GLSL shaders.
- **Kinetic Heat Flow**: Real-time rendering of activation propagation (Chebyshev diffusion) as particles traveling along hyperbolic geodesics.
- **Daemon Renderer**: Visual representation of autonomous background agents (Wiederkehr Daemons) as geometric anomalies.
- **Reasoning Trace**: Visual path tracking of multi-hop queries and logical deductions.

### 🌐 The Manifold Switcher — 4 Lenses
| Lens | Geometry | What it reveals |
| --- | --- | --- |
| **Poincaré** (default) | 2D hyperbolic disk | Hierarchy: abstract concepts at center, specific memories at the edges |
| **Riemann** | 3D rotatable sphere | Dialectical opposites at poles, synthesis at equator (Hegelian engine) |
| **Minkowski** | 3D spacetime | Causality: light cones, Timelike/Spacelike/Lightlike edges |
| **Emotion** | 2D Cartesian | Russell Circumplex: Valence × Arousal = the AI's "mood" |

---

## Tech Stack
- **Math Core**: Rust-compiled **WASM** for exact hyperbolic geodesics and Möbius transforms.
- **Render Engine**: **Three.js + React Three Fiber** with InstancedMesh for 100k+ nodes.
- **Compute**: **WebGPU**-accelerated force-directed layout engine.
- **Streaming**: Binary WebSocket + SSE protocol with Zstandard compression.
- **State**: **Zustand**-powered reactive graph store.

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

## Usage
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

---

## License
MIT — *Built for NietzscheDB by [Jose Ricardo Figueroa Junior](https://github.com/JoseRFJuniorLLMs).*
