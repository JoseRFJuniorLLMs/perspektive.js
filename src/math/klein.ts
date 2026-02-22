/**
 * klein.ts — Projecoes no disco de Klein
 *
 * Responsavel por:
 * - Conversao Poincare <-> Klein: k = 2p / (1 + ||p||^2)
 * - Geodesicas como linhas retas (vantagem do Klein para pathfinding)
 * - Teste de colinearidade O(1)
 * - Projecao para visualizacao de caminhos A*
 */

import type { Point2D } from './poincare';

/** Converte ponto do disco de Poincare para o disco de Klein */
export function poincareToKlein(p: Point2D): Point2D {
  const norm2 = p.x * p.x + p.y * p.y;
  const scale = 2 / (1 + norm2);
  return { x: p.x * scale, y: p.y * scale };
}

/** Converte ponto do disco de Klein para o disco de Poincare */
export function kleinToPoincare(k: Point2D): Point2D {
  const norm2 = k.x * k.x + k.y * k.y;
  const scale = 1 / (1 + Math.sqrt(Math.max(1 - norm2, 0)));
  return { x: k.x * scale, y: k.y * scale };
}

/** Teste de colinearidade O(1) — tres pontos na mesma geodesica? */
export function isCollinear(a: Point2D, b: Point2D, c: Point2D, epsilon = 1e-6): boolean {
  const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return Math.abs(cross) < epsilon;
}
