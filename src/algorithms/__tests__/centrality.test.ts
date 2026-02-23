/**
 * Centrality algorithm tests — uses the Graph class API
 */

import { describe, it, expect } from 'vitest';
import { Graph, type NodeData, type EdgeData } from '../types';
import { pageRank, betweennessCentrality } from '../centrality';

function node(id: string, x = 0, y = 0): NodeData {
  return { id, x, y, z: 0, energy: 0.5, node_type: 'Concept', embedding: [x, y] };
}

function edge(source: string, target: string, weight = 1): EdgeData {
  return { source, target, weight };
}

// ── PageRank ──────────────────────────────────────────────────────────────

describe('pageRank', () => {
  it('star graph: hub has highest rank', () => {
    // All leaves point to hub
    const nodes = ['hub', 'a', 'b', 'c', 'd'].map(id => node(id));
    const edges = ['a', 'b', 'c', 'd'].map(id => edge(id, 'hub'));
    const g = new Graph(nodes, edges, { directed: true });

    const ranks = pageRank(g);
    const hubRank = ranks.get('hub') ?? 0;
    const leafMax = Math.max(...['a', 'b', 'c', 'd'].map(id => ranks.get(id) ?? 0));
    expect(hubRank).toBeGreaterThan(leafMax);
  });

  it('isolated nodes share equal rank', () => {
    const nodes = ['x', 'y', 'z'].map(id => node(id));
    const g = new Graph(nodes, []);

    const ranks = pageRank(g);
    const rx = ranks.get('x') ?? 0;
    const ry = ranks.get('y') ?? 0;
    const rz = ranks.get('z') ?? 0;
    expect(Math.abs(rx - ry)).toBeLessThan(0.01);
    expect(Math.abs(ry - rz)).toBeLessThan(0.01);
  });

  it('ranks sum approximately to 1.0', () => {
    const nodes = ['a', 'b', 'c'].map(id => node(id));
    const edges = [edge('a', 'b'), edge('b', 'c')];
    const g = new Graph(nodes, edges, { directed: true });

    const ranks = pageRank(g);
    const total = [...ranks.values()].reduce((s, v) => s + v, 0);
    expect(total).toBeGreaterThan(0.8);
    expect(total).toBeLessThan(1.2);
  });
});

// ── Betweenness Centrality ────────────────────────────────────────────────

describe('betweennessCentrality', () => {
  it('path graph: endpoints have zero betweenness', () => {
    // A -- B -- C (undirected path)
    const nodes = ['A', 'B', 'C'].map(id => node(id));
    const edges = [edge('A', 'B'), edge('B', 'C')];
    const g = new Graph(nodes, edges); // undirected (default)

    const scores = betweennessCentrality(g);
    // In an undirected path A-B-C, B lies on all paths between A and C
    const sA = scores.get('A') ?? 0;
    const sB = scores.get('B') ?? 0;
    const sC = scores.get('C') ?? 0;
    expect(sA).toBe(0);
    expect(sC).toBe(0);
    expect(sB).toBeGreaterThan(0);
  });

  it('longer path: middle nodes have higher betweenness', () => {
    // A -- B -- C -- D (undirected)
    const nodes = ['A', 'B', 'C', 'D'].map(id => node(id));
    const edges = [edge('A', 'B'), edge('B', 'C'), edge('C', 'D')];
    const g = new Graph(nodes, edges);

    const scores = betweennessCentrality(g);
    const sA = scores.get('A') ?? 0;
    const sD = scores.get('D') ?? 0;
    const sB = scores.get('B') ?? 0;
    const sC = scores.get('C') ?? 0;
    expect(sB + sC).toBeGreaterThan(sA + sD);
  });
});
