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
  assert.equal(key(2, 3), 35);
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

import { trace, snap, viewTop, shooterPos, clampAim } from '../src/core.js';
import { winRows } from '../src/levels.js';

const full = (cols, rows) => { const g = new Map(); for (let r = 0; r < rows; r++) for (let c = 0; c < cellsIn(cols, r); c++) g.set(key(r, c), 0); return g; };

test('a straight shot into an empty board sticks to the ceiling', () => {
  const t = trace(new Map(), 10, -Math.PI / 2);
  assert.equal(t.cell[0], 0); assert.ok(t.cell[1] === 4 || t.cell[1] === 5);   // x = 10 is between columns 4 and 5; float noise picks either
});
test('a shot into a full board always lands in a free touching cell', () => {
  for (const cols of [8, 10, 12]) { const g = full(cols, 40);
    for (let a = -3.0; a <= -0.15; a += 0.07) { const t = trace(g, cols, a);
      assert.ok(t.cell, `no cell at ${a}`); const [r, c] = t.cell;
      assert.ok(!g.has(key(r, c))); assert.ok(r === 0 || nbrs(cols, r, c).some(([x, y]) => g.has(key(x, y)))); } }
});
test('shallow shots bounce off the walls and stay on the board', () => {
  const t = trace(new Map(), 10, -0.2);
  assert.ok(t.pts.length > 3, 'expected bounces');
  for (const p of t.pts) assert.ok(p.x >= 1 - 1e-9 && p.x <= 19 + 1e-9);
});
test('trace is deterministic', () => {
  const g = full(10, 6); assert.deepEqual(trace(g, 10, -1.1), trace(g, 10, -1.1));
});
test('view keeps the lowest bubble 4 rows above the shooter', () => {
  const g = full(10, 60), top = viewTop(g, 10);
  assert.equal(top, 59 - (winRows(10) - 5));
  assert.ok(Math.abs(shooterPos(g, 10).y - (1 + (59 + 4) * Math.sqrt(3))) < 1e-9);
  assert.equal(viewTop(full(10, 3), 10), 0);
});
test('aim is clamped and never points down', () => {
  assert.equal(clampAim(0.3), null); assert.equal(clampAim(-0.01), -0.12); assert.equal(clampAim(-3.1), -Math.PI + 0.12);
});
