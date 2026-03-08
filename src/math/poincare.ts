/**
 * Perspektive.js - Modulo de Matematica de Poincare
 * Calcula geodesicas e distancias para o Disco de Poincare (||x|| < 1.0)
 */

import * as THREE from 'three';
import { 
  getWasmDistance, 
  getWasmGeodesic, 
  getWasmConformalFactor, 
  isWasmReady 
} from './wasm-bridge';

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
 */
export function calculateGeodesic(p1: Point2D, p2: Point2D): Geodesic {
  // --- WASM Path ---
  if (isWasmReady()) {
    const res = getWasmGeodesic(p1, p2);
    if (res.is_linear) {
      return { type: 'line', p1, p2 };
    }
    
    // Calcula os angulos aqui para evitar trafego de JsValue complexo
    let startAngle = Math.atan2(p1.y - res.cy, p1.x - res.cx);
    let endAngle = Math.atan2(p2.y - res.cy, p2.x - res.cx);
    let diff = endAngle - startAngle;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    
    return {
      type: 'arc',
      center: { x: res.cx, y: res.cy },
      radius: res.radius,
      startAngle,
      endAngle,
      ccw: diff > 0,
    };
  }

  // --- JS Fallback Path ---
  const d1 = p1.x * p1.x + p1.y * p1.y;
  const d2 = p2.x * p2.x + p2.y * p2.y;
  const denominator = 2 * (p1.x * p2.y - p2.x * p1.y);

  if (Math.abs(denominator) < EPSILON) {
    return { type: 'line', p1, p2 };
  }

  const cx = ((1 + d1) * p2.y - (1 + d2) * p1.y) / denominator;
  const cy = (p1.x * (1 + d2) - p2.x * (1 + d1)) / denominator;
  const radius = Math.sqrt(cx * cx + cy * cy - 1);

  let startAngle = Math.atan2(p1.y - cy, p1.x - cx);
  let endAngle = Math.atan2(p2.y - cy, p2.x - cx);
  let diff = endAngle - startAngle;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;

  return {
    type: 'arc',
    center: { x: cx, y: cy },
    radius,
    startAngle,
    endAngle,
    ccw: diff > 0,
  };
}

/**
 * Calcula a distancia hiperbolica real entre dois pontos no disco.
 */
export function poincaNietzscheDBtance(p1: Point2D, p2: Point2D): number {
  if (isWasmReady()) {
    return getWasmDistance(p1, p2);
  }

  const num = (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
  const norm1 = 1 - (p1.x ** 2 + p1.y ** 2);
  const norm2 = 1 - (p2.x ** 2 + p2.y ** 2);
  const den = Math.max(norm1 * norm2, EPSILON);

  return Math.acosh(1 + 2 * (num / den));
}

/**
 * Mapeamento da "Energia" para tamanho visual com compensacao conformal.
 */
export function getVisualRadius(p: Point2D, baseEnergy: number): number {
  let conformalFactorVal: number;
  
  if (isWasmReady()) {
    conformalFactorVal = getWasmConformalFactor(p);
  } else {
    const norm = Math.sqrt(p.x * p.x + p.y * p.y);
    conformalFactorVal = 2 / (1 - norm * norm);
  }

  return baseEnergy / conformalFactorVal;
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
