import test from 'node:test';
import assert from 'node:assert/strict';
import { makeLayout, colourize, difficulty, winRows } from '../src/levels.js';
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
