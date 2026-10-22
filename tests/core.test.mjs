import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, hash, cellsIn, key, rc, centre, nbrs, connected,
  startState, deal, fire, won, lost, lossRow, toSave, fromSave, validSave } from '../src/core.js';

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

const board = (cols, cells) => new Map(cells.map(([r, c, col]) => [key(r, c), col]));
const stateWith = (cols, cells, cur, next = cur) =>
  Object.assign(startState(1, 0), { cols, grid: board(cols, cells), cur, next, hist: [], shots: 10, score: 0, top: viewTop(board(cols, cells), cols) });
// Find an angle whose traced landing cell is [r, c]; tests never guess angles.
const aimAt = (S, r, c) => { for (let a = -Math.PI + 0.12; a <= -0.12; a += 0.001) { const t = trace(S.grid, S.cols, a, S.top);
  if (t.cell && t.cell[0] === r && t.cell[1] === c) return a; } throw new Error(`no angle reaches ${r},${c}`); };

test('popping the anchor drops the chain below it', () => {
  const S = stateWith(10, [[0, 0, 1], [0, 1, 1], [1, 0, 2], [2, 0, 2], [3, 0, 2]], 1);
  const m = fire(S, aimAt(S, 0, 2));
  assert.equal(m.popped.length, 3); assert.equal(m.dropped.length, 3);
  assert.equal(S.grid.size, 0); assert.equal(m.points, 10 * 3 + 10 * 9);
});
test('two of a kind do not pop', () => {
  const S = stateWith(10, [[0, 4, 1]], 1), m = fire(S, aimAt(S, 0, 5));
  assert.equal(m.popped.length, 0); assert.equal(S.grid.size, 2); assert.equal(S.shots, 9);
});
test('clearing the board with the last shot is a win', () => {
  const S = stateWith(10, [[0, 4, 1], [0, 5, 1]], 1); S.shots = 1;
  const m = fire(S, aimAt(S, 1, 4));
  assert.equal(m.popped.length, 3); assert.ok(won(S)); assert.ok(!lost(S));
  assert.equal(fire(S, -1), null, 'no shots after a win');
});
test('the queue never holds a colour that left the board', () => {
  const S = stateWith(10, [[0, 4, 1], [0, 5, 1], [0, 0, 2]], 1, 1);
  fire(S, aimAt(S, 1, 4));
  assert.equal(S.cur, 2); assert.equal(S.next, 2);
});
test('dealing: board colours only, never three in a row, off-screen colours rarer', () => {
  const S = startState(12, 0), present = new Set(S.grid.values());
  const seq = Array.from({ length: 3000 }, () => deal(S));
  for (const c of seq) assert.ok(present.has(c));
  for (let i = 2; i < seq.length; i++) assert.ok(!(seq[i] === seq[i - 1] && seq[i] === seq[i - 2]), `three in a row at ${i}`);
  const S2 = startState(12, 0); assert.deepEqual(Array.from({ length: 50 }, () => deal(S2)), seq.slice(0, 50));
});
test('only one colour left: every packet is that colour', () => {
  const S = stateWith(10, [[0, 4, 3]], 3);
  for (let i = 0; i < 10; i++) assert.equal(deal(S), 3);
});
test('saves round-trip; broken saves are rejected', () => {
  const S = startState(7, 2), o = JSON.parse(JSON.stringify(toSave(S)));
  assert.ok(validSave(o)); assert.deepEqual(toSave(fromSave(o)), toSave(S));
  for (const bad of [null, {}, { ...o, v: 2 }, { ...o, cols: 9 }, { ...o, grid: 'x' }, { ...o, level: 0 },
    { ...o, hist: undefined }, { ...o, shots: 'x' }, { ...o, draws: -1 }, { ...o, kind: 'x' }, 'x', 42]) assert.ok(!validSave(bad));
});

