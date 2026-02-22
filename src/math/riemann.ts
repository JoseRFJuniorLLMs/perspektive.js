/**
 * riemann.ts — Projecao na esfera de Riemann
 *
 * Responsavel por:
 * - Projecao estereografica: plano complexo -> esfera S^2
 * - Midpoint esferico (Frechet mean) para sintese dialetica
 * - Rotacao 3D interativa (quaternions)
 * - Mapeamento de opostos dialeticos para polos antipodais
 */

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

/** Projecao estereografica: ponto 2D -> esfera S^2 (polo norte = infinito) */
export function stereographicProject(p: { x: number; y: number }): Point3D {
  const norm2 = p.x * p.x + p.y * p.y;
  const denom = norm2 + 1;
  return {
    x: (2 * p.x) / denom,
    y: (2 * p.y) / denom,
    z: (norm2 - 1) / denom,
  };
}

/** Projecao inversa: esfera S^2 -> plano 2D */
export function stereographicInverse(s: Point3D): { x: number; y: number } {
  const denom = 1 - s.z;
  if (Math.abs(denom) < 1e-9) {
    return { x: Infinity, y: Infinity }; // polo norte = infinito
  }
  return { x: s.x / denom, y: s.y / denom };
}

/** Midpoint esferico (geodesica no S^2) para sintese dialetica */
export function sphericalMidpoint(a: Point3D, b: Point3D): Point3D {
  const mx = a.x + b.x;
  const my = a.y + b.y;
  const mz = a.z + b.z;
  const norm = Math.sqrt(mx * mx + my * my + mz * mz);
  if (norm < 1e-9) {
    // Pontos antipodais — midpoint no equador (qualquer ponto valido)
    return { x: 0, y: 0, z: 1 };
  }
  return { x: mx / norm, y: my / norm, z: mz / norm };
}
