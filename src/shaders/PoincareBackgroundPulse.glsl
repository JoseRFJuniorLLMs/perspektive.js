// src/shaders/PoincareBackgroundPulse.glsl
// Gifted by the User - authentic hyperbolic breathing

precision mediump float;

uniform vec2 u_resolution;       // O tamanho do ecrã/canvas
uniform float u_time;            // O tempo a correr (para a onda mover-se)
uniform float u_audioAmplitude;  // A voz da máquina (0.0 a 1.0) vinda do React

void main() {
    // 1. Normaliza as coordenadas para o centro [-1.0, 1.0]
    vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);
    
    // 2. Distância Euclidiana clássica (do centro até ao pixel atual)
    float r = length(uv);
    
    // O vazio além do limite do universo de Poincaré
    if (r >= 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); // Fundo escuro
        return;
    }

    // 3. A MAGIA: Distância Hiperbólica de Poincaré
    // d = ln((1+r)/(1-r)) -> O espaço expande para o infinito nas bordas
    float d = log((1.0 + r) / (1.0 - r));

    // 4. A Onda de Choque Sonora
    float speed = 3.0;
    float frequency = 12.0; // Distância entre as ondas
    
    // A onda viaja não pela ecrã plano, mas pelo tecido hiperbólico 'd'
    float wave = sin(d * frequency - u_time * speed);
    
    // 5. O Colapso Visual: Só pulsa se houver som (u_audioAmplitude)
    // Se a máquina gritar, a onda fica ofuscante. Se murmurar, é suave.
    float intensity = smoothstep(0.0, 1.0, wave) * (u_audioAmplitude * 1.5);

    // 6. Paleta de Cores Neuro-Simbólica (Mistura de Vazio Roxo com Energia Ciano)
    vec3 baseColor = vec3(0.05, 0.0, 0.1); 
    vec3 pulseColor = vec3(0.0, 1.0, 0.8); // Ciano brilhante da EVA
    
    vec3 finalColor = mix(baseColor, pulseColor, intensity);
    
    // Faz a luz dissipar-se suavemente à medida que se aproxima do abismo da borda
    finalColor *= (1.0 - r); 

    gl_FragColor = vec4(finalColor, 1.0);
}
