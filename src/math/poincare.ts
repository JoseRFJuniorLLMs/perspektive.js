/**
 * Perspektive.js - Modulo de Matematica de Poincare
 * Calcula geodesicas e distancias para o Disco de Poincare (||x|| < 1.0)
 */

import * as THREE from 'three';

export interface Point2D {
  x: number;
  y: number;
}

export interface ArcGeodesic {
  type: 'arc';
  center: Point2D;  // Centro do circulo Euclidiano que forma o arco
  radius: number;   // Raio desse circulo Euclidiano
  startAngle: number;
  endAngle: number;
  ccw: boolean;     // Counter-Clockwise (Sentido anti-horario)
}

export interface LineGeodesic {
  type: 'line';
  p1: Point2D;
  p2: Point2D;
}

export type Geodesic = ArcGeodesic | LineGeodesic;

const EPSILON = 1e-6;

/**
 * Calcula a curva exata (geodesica) entre dois pontos no Disco de Poincare.
 * Essa curva e um arco de circulo que cruza a borda do disco a 90 graus.
 *
 * @param p1 Ponto de origem (no A)
 * @param p2 Ponto de destino (no B)
 * @returns Os parametros para renderizar o arco no Three.js/Canvas
 */
export function calculateGeodesic(p1: Point2D, p2: Point2D): Geodesic {
  // Quadrado da distancia da origem para cada ponto (||p||^2)
  const d1 = p1.x * p1.x + p1.y * p1.y;
  const d2 = p2.x * p2.x + p2.y * p2.y;

  // O determinante para o sistema de equacoes lineares
  const denominator = 2 * (p1.x * p2.y - p2.x * p1.y);

  // Se o denominador for ~0, os pontos sao colineares com a origem (passam pelo centro).
  // No espaco hiperbolico, retas que passam pelo centro SAO linhas retas euclidianas.
  if (Math.abs(denominator) < EPSILON) {
    return { type: 'line', p1, p2 };
  }

  // Solucao via Regra de Cramer para encontrar o centro (cx, cy) do circulo ortogonal
  const cx = ((1 + d1) * p2.y - (1 + d2) * p1.y) / denominator;
  const cy = (p1.x * (1 + d2) - p2.x * (1 + d1)) / denominator;

  // Como o circulo cruza o disco unitario (raio 1) a 90 graus, a relacao pitagorica dita que:
  // Raio_Ortogonal^2 = Distancia_do_Centro_a_Origem^2 - 1^2
  const radius = Math.sqrt(cx * cx + cy * cy - 1);

  // Calcula os angulos em relacao ao centro do NOVO circulo ortogonal
  let startAngle = Math.atan2(p1.y - cy, p1.x - cx);
  let endAngle = Math.atan2(p2.y - cy, p2.x - cx);

  // Precisamos garantir que desenhamos o arco *menor* da circunferencia,
  // que e a parte que fica estritamente dentro do disco unitario (||x|| < 1).
  let diff = endAngle - startAngle;

  // Normaliza a diferenca do angulo para o intervalo [-PI, PI]
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;

  const ccw = diff > 0; // Se a diferenca for positiva, desenhamos no sentido anti-horario

  return {
    type: 'arc',
    center: { x: cx, y: cy },
    radius,
    startAngle,
    endAngle,
    ccw,
  };
}

/**
 * Calcula a distancia hiperbolica real entre dois pontos no disco.
 * Perfeito para mapear a "forca" ou cor da aresta na renderizacao.
 * Corresponde exatamente a HYPERBOLIC_DIST do NQL.
 */
export function poincareDistance(p1: Point2D, p2: Point2D): number {
  const num = (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
  const norm1 = 1 - (p1.x ** 2 + p1.y ** 2);
  const norm2 = 1 - (p2.x ** 2 + p2.y ** 2);

  // Evita divisao por zero se o ponto estiver exatamente na borda (||x|| == 1)
  const den = Math.max(norm1 * norm2, EPSILON);

  return Math.acosh(1 + 2 * (num / den));
}

/**
 * Mapeamento da "Energia" (Dirichlet/L-System) para tamanho visual.
 * Os nos perto da borda parecem menores no espaco Euclidiano, mas no espaco
 * hiperbolico eles mantem seu tamanho. Esta funcao compensa visualmente.
 */
export function getVisualRadius(p: Point2D, baseEnergy: number): number {
  const norm = Math.sqrt(p.x * p.x + p.y * p.y);
  // Fator conformal do disco de Poincare: 2 / (1 - ||x||^2)
  const conformalFactor = 2 / (1 - norm * norm);

  // Se quisermos que o no pareca ter um tamanho constante no espaco hiperbolico,
  // precisamos "encolhe-lo" no canvas euclidiano conforme ele se aproxima da borda.
  return baseEnergy / conformalFactor;
}

/**
 * Converte nossa matematica hiperbolica em vertices 3D para o WebGL.
 * Pega o calculo de Cramer e cospe vertices puros para a placa de video desenhar.
 */
export function buildGeodesicGeometry(p1: Point2D, p2: Point2D, segments = 32): THREE.BufferGeometry {
  const geo = calculateGeodesic(p1, p2);
  let points: THREE.Vector2[] = [];

  if (geo.type === 'line') {
    points.push(new THREE.Vector2(p1.x, p1.y));
    points.push(new THREE.Vector2(p2.x, p2.y));
  } else {
    // Three.js tem uma classe nativa perfeita para gerar os vertices do arco
    const curve = new THREE.EllipseCurve(
      geo.center.x, geo.center.y,
      geo.radius, geo.radius,
      -geo.startAngle, -geo.endAngle, // Three.js inverte o eixo Y na geracao
      !geo.ccw,
      0
    );
    points = curve.getPoints(segments);
  }

  // Converte Vector2 para Vector3 (z = 0) e joga na BufferGeometry
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return geometry;
}
