/**
 * Pathfinding algorithm tests — uses the Graph class API
 */

import { describe, it, expect } from 'vitest';
import { Graph, type NodeData, type EdgeData } from '../types';
import { dijkstraPath, aStar } from '../pathfinding';

function node(id: string, x = 0, y = 0): NodeData {
  return { id, x, y, z: 0, energy: 0.5, node_type: 'Concept', embedding: [x, y] };
}

function edge(s: string, t: string, weight: number): EdgeData {
  return { source: s, target: t, weight };
}

function makeGraph() {
  // A -1- B -2- C
  //  \         /
  //   4   -  3
  //     \D/
  const nodes = [
    node('A', 0, 0),
    node('B', 1, 0),
    node('C', 2, 0),
    node('D', 0.5, -1),
  ];
  const edges = [
    edge('A', 'B', 1), edge('B', 'A', 1),
    edge('B', 'C', 2), edge('C', 'B', 2),
    edge('A', 'D', 4), edge('D', 'A', 4),
    edge('D', 'C', 3), edge('C', 'D', 3),
  ];
  return new Graph(nodes, edges, { directed: true });
}

describe('dijkstraPath', () => {
  it('finds shortest path A→C via B (1+2=3) not via D (4+3=7)', () => {
    const g = makeGraph();
    const result = dijkstraPath(g, 'A', 'C');
    expect(result.path).toEqual(['A', 'B', 'C']);
    expect(result.distance).toBeCloseTo(3.0);
  });

  it('returns empty path for unreachable target', () => {
    const g = new Graph([node('X'), node('Y')], [], { directed: true });
    const result = dijkstraPath(g, 'X', 'Y');
    expect(result.path.length).toBe(0);
    expect(result.distance).toBe(Infinity);
  });

  it('source === target returns single-node path with cost 0', () => {
    const g = makeGraph();
    const result = dijkstraPath(g, 'A', 'A');
    expect(result.path).toEqual(['A']);
    expect(result.distance).toBe(0);
  });
});

describe('aStar', () => {
  it('finds same optimal path as Dijkstra', () => {
    const g = makeGraph();
    const dijkResult = dijkstraPath(g, 'A', 'C');
    const astarResult = aStar(g, 'A', 'C');
    expect(astarResult.path).toEqual(dijkResult.path);
    expect(astarResult.distance).toBeCloseTo(dijkResult.distance);
  });

  it('returns empty path when no route exists', () => {
    const g = new Graph([node('X'), node('Y')], [], { directed: true });
    const result = aStar(g, 'X', 'Y');
    expect(result.path.length).toBe(0);
    expect(result.distance).toBe(Infinity);
  });
});
