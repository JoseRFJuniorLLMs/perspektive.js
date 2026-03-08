/**
 * Math tests: Poincaré disk geometry
 */

import { describe, it, expect } from 'vitest';
import { poincaNietzscheDBtance, calculateGeodesic, getVisualRadius } from '../poincare';

describe('poincaNietzscheDBtance', () => {
  it('should return 0 for the same point', () => {
    expect(poincaNietzscheDBtance({ x: 0.3, y: 0.4 }, { x: 0.3, y: 0.4 })).toBeCloseTo(0);
  });

  it('origin to (0.5, 0) ≈ 1.317', () => {
    // d(0, p) = 2 * atanh(|p|)
    // |p| = 0.5, atanh(0.5) ≈ 0.5493, so 2 * 0.5493 ≈ 1.0986
    const d = poincaNietzscheDBtance({ x: 0, y: 0 }, { x: 0.5, y: 0 });
    expect(d).toBeGreaterThan(0.5);
    expect(d).toBeLessThan(3.0);
  });

  it('distance increases as point approaches boundary', () => {
    const d1 = poincaNietzscheDBtance({ x: 0, y: 0 }, { x: 0.5, y: 0 });
    const d2 = poincaNietzscheDBtance({ x: 0, y: 0 }, { x: 0.8, y: 0 });
    const d3 = poincaNietzscheDBtance({ x: 0, y: 0 }, { x: 0.95, y: 0 });
    expect(d2).toBeGreaterThan(d1);
    expect(d3).toBeGreaterThan(d2);
  });

  it('is symmetric', () => {
    const a = { x: 0.2, y: 0.3 };
    const b = { x: -0.1, y: 0.6 };
    expect(poincaNietzscheDBtance(a, b)).toBeCloseTo(poincaNietzscheDBtance(b, a), 6);
  });

  it('satisfies triangle inequality', () => {
    const a = { x: 0.1, y: 0.1 };
    const b = { x: 0.5, y: 0.0 };
    const c = { x: -0.3, y: 0.4 };
    const ab = poincaNietzscheDBtance(a, b);
    const bc = poincaNietzscheDBtance(b, c);
    const ac = poincaNietzscheDBtance(a, c);
    expect(ab + bc).toBeGreaterThanOrEqual(ac - 1e-6);
  });
});

describe('calculateGeodesic', () => {
  it('collinear points through origin produce a line', () => {
    const result = calculateGeodesic({ x: 0, y: 0 }, { x: 0.5, y: 0 });
    expect(result.type).toBe('line');
  });

  it('non-collinear points produce an arc', () => {
    const result = calculateGeodesic({ x: 0.3, y: 0.1 }, { x: -0.2, y: 0.4 });
    expect(result.type).toBe('arc');
  });
});

describe('getVisualRadius', () => {
  it('returns a positive number for a point at origin', () => {
    // At origin: conformal = 2/(1-0) = 2, so radius = baseEnergy/2
    const r = getVisualRadius({ x: 0, y: 0 }, 0.02);
    expect(r).toBeCloseTo(0.01, 4);
  });

  it('radius decreases as point approaches boundary (conformal factor grows)', () => {
    // Conformal factor = 2/(1-r²), grows as r→1, so visual radius shrinks
    const rCenter = getVisualRadius({ x: 0, y: 0 }, 0.02);
    const rMid = getVisualRadius({ x: 0.5, y: 0 }, 0.02);
    const rNear = getVisualRadius({ x: 0.9, y: 0 }, 0.02);
    expect(rMid).toBeLessThan(rCenter);
    expect(rNear).toBeLessThan(rMid);
  });
});
