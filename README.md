<div align="center">

<img src="https://raw.githubusercontent.com/JoseRFJuniorLLMs/perspektive.js/main/img/logo.gif" alt="perspektive.js — Multi-Manifold AI Graph Renderer" width="100%" />

# 👁️ perspektive.js

**The first open-source multi-manifold React renderer for Neuro-Symbolic AI**

[![npm version](https://img.shields.io/npm/v/perspektive?color=00d8ff&style=for-the-badge)](https://www.npmjs.com/package/perspektive)
[![license](https://img.shields.io/npm/l/perspektive?color=9933ff&style=for-the-badge)](LICENSE)
[![downloads](https://img.shields.io/npm/dm/perspektive?color=00ff88&style=for-the-badge)](https://www.npmjs.com/package/perspektive)
[![GitHub stars](https://img.shields.io/github/stars/JoseRFJuniorLLMs/perspektive.js?color=ffcc00&style=for-the-badge)](https://github.com/JoseRFJuniorLLMs/perspektive.js)

</div>

---

## 🧠 The Name: Nietzsche's *Perspektivismus*

> *"There are no facts, only interpretations."*
> — Friedrich Nietzsche, **Notebooks**, 1886

The name **perspektive** is not random. It comes directly from Nietzsche's central philosophical doctrine: **Perspektivismus** *(Perspectivism)*.

Nietzsche argued that **there is no single, God's-eye view of reality** — only perspectives. Every observation, every truth, every piece of knowledge is shaped by the position from which it is seen. A fact seen from one angle is a distortion seen from another. The richer your set of perspectives, the closer you get to truth.

This is *exactly* the problem with modern AI visualization:

We have been looking at high-dimensional AI thought from **a single Euclidean perspective** — and calling the resulting chaos "a graph."

**`perspektive.js`** was built to give AI interpretability its Nietzschean correction:

- 🌌 **Poincaré** is the perspective of *hierarchy* — where depth is infinite and the center is everywhere
- 🧭 **Klein** is the perspective of *direction* — where the shortest path is always a straight line
- ⏳ **Minkowski** is the perspective of *causality* — where time is a geometric axis, not an afterthought
- ⚛️ **Bloch** is the perspective of *superposition* — where a thought exists in multiple states until observed

Just as Nietzsche demanded we abandon the single "objective" lens, we demand you stop flattening intelligence into Euclidean space.

**See AI thoughts as they truly are — from every manifold at once.**

---

## 🌊 v0.3.0: Mathematical Synesthesia & The Portal

In v0.3.0, we break the screen barrier. Sound and Vision now obey the laws of non-Euclidean geometry.

### 🔊 Mathematical Synesthesia
Sound in `perspektive.js` is not a waveform; it's a **topological event**.
- **Hyperbolic Breathing**: Nodes pulse and glow using the authentic hyperbolic distance formula $d = \ln(\frac{1+r}{1-r})$.
- **Echo of the Abyss**: Background waves that compress infinitely at the boundary of the Poincaré Disk.
- **Fiber Optic Klein**: Geodesic edges pulse like high-speed neural signals.

### 👁️ The Neural Portal (WebXR)
Why look at the mind when you can walk inside it? 
- **Poincaré Ball**: Native WebXR support for Oculus Quest and Vision Pro. The 2D disk collapses into a 3D spherical abyss.
- **Physical Immersion**: Navigate 50,000+ nodes in 3D space with zero latency.

---

> Euclidean geometry failed the modern AI era.
>
> When we try to visualize RAGs, Knowledge Graphs and LLM memories in flat 2D space (D3.js, Vis.js, Cytoscape), the result is always the same useless hairball.

**`perspektive.js`** is the first React + WebGL library built from scratch to render AI thoughts across **real geometric manifolds** (*Multi-Manifold Rendering*).

## 🌌 Why Perspektive?

Standard graph libraries assume flat Euclidean space. Render 10,000+ LLM memory nodes and they collapse into visual noise.

The math behind LLMs lives in high-dimensional space — which behaves far more like **hyperbolic geometry** than flat space.

`perspektive.js` projects your graph coordinates directly into non-Euclidean manifolds via WebGL:

| Manifold | Visualization | Best for |
|---|---|---|
| 🌌 **Poincaré Disk** | Hierarchical trees with natural fractal compression at the edges | Hierarchical RAG, taxonomies |
| 🔮 **Poincaré Ball** | 3D Immersive spherical abyss for VR | Large-scale AGI knowledge walking |
| 🧭 **Klein Model** | Perfectly straight geodesic lines | Optimal semantic paths |
| ⏳ **Minkowski Light Cones** | Temporal causality made visible | AGI reasoning timelines |
| ⚛️ **Bloch Sphere** | Arousal and semantic entanglement as quantum states | Quantum associative memory |

## 🚀 Quick Start

```bash
npm install perspektive
```

### Basic Usage
```tsx
import { PerspektiveView } from 'perspektive';

const aiMemory = {
  nodes: [
    { id: '1', embedding: [0.1, 0.4, 0.2], label: 'Symptom X', energy: 0.9 },
    { id: '2', embedding: [-0.3, 0.2, 0.5], label: 'Treatment Y', energy: 0.5 }
  ],
  edges: [
    { source: '1', target: '2', weight: 0.8 }
  ]
};

function App() {
  return (
    <PerspektiveView
      data={aiMemory}
      manifold="poincare"
      enableWebXR={true} // Activate the Portal
    />
  );
}
```

### Activating the Synesthesia (Audio)
```tsx
import { AudioPulse } from 'perspektive';

const pulse = new AudioPulse();
pulse.play('/path/to/voice_of_eva.mp3');
// Shaders will react automatically to 'u_audioAmplitude'
```

## ✨ Features

- 🌌 **Hyperbolic Ball (VR)** — Native WebXR portal for immersive AGI exploration
- 🔊 **Mathematical Synesthesia** — Shaders that "hear" and react to sound via hyperbolic distance
- 🌌 **Poincaré Disk** — fractal expansion, zero overlap at scale
- 🧭 **Klein Model** — semantic routes as perfect straight lines
- ⏳ **Minkowski Light Cones** — see literally what caused what
- ⚛️ **Bloch Sphere** — quantum fidelity and semantic entanglement
- 🔀 **Counterfactual UI** — drag nodes to create "what-if" hypotheses
- ⏪ **Causal Scrubber** — rewind AGI decisions along the time axis
- 🗺️ **Fractal Loader** — hyperbolic lazy loading (unlimited nodes)
- 🌊 **Live Pregel Diffusion** — real-time Chebyshev heat diffusion
- 🫧 **Probability Cloud Shaders** — nodes as volumetric quantum clouds
- 👥 **Community Hulls** — Louvain clusters as colored convex hulls
- ✨ **A\* Path Highlight** — optimal routes with animated pulse
- 📦 **WebSocket Streaming** — GraphStore with delta-ops born/died/changed @ 60fps

## 🧩 API

```tsx
import {
  PerspektiveView,
  AudioPulse,
  useWebXR,
  EnterVRButton,
  GraphStore,
  useHyperbolicAudio
} from 'perspektive';
```

### PerspektiveView Props

```ts
interface PerspektiveProps {
  data: GraphData;
  manifold?: 'poincare' | 'poincare_ball' | 'klein' | 'minkowski' | 'emotion' | 'riemann';
  width?: number | string;
  height?: number | string;
  enableHeatDiffusion?: boolean;
  enableCounterfactual?: boolean;
  enableWebXR?: boolean; // NEW: Activate VR portal
  onNodeClick?: (node: NodeData) => void;
  theme?: 'cyberpunk' | 'minimal' | 'academic';
}
```

## 🧠 Powered by

Originally built as the visual cortex of [**NietzscheDB**](https://github.com/JoseRFJuniorLLMs/NietzscheDB) — The Temporal Hyperbolic Graph Database for AGI.

## 🤝 Contributing

PRs are very welcome. If you work with RAG, neuro-symbolic AI, AGI interpretability or differential geometry — you are exactly who makes this library grow.

```bash
git clone https://github.com/JoseRFJuniorLLMs/perspektive.js
cd perspektive.js
npm install
npm run dev
```

## License

**MIT** — Build the future of AGI interpretability.

---

<div align="center">

**[npm](https://www.npmjs.com/package/perspektive)** · **[GitHub](https://github.com/JoseRFJuniorLLMs/perspektive.js)** · **[NietzscheDB](https://github.com/JoseRFJuniorLLMs/NietzscheDB)**

*Stop flattening AI thoughts. See them as they truly are — in exponential space.* 👁️

</div>
