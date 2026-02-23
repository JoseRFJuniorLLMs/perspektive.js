/**
 * GeodesicEdgeShader.glsl — GPU Hyperbolic Geodesic Edge Renderer
 *
 * Replaces CPU geodesicPoints() (40 segments × N edges = N×40 JS iterations/frame)
 * with a vertex shader that computes arc positions on the GPU.
 *
 * Per-instance attributes (set via InstancedMesh / InterleavedBuffer):
 *   - aStart    vec2  — start point in Poincaré disk [-1,1]
 *   - aEnd      vec2  — end point in Poincaré disk
 *   - aCenter   vec2  — arc center (outside the disk for circular geodesics)
 *   - aRadius   float — arc radius (>= 0; 0 means straight line through origin)
 *   - aWeight   float — edge weight [0,1] → controls opacity and line width
 *   - aArcDir   float — +1.0 or -1.0 (CCW/CW arc direction)
 *   - aSegment  float — normalised segment index [0,1] along the arc
 *
 * Uniforms:
 *   - uConformalScale  float — Situational Modulator deformation factor
 *   - uTime            float — animation clock (seconds)
 *   - uLineWidth       float — base line half-width in NDC
 */

// ── Vertex Shader ──────────────────────────────────────────────────────────
#ifdef VERTEX_SHADER

attribute vec2  aStart;
attribute vec2  aEnd;
attribute vec2  aCenter;
attribute float aRadius;
attribute float aWeight;
attribute float aArcDir;
attribute float aSegment;   // [0, 1] — interpolation position along the arc
attribute float aSide;      // +1 or -1 — which side of the line strip

uniform float uConformalScale;
uniform float uTime;
uniform float uLineWidth;

varying float vWeight;
varying float vConformal;

// Poincaré conformal factor: λ(z) = 2 / (1 - |z|²)
float conformalFactor(vec2 z) {
    float r2 = dot(z, z);
    return 2.0 / max(1.0 - r2, 1e-5);
}

void main() {
    vec2 pos;

    if (aRadius < 1e-4) {
        // Degenerate: straight geodesic through origin (both points collinear with 0)
        pos = mix(aStart, aEnd, aSegment);
    } else {
        // Circular arc: reconstruct arc angle from center + radius + start/end angles
        float startAngle = atan(aStart.y - aCenter.y, aStart.x - aCenter.x);
        float endAngle   = atan(aEnd.y   - aCenter.y, aEnd.x   - aCenter.x);

        // Normalise arc direction
        float delta = endAngle - startAngle;
        if (aArcDir > 0.0 && delta < 0.0) delta += 6.28318530718;
        if (aArcDir < 0.0 && delta > 0.0) delta -= 6.28318530718;

        float angle = startAngle + delta * aSegment;
        pos = aCenter + vec2(cos(angle), sin(angle)) * aRadius;
    }

    // Apply Situational Modulator: conformal deformation toward origin
    float lambda = conformalFactor(pos);
    float deformStrength = (uConformalScale - 1.0) * 0.15;
    pos *= 1.0 + deformStrength * (lambda - 1.0);

    // Clamp inside the disk
    float lenSq = dot(pos, pos);
    if (lenSq > 0.98) pos *= 0.98 / sqrt(lenSq);

    vWeight    = aWeight;
    vConformal = lambda;

    // Slight breathing pulse on high-energy connections
    float pulse = 1.0 + 0.04 * sin(uTime * 2.0 + aWeight * 6.2831);
    pos *= pulse;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 0.0, 1.0);
}

#endif // VERTEX_SHADER


// ── Fragment Shader ────────────────────────────────────────────────────────
#ifdef FRAGMENT_SHADER

uniform float uConformalScale;

varying float vWeight;
varying float vConformal;

void main() {
    // HDR cyan, intensity shaped by weight and conformal factor
    float brightness = 0.1 + vWeight * 0.5;

    // Boost brightness near the boundary (high conformal factor = near edge of disk)
    float boundaryGlow = clamp((vConformal - 2.0) / 8.0, 0.0, 1.0);
    brightness += boundaryGlow * 0.3;

    // Situational Modulator: crisis → redshift toward cyan-white
    float crisis = clamp(uConformalScale - 1.0, 0.0, 1.0);
    vec3 baseColor = vec3(0.0, 0.847, 1.0);                 // #00D8FF Cyan
    vec3 crisisColor = vec3(1.0, 0.94, 0.8);                // warm white
    vec3 color = mix(baseColor, crisisColor, crisis * 0.4);

    // HDR multiply for Bloom post-processing
    color *= (1.5 + crisis * 2.0);

    gl_FragColor = vec4(color * brightness, brightness);
}

#endif // FRAGMENT_SHADER
