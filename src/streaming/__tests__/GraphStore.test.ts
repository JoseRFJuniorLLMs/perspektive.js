/**
 * GraphStore tests — uses correct NodeDelta format: { op, id, data? }
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GraphStore } from '../GraphStore';
import type { NodePayload, NodeDelta } from '../types';

function makeNode(id: string, overrides: Partial<NodePayload> = {}): NodePayload {
  return {
    id,
    node_type: 'Concept',
    energy: 0.5,
    embedding: [0.1, 0.2],
    x: 0,
    y: 0,
    z: 0,
    ...overrides,
  };
}

describe('GraphStore', () => {
  let store: GraphStore;

  beforeEach(() => {
    store = new GraphStore();
  });

  // ── loadFull ──────────────────────────────────────────────────────────────

  it('loadFull sets correct nodeCount', () => {
    store.loadFull([makeNode('a'), makeNode('b'), makeNode('c')], []);
    expect(store.getSnapshot().nodeCount).toBe(3);
  });

  it('loadFull sets correct edgeCount', () => {
    store.loadFull(
      [makeNode('a'), makeNode('b')],
      [{ source: 'a', target: 'b', weight: 1.0 }]
    );
    expect(store.getSnapshot().edgeCount).toBe(1);
  });

  it('loadFull clears previous state', () => {
    store.loadFull([makeNode('old')], []);
    store.loadFull([makeNode('new1'), makeNode('new2')], []);
    const snap = store.getSnapshot();
    expect(snap.nodeCount).toBe(2);
    expect(snap.nodes.map(n => n.id)).not.toContain('old');
  });

  // ── applyDelta ────────────────────────────────────────────────────────────

  it('applyDelta adds new (born) nodes', () => {
    store.loadFull([], []);
    const delta: NodeDelta = { op: 'born', id: 'n1', data: makeNode('n1') };
    store.applyDelta({
      seq: 1,
      timestamp: Date.now(),
      nodes: [delta],
      edges: [],
    });
    expect(store.getSnapshot().nodeCount).toBe(1);
  });

  it('applyDelta removes dead nodes', () => {
    store.loadFull([makeNode('n1')], []);
    store.applyDelta({
      seq: 2,
      timestamp: Date.now(),
      nodes: [{ op: 'died', id: 'n1' }],
      edges: [],
    });
    expect(store.getSnapshot().nodeCount).toBe(0);
  });

  it('applyDelta updates changed nodes', () => {
    store.loadFull([makeNode('n1', { energy: 0.2 })], []);
    store.applyDelta({
      seq: 3,
      timestamp: Date.now(),
      nodes: [{ op: 'changed', id: 'n1', data: makeNode('n1', { energy: 0.9 }) }],
      edges: [],
    });
    const snap = store.getSnapshot();
    expect(snap.nodes[0].energy).toBe(0.9);
  });

  it('rejects stale delta (seq <= lastSeq)', () => {
    store.loadFull([makeNode('n1')], []);
    // Apply seq 10 first
    store.applyDelta({ seq: 10, timestamp: Date.now(), nodes: [], edges: [] });
    // Now apply with lower seq — should be rejected
    const accepted = store.applyDelta({
      seq: 5,
      timestamp: Date.now(),
      nodes: [{ op: 'born', id: 'n2', data: makeNode('n2') }],
      edges: [],
    });
    expect(accepted).toBe(false);
    expect(store.getSnapshot().nodeCount).toBe(1);
  });

  // ── getSnapshot ───────────────────────────────────────────────────────────

  it('getSnapshot returns same reference if no mutation', () => {
    store.loadFull([makeNode('n1')], []);
    const snap1 = store.getSnapshot();
    const snap2 = store.getSnapshot();
    expect(snap1).toBe(snap2);
  });

  it('getSnapshot returns new reference after mutation', () => {
    store.loadFull([makeNode('n1')], []);
    const snap1 = store.getSnapshot();
    store.applyDelta({
      seq: 1,
      timestamp: Date.now(),
      nodes: [{ op: 'born', id: 'n2', data: makeNode('n2') }],
      edges: [],
    });
    const snap2 = store.getSnapshot();
    expect(snap1).not.toBe(snap2);
  });

  // ── subscribe ─────────────────────────────────────────────────────────────

  it('subscribe fires listener on mutation', () => {
    let fired = 0;
    store.subscribe(() => fired++);
    store.loadFull([makeNode('x')], []);
    expect(fired).toBeGreaterThan(0);
  });
});
