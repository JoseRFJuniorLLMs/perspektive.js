# AGI Visualization in Perspektive.js

Perspektive.js provides unique visualization capabilities specifically designed for AGI systems like NietzscheDB. These features go beyond standard graph rendering to provide a window into the "internal states" of an artificial mind.

## 1. Schrödinger Edges (Probabilistic Superposition)
In NietzscheDB, edges can be probabilistic ("Schrödinger Edges"). Perspektive.js visualizes this uncertainty using a custom GLSL shader.

- **Visual Effect**: The edge "flickers" or glitches based on its collapse probability. Higher probability = more solid line; Lower probability = more noise and transparency.
- **Implementation**: `src/materials/SchrodingerEdgeMaterial.ts`
- **Math**: The `discard` keyword is used in the fragment shader to create a temporal dithering effect proportional to `1.0 - probability`.

## 2. Kinetic Heat Flow (Energy Propagation)
To visualize how energy (activation) spreads through the graph, Perspektive.js uses the **Kinetic Flow Engine**.

- **Visual Effect**: Small glowing particles travel along the hyperbolic geodesics. The density and speed of these particles reflect the "heat" (activation level) of the edge.
- **Implementation**: `src/engine/KineticFlow.ts`
- **Algorithm**: Particles follow the exact circular arcs calculated by the Poincaré math core (Cramer's Rule logic).

## 3. Daemon Renderer (Autonomous Agents)
NietzscheDB has background agents called "Daemons" (Wiederkehr Daemons). Perspektive.js renders them as distinct geometric entities.

- **Visual Effect**: Octahedral or tetrahedral geometries that move between nodes. They represent autonomous background processes like GC (Niilista), L-System growth, or pruning.
- **Implementation**: `src/agents/DaemonRenderer.ts`

## 4. Manifold Overlays (The 5th Lens)
The Manifold Mixer allows for the simultaneous visualization of different properties.

- **Overlay Mode**: Geometry (positions) can be derived from one manifold (e.g., Poincaré hierarchy) while colors are derived from another (e.g., Emotional valence).
- **Use Case**: Identifying "traumatized" areas of hierarchy where high-importance nodes exhibit low emotional valence.

---

> [!NOTE]
> These features are designed to handle 60 FPS rendering even with 10k+ active particles by utilizing WebGL InstancedMesh and optimized shaders.