test('the view never retracts when bubbles land lower', () => {
  const cells = []; for (let r = 0; r < 30; r++) cells.push([r, 0, 1 + (r % 3)]);
  const S = stateWith(10, cells, 5); S.top = viewTop(S.grid, 10);
  const top = S.top; assert.ok(top > 0);
  fire(S, aimAt(S, 30, 0));
  assert.equal(S.top, top); assert.ok(viewTop(S.grid, 10) > S.top, 'the old view would have moved down');
});
test('clearing lets the view move toward the ceiling', () => {
  const cells = []; for (let r = 0; r < 40; r++) cells.push([r, 0, 1 + (r % 3)]);
  const S = stateWith(10, cells, 1); S.top = viewTop(S.grid, 10);
  const before = S.top;
  for (let r = 10; r < 40; r++) S.grid.delete(key(r, 0));   // as if cleared
  fire(S, aimAt(S, 0, 5));
  assert.ok(S.top < before);
});
test('the view waits until only the top two visible rows hold bubbles', () => {
  const cells = []; for (let r = 0; r < 40; r++) cells.push([r, 0, 1 + (r % 3)]);
  for (let r = 27; r < 30; r++) for (let c = 1; c < 5; c++) cells.push([r, c, 4]);
  const S = stateWith(10, cells, 1); S.top = viewTop(S.grid, 10);
  const top = S.top; assert.equal(top, 27);
  for (let r = top + 3; r < 40; r++) S.grid.delete(key(r, 0));   // lowest bubble now in the third visible row, 15 on screen
  fire(S, aimAt(S, 0, 7));
  assert.equal(S.top, top);
  for (let c = 0; c < 5; c++) S.grid.delete(key(top + 2, c));   // only the top two visible rows left
  fire(S, aimAt(S, 0, 8));
  assert.ok(S.top < top);
});
test('the view also moves once 8 or fewer bubbles are on screen', () => {
  const cells = []; for (let r = 0; r < 40; r++) cells.push([r, 0, 1 + (r % 3)]);
  const S = stateWith(10, cells, 1); S.top = viewTop(S.grid, 10);
  const top = S.top;
  for (let r = top + 9; r < 40; r++) S.grid.delete(key(r, 0));   // 9 on screen, lowest far below the top rows
  fire(S, aimAt(S, 0, 7));
  assert.equal(S.top, top);
  S.grid.delete(key(top + 8, 0));   // 8 left on screen
  fire(S, aimAt(S, 0, 8));
  assert.ok(S.top < top);
});
test('dealing favours the colour that dominates the screen', () => {
  const cells = []; for (let r = 0; r < 40; r++) cells.push([r, 0, r < 27 ? 1 + (r % 5) : 0]);
  for (let r = 27; r < 40; r++) for (let c = 1; c < 3; c++) cells.push([r, c, 0]);
  const S = stateWith(10, cells, 0); S.top = viewTop(S.grid, 10);
  const seq = Array.from({ length: 3000 }, () => deal(S));
  assert.ok(seq.filter(c => c === 0).length / seq.length > 0.6, 'the only visible colour should come most of the time');
  assert.ok(seq.some(c => c !== 0), 'off-screen colours still come sometimes');
});
test('dealing favours the colours the shooter can reach', () => {
  const cells = []; for (let r = 0; r < 8; r++) for (let c = 0; c < (r % 2 ? 9 : 10); c++) cells.push([r, c, r < 6 ? 1 : 3]);
  const S = stateWith(10, cells, 3); S.top = 0;   // red fills most of the screen, but only the amber rows are reachable
  const seq = Array.from({ length: 3000 }, () => deal(S));
  const share = seq.filter(c => c === 3).length / seq.length;
  assert.ok(share > 0.6 && share < 0.85, `the reachable colour should be likely, not certain: ${share}`);
});
test('a bubble on the loss line loses even with shots left', () => {
  const S = stateWith(10, [[0, 4, 1]], 2); S.top = 0;
  S.grid.set(key(lossRow(S), 4), 2);
  assert.ok(lost(S)); assert.ok(S.shots > 0);
  S.grid.delete(key(lossRow(S), 4)); S.grid.set(key(lossRow(S) - 1, 4), 2);
  assert.ok(!lost(S));
});
test('saves keep the view top', () => {
  const S = startState(7, 0); S.top = 3;
  const o = JSON.parse(JSON.stringify(toSave(S)));
  assert.equal(fromSave(o).top, S.top); assert.ok(!validSave({ ...o, top: -1 })); assert.ok(!validSave({ ...o, top: undefined }));
});
