/**
 * MobiusZoom tests
 */

import { describe, it, expect } from 'vitest';
import { MobiusZoom } from '../MobiusZoom';

const EPS = 1e-6;

describe('MobiusZoom', () => {
  it('starts with center at origin', () => {
    const z = new MobiusZoom();
    expect(z.center.x).toBe(0);
    expect(z.center.y).toBe(0);
  });

  it('project: origin maps to negative center', () => {
    const z = new MobiusZoom();
    z.center = { x: 0.3, y: 0.0 };
    const p = z.project({ x: 0, y: 0 });
    // T_a(0) = (0 - (-a)) / (1 - 0) = a = 0.3
    expect(p.x).toBeCloseTo(0.3, 4);
    expect(p.y).toBeCloseTo(0, 4);
  });

  it('project preserves the disk boundary (output |z| < 1)', () => {
    const z = new MobiusZoom({ maxRadius: 0.97 });
    z.center = { x: 0.5, y: 0.2 };
    const inputs = [
      { x: 0.9, y: 0.0 }, { x: -0.8, y: 0.3 },
      { x: 0.0, y: 0.95 }, { x: -0.7, y: -0.7 },
    ];
    for (const pt of inputs) {
      const q = z.project(pt);
      const r = Math.sqrt(q.x * q.x + q.y * q.y);
      expect(r).toBeLessThanOrEqual(1.0 + EPS);
    }
  });

  it('reset returns center to origin', () => {
    const z = new MobiusZoom();
    z.translate({ x: 0.5, y: 0.5 }, 100);
    z.reset();
    expect(z.center.x).toBeCloseTo(0, 5);
    expect(z.center.y).toBeCloseTo(0, 5);
  });

  it('translate clamps center to maxRadius', () => {
    const z = new MobiusZoom({ speed: 10, maxRadius: 0.5 });
    z.translate({ x: 1, y: 0 }, 1000);
    const r = Math.sqrt(z.center.x ** 2 + z.center.y ** 2);
    expect(r).toBeLessThanOrEqual(0.5 + EPS);
  });

  it('projectAll produces same count of nodes', () => {
    const z = new MobiusZoom();
    const nodes = [{ x: 0, y: 0 }, { x: 0.3, y: 0.2 }, { x: -0.5, y: 0.1 }];
    const projected = z.projectAll(nodes);
    expect(projected.length).toBe(nodes.length);
  });
});
