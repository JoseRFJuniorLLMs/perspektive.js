/**
 * Math tests: Klein-Poincaré bijection
 */

import { describe, it, expect } from 'vitest';
import { poincareToKlein, kleinToPoincare } from '../klein';

const EPS = 1e-6;

describe('Klein <-> Poincaré round-trip', () => {
  const testPoints = [
    { x: 0, y: 0 },
    { x: 0.3, y: 0.4 },
    { x: -0.5, y: 0.2 },
    { x: 0.0, y: 0.7 },
    { x: -0.6, y: -0.3 },
  ];

  for (const p of testPoints) {
    it(`round-trip (${p.x}, ${p.y})`, () => {
      const klein = poincareToKlein(p);
      const back = kleinToPoincare(klein);
      expect(back.x).toBeCloseTo(p.x, 5);
      expect(back.y).toBeCloseTo(p.y, 5);
    });
  }

  it('origin stays at origin', () => {
    const k = poincareToKlein({ x: 0, y: 0 });
    expect(k.x).toBeCloseTo(0, EPS);
    expect(k.y).toBeCloseTo(0, EPS);
  });

  it('Klein disk boundary ≤ 1', () => {
    const point = { x: 0.8, y: 0.0 };
    const k = poincareToKlein(point);
    const r = Math.sqrt(k.x * k.x + k.y * k.y);
    expect(r).toBeLessThan(1.0 + EPS);
  });
});
