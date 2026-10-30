import test from 'node:test';
import assert from 'node:assert/strict';
import { makeLayout, colourize, difficulty, winRows, shotsFor } from '../src/levels.js';
import { connected, rc } from '../src/core.js';

const levels = Array.from({ length: 60 }, (_, i) => i + 1);

test('layouts are deterministic and hang from the ceiling', () => {
  for (const lv of levels) {
    const L = makeLayout(lv);
    assert.deepEqual([...makeLayout(lv).cells], [...L.cells]);
    assert.equal(connected(L.cells, L.cols).size, L.cells.size, `level ${lv} has loose bubbles`);
  }
});
test('kinds, columns, screens and colours follow the rules', () => {
  assert.equal(makeLayout(1).kind, 'designed'); assert.equal(makeLayout(2).kind, 'designed');
  const kinds = { designed: 0, noise: 0 }, cols = { 8: 0, 10: 0, 12: 0 };
  for (let lv = 3; lv <= 400; lv++) { const L = makeLayout(lv); kinds[L.kind]++; cols[L.cols]++;
    if (L.kind === 'noise') assert.equal(L.screens, 2);
    else { const base = 4 + Math.round(difficulty(lv) * 4); assert.ok(L.screens >= base && L.screens <= base + 4); }
    assert.ok(L.nColours >= 3 && L.nColours <= 6); }
  assert.ok(kinds.noise > 60 && kinds.noise < 140, `noise share off: ${kinds.noise}`);
  for (const c in cols) assert.ok(cols[c] > 30, `${c} columns too rare`);
  assert.equal(winRows(10), 17);
});
test('noise levels are full rows', () => {
  const lv = levels.find(l => makeLayout(l).kind === 'noise'), L = makeLayout(lv);
  const rows = Math.max(...[...L.cells.keys()].map(k => rc(k)[0])) + 1;
  for (let r = 0; r < rows; r++) assert.equal([...L.cells.keys()].filter(k => rc(k)[0] === r).length, r % 2 ? L.cols - 1 : L.cols);
});
test('retry keeps the layout, recolours whole groups', () => {
  const lv = levels.find(l => makeLayout(l).kind === 'designed' && l > 10), L = makeLayout(lv);
  const a = colourize(L, lv, 0), b = colourize(L, lv, 1);
  assert.deepEqual([...a.keys()].sort(), [...b.keys()].sort());
  assert.notDeepEqual([...a], [...b]);
  for (const col of [a, b]) {
    const byGroup = new Map();
    for (const [k, g] of L.cells) { if (!byGroup.has(g)) byGroup.set(g, new Set()); byGroup.get(g).add(col.get(k)); }
    for (const [g, s] of byGroup) assert.equal(s.size, 1, `group ${g} has mixed colours`);
  }
  assert.ok(new Set(a.values()).size <= L.nColours);
});

test('the layout cache keeps only the last few levels', () => {
  const a = makeLayout(1);
  for (let lv = 100; lv < 110; lv++) makeLayout(lv);
  const b = makeLayout(1);
  assert.notEqual(a, b, 'level 1 was evicted and rebuilt');
  assert.deepEqual([...b.cells], [...a.cells]); assert.equal(makeLayout(1), b);
});
test('fails 1 to 3 do not ease; from the 4th, +10% per fail up to +40%', () => {
  for (const f of [0, 1, 2, 3]) assert.equal(shotsFor(50, f), 50);
  assert.equal(shotsFor(50, 4), 55); assert.equal(shotsFor(50, 7), 70); assert.equal(shotsFor(50, 12), 70);
});

import { hardness, boardHardness, runPos } from '../src/levels.js';
import { key, nbrs, cellsIn } from '../src/core.js';
import { iceFor } from '../src/hosts.js';

test('levels with ice get a lighter board, except black and monochrome', () => {
  for (let lv = 1; lv <= 400; lv++) { const ice = iceFor(lv);
    assert.equal(boardHardness(lv), (ice && ice !== 'black' && ice !== 'monochrome' ? .75 : 1) * hardness(lv)); }
});
test('hardness ramps over 30 levels and starts again', () => {
  assert.equal(hardness(1), 0); assert.equal(hardness(30), 1); assert.equal(hardness(31), 0);
  assert.ok(Math.abs(hardness(10) - 9 / 29) < 1e-9);
  assert.equal(runPos(1), 1); assert.equal(runPos(30), 30); assert.equal(runPos(31), 1);
});
// the ends of runs: hardness 1, every one with ICE, so a board at .75
const easy = Array.from({ length: 40 }, (_, i) => 1 + 30 * i), hard = easy.map(l => l + 29);
const designed = ls => ls.filter(l => makeLayout(l).kind === 'designed');
const stems = L => new Set([...L.cells.values()].filter(g => g >= 1e6).map(g => Math.floor(g / 1000))).size;   // a mirrored pair (grp, grp + 500) is one stem
const avg = (ls, f) => ls.reduce((a, l) => a + f(l), 0) / ls.length;
test('hard levels hang their shapes from more stems', () => {
  const e = avg(designed(easy), l => stems(makeLayout(l)) / makeLayout(l).screens), h = avg(designed(hard), l => stems(makeLayout(l)) / makeLayout(l).screens);
  assert.ok(h > 1.8 * e, `stems per screen ${e} -> ${h}`);
});
const sameNeighbour = (L, col) => { let s = 0, n = 0;
  for (const [k, c] of col) for (const [r, cc] of nbrs(L.cols, k >> 4, k & 15)) { const o = col.get(key(r, cc)); if (o !== undefined) { n++; if (o === c) s++; } }
  return s / n; };
test('hard levels break up colours', () => {
  // shape bubbles only: the strands between big parts (several colours on purpose) would swamp it
  const share = ls => avg(ls, l => { const L = makeLayout(l); return sameNeighbour(L, new Map([...colourize(L, l, 0)].filter(([k]) => L.cells.get(k) < 1e6))); });
  // compare within each kind: the easy and hard sets mix noise and designed levels differently
  for (const kind of ['designed', 'noise']) { const of = ls => ls.filter(l => makeLayout(l).kind === kind);
    assert.ok(share(of(hard)) < share(of(easy)) - 0.05, `${kind} same-colour neighbours ${share(of(easy))} -> ${share(of(hard))}`); }
  const groups = ls => avg(designed(ls), l => { const g = [...makeLayout(l).cells.values()].filter(g => g < 1e6); return new Set(g).size / g.length; });
  assert.ok(groups(hard) > 1.3 * groups(easy), 'more, smaller colour groups');
});
