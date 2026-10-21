import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, hash, cellsIn, key, rc, centre, nbrs, connected } from '../src/core.js';

test('random is seeded and repeatable', () => {
  const a = mulberry32(hash(3, 4)), b = mulberry32(hash(3, 4));
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
  assert.notEqual(hash(1, 2), hash(2, 1));
});
test('offset rows: odd rows have one cell fewer and sit half a cell right', () => {
  assert.equal(cellsIn(10, 0), 10); assert.equal(cellsIn(10, 1), 9);
  assert.deepEqual(centre(0, 0), { x: 1, y: 1 });
  assert.equal(centre(1, 0).x, 2); assert.ok(Math.abs(centre(1, 0).y - (1 + Math.sqrt(3))) < 1e-9);
  assert.deepEqual(rc(key(37, 11)), [37, 11]);
});
test('neighbours: six inside, fewer on edges and the ceiling', () => {
  assert.equal(nbrs(10, 5, 4).length, 6);
  assert.equal(nbrs(10, 4, 4).length, 6);
  assert.equal(nbrs(10, 0, 0).length, 2);   // right, below
  assert.equal(nbrs(10, 2, 9).length, 3);   // even row, right edge
  for (const [r, c] of nbrs(10, 5, 4)) assert.ok(nbrs(10, r, c).some(([a, b]) => a === 5 && b === 4), 'symmetric');
});
test('connected finds what hangs from the ceiling', () => {
  const g = new Map([[key(0, 3), 1], [key(1, 3), 1], [key(2, 3), 1], [key(5, 5), 2]]);
  const s = connected(g, 10);
  assert.ok(s.has(key(2, 3))); assert.ok(!s.has(key(5, 5)));
});
