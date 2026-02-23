// GPGPU Kernel para simular a Vontade de Poder
uniform float time;
uniform float entropyScale; // Vem do EntropyDaemon
varying vec2 vUv;

// Note: snoise needs to be defined or included if not available in the environment
// For now, providing a placeholder implementation or assuming it's linked
float snoise(vec2 v) {
    // Simple noise placeholder - in a real implementation this would be a full Perlin/Simplex noise
    return fract(sin(dot(v, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec2 uv = vUv;
    // Simulação de turbulência hiperbólica baseada na métrica de Poincaré
    float d = length(uv);
    float conformalFactor = 2.0 / (1.0 - d * d); // Fator Conformal
    
    // O Caos: Ruído de Perlin modulado pela energia dos nós "Elite"
    vec3 chaos = vec3(snoise(uv * 10.0 + time), snoise(uv * 5.0 - time), 1.0);
    
    // A Estrela: Ativação por difusão de calor (Chebyshev)
    float heat = exp(-pow(d, 2.0) / (4.0 * entropyScale));
    
    vec3 color = mix(vec3(0.1, 0.0, 0.2), vec3(1.0, 0.0, 1.0), heat * chaos.x);
    gl_FragColor = vec4(color * conformalFactor, heat);
}
