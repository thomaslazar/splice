import test from 'node:test';
import assert from 'node:assert/strict';
import { drawHost } from '../src/hostdraw.js';
import { hostFor, SHAPES } from '../src/hosts.js';

// a 2D context stub that counts drawing calls and keeps save/restore balanced
function stub() {
  const c = { calls: 0, depth: 0 };
  return new Proxy(c, { get: (o, k) => k in o ? o[k] : k === 'save' ? () => o.depth++ : k === 'restore' ? () => o.depth-- : () => o.calls++, set: (o, k, v) => (o[k] = v, true) });
}

test('every shape draws, with and without glitch', () => {
  for (const shape of SHAPES) for (const glitch of [0, .5]) {
    const g = stub(); drawHost(g, { ...hostFor(1), shape }, 100, 80, 50, '#fff', glitch, 1.3);
    assert.ok(g.calls >= 3, shape); assert.equal(g.depth, 0, shape);
  }
});
