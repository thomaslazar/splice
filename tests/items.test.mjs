import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, PRICES, unlocked, lootFor, deckFrom, buy, take, give, owned, dist, ray, within, hits, useItem, payout } from '../src/items.js';
import { key, nbrs, trace, fire, won, toSave, fromSave, validSave } from '../src/core.js';
import { tierFor, iceFor, ICE } from '../src/hosts.js';
import { isLong } from '../src/levels.js';

test('thirteen items, unlocked in steps', () => {
  assert.equal(ITEMS.length, 13);
  assert.deepEqual(unlocked(1), ['bomb', 'sweep', 'pierce', 'wildcard', 'overclock', 'decrypt', 'icebreaker']);
  assert.deepEqual(unlocked(31).slice(7), ['star', 'lightning']);
  assert.equal(unlocked(61).length, 12); assert.equal(unlocked(91).length, 13);
  for (const i of ITEMS) assert.ok(PRICES[i.id] > 0, i.id);
});
test('loot: always on high stakes and harsh ice, from unlocked items, seeded', () => {
  for (let lv = 1; lv <= 300; lv++) {
    const l = lootFor(lv), ice = iceFor(lv);
    if (tierFor(lv) === 'high' || isLong(lv) || ICE[ice] === 'harsh') assert.ok(l, `level ${lv}`);
    if (l) assert.ok(unlocked(lv).includes(l), `level ${lv}: ${l}`);
    assert.equal(lootFor(lv), l, 'same on every call');
  }
});
test('loot chances: about 35% on lighter ice, about 5% elsewhere', () => {
  let li = 0, ln = 0, pi = 0, pn = 0;
  for (let lv = 1; lv <= 3000; lv++) {
    const ice = iceFor(lv); if (tierFor(lv) === 'high' || ICE[ice] === 'harsh') continue;
    if (ice) { li++; if (lootFor(lv)) ln++; } else { pi++; if (lootFor(lv)) pn++; }
  }
  assert.ok(ln / li > .28 && ln / li < .42, `lighter ice ${ln / li}`);
  assert.ok(pn / pi > .03 && pn / pi < .07, `plain ${pn / pi}`);
});
test('deckFrom cleans anything', () => {
  assert.deepEqual(deckFrom(null), { frags: 0, items: {} });
  assert.deepEqual(deckFrom({ frags: -5, items: { bomb: 2, nope: 3, sweep: -1, pierce: 1.5, star: '2' } }), { frags: 0, items: { bomb: 2 } });
  assert.deepEqual(deckFrom('junk'), { frags: 0, items: {} });
});
test('buy, take, give, owned', () => {
  const d = { frags: 400, items: {} };
  assert.deepEqual(buy(d, 'bomb'), { frags: 0, items: { bomb: 1 } }, 'exactly the price');
  assert.equal(buy({ frags: 399, items: {} }, 'bomb'), null, 'one short');
  assert.equal(buy(d, 'nope'), null);
  assert.deepEqual(d, { frags: 400, items: {} }, 'no mutation');
  assert.equal(take({ frags: 0, items: {} }, 'bomb'), null);
  assert.deepEqual(take({ frags: 0, items: { bomb: 1 } }, 'bomb'), { frags: 0, items: {} }, 'a zero count is dropped');
  assert.deepEqual(give({ frags: 0, items: {} }, 'star', 2), { frags: 0, items: { star: 2 } });
  assert.deepEqual(owned({ frags: 0, items: { star: 1, bomb: 2 } }), [['bomb', 2], ['star', 1]]);
});

/* ---------- effects ---------- */
// grid from rows of digits ('.' empty), offset rows as core.js; cols 8, top 0
const board = (rows, extra = {}) => {
  const grid = new Map();
  rows.forEach((s, r) => [...s].forEach((ch, c) => { if (ch !== '.') grid.set(key(r, c), +ch); }));
  return { level: 1, fails: 0, cols: 8, kind: 'designed', grid, shots: 20, maxShots: 20, score: 0, frags: 0,
    cur: 0, next: 0, hist: [], draws: 0, top: 0, startLow: rows.length - 1, load: null, breaker: 0, ...extra };
};
const aimAt = (S, r, c) => { for (let i = 0; i < 400; i++) { const a = -Math.PI + .15 + i * (Math.PI - .3) / 399;
  if (trace(S.grid, 8, a, 0).cell?.join() === `${r},${c}`) return a; } throw new Error('no angle'); };
const full = n => Array.from({ length: n }, (_, r) => '1'.repeat(r % 2 ? 7 : 8));
const keys = (rows, f) => new Set(rows.flatMap((s, r) => [...s].map((ch, c) => f(r, c, ch) ? key(r, c) : null).filter(k => k !== null)));
const same = (a, b) => assert.deepEqual([...a].sort((x, y) => x - y), [...b].sort((x, y) => x - y));

test('dist and within on the offset grid', () => {
  assert.equal(dist(8, key(2, 3), key(2, 5)), 2);
  for (const [r, c] of nbrs(8, 4, 4)) assert.equal(dist(8, key(4, 4), key(r, c)), 1);
  assert.equal(within(8, key(4, 4), 1).length, 7);
});
test('ray goes straight in six directions and stops at the edge', () => {
  const rays = [0, 1, 2, 3, 4, 5].map(d => ray(8, key(0, 0), d, 4));
  assert.ok(rays.filter(r => !r.length).length >= 4);
  for (let d = 0; d < 6; d++) { const r = ray(8, key(5, 3), d, 4); assert.ok(r.length >= 2);
    for (let i = 1; i < r.length; i++) assert.ok(nbrs(8, r[i - 1] >> 4, r[i - 1] & 15).some(([a, b]) => key(a, b) === r[i])); }
});
test('bomb clears everything within 2 cells of its landing cell', () => {
  const S = board(full(8)); S.grid.delete(key(7, 3)); S.grid.delete(key(7, 4));
  const h = hits(S, 'bomb', aimAt(S, 7, 3)), k = key(...h.cell);
  same(h.clear, within(8, k, 2).filter(x => S.grid.has(x))); assert.equal(h.land, null);
});
test('sweep clears its whole row', () => {
  const S = board(full(6)); S.grid.delete(key(5, 3));
  const h = hits(S, 'sweep', aimAt(S, 5, 3));
  same(h.clear, keys(full(6), (r, c) => r === 5 && S.grid.has(key(r, c))));
});
test('star clears six rays of 4', () => {
  const S = board(full(10)); S.grid.delete(key(9, 3));
  const h = hits(S, 'star', aimAt(S, 9, 3)), k = key(...h.cell);
  const want = new Set(); for (let d = 0; d < 6; d++) ray(8, k, d, 4).filter(x => S.grid.has(x)).forEach(x => want.add(x));
  same(h.clear, want); assert.ok(h.clear.size > 12);
});
test('purge clears one colour on screen only', () => {
  const S = board(['22222222', '2222222', '11111111', '1111111', '1111111'], { top: 2 });
  S.grid.delete(key(4, 3));
  const h = hits(S, 'purge', aimAt(S, 4, 3));
  assert.ok(h.clear.size > 0); for (const k of h.clear) { assert.equal(S.grid.get(k), 1); assert.ok(k >> 4 >= 2); }
  assert.ok(!h.clear.has(key(0, 0)));
});
test('lightning climbs to the top, at most 8, preferring the nearer column', () => {
  const S = board(Array.from({ length: 9 }, (_, r) => r % 2 ? '...1...' : '...1....'));
  const h = hits(S, 'lightning', -Math.PI / 2);
  assert.ok(h.cell[0] >= 9); assert.equal(h.clear.size, 8);
  // two bubbles above the landing cell: the one in the landing column wins
  const F = board(['........', '.......', '........', '.......', '........', '.......', '........', '.......', '...11...']);
  const g = hits(F, 'lightning', aimAt(F, 9, 3));
  assert.deepEqual([...g.clear], [key(8, 3)]);
});
test('pierce clears the first 10 on its path and lands nowhere', () => {
  const S = board(full(8)), h = hits(S, 'pierce', -Math.PI / 2 + .01);
  assert.equal(h.cell, null); assert.equal(h.clear.size, 10); assert.equal(h.land, null);
});
test('wildcard joins the biggest touching group and pops it', () => {
  // landing (1,3) touches a pair of 1s and a single 2
  const S = board(['33311333', '..2....'], { cur: 4 });
  const a = aimAt(S, 1, 3), h = hits(S, 'wildcard', a);
  assert.equal(h.land, 1); S.load = 'wildcard'; const f = fire(S, a);
  assert.equal(f.popped.length, 3); assert.ok(!S.grid.has(key(1, 3)));
});
test('rainbow pops every touched group of 2 or more', () => {
  const S = board(['11223344', '1.2.3.4', '.......']);
  S.grid.delete(key(1, 1)); S.grid.delete(key(1, 3)); S.grid.set(key(1, 0), 1); S.grid.set(key(1, 2), 3);
  const a = aimAt(S, 1, 1), h = hits(S, 'rainbow', a);
  assert.ok(h.clear.size >= 2 && h.land === null);
  const cols = new Set([...h.clear].map(k => S.grid.get(k)));
  for (const c of cols) assert.ok(c >= 1 && c <= 4);
});
test('virus recolours within 4 and pops nothing', () => {
  const S = board(['11111111', '2222222', '3333333', '1111111'], { cur: 4 }); S.grid.delete(key(3, 3));
  const a = aimAt(S, 3, 3), h = hits(S, 'virus', a), n = S.grid.size; S.load = 'virus';
  assert.ok(h.recolour.size > 0);
  const f = fire(S, a);
  assert.equal(f.popped.length, 0); assert.equal(S.grid.size, n + 1);
  for (const k of h.recolour.keys()) assert.equal(S.grid.get(k), h.land);
});
test('firing an item keeps the shots and the packets, and clears the load', () => {
  const S = board(['11111111', '2222222', '3333333', '1111111'], { cur: 1, next: 2, load: 'bomb' });
  S.grid.delete(key(3, 3)); const f = fire(S, aimAt(S, 3, 3));
  assert.ok(f.popped.length > 0); assert.equal(S.shots, 20); assert.equal(S.cur, 1); assert.equal(S.next, 2); assert.equal(S.load, null);
});
test('dropped bubbles add pending frags, popped ones do not', () => {
  // a 1 landing at (1,0) pops (0,0),(0,1) with it and cuts the 3s hanging from (0,1)
  const S = board(['11.22222', '.3.2222', '.3.....'], { cur: 1 });
  const a = aimAt(S, 1, 0), f = fire(S, a);
  assert.ok(f.popped.length >= 3 && f.dropped.length >= 1);
  assert.equal(S.frags, f.dropped.length);
});
test('an item that clears the last colour wins', () => {
  const S = board(['11111111', '1111111'], { cur: 1, load: 'purge' });
  const f = fire(S, aimAt(S, 2, 3)); assert.ok(f && won(S));
});
test('an item that removes the current colour re-deals it', () => {
  const S = board(['22222222', '2222222', '...1....'.slice(0, 8)], { cur: 1, next: 1, load: 'bomb' });
  const f = fire(S, aimAt(S, 2, 2)); assert.ok(f && !new Set(S.grid.values()).has(1));
  assert.ok(S.grid.size); const has = new Set(S.grid.values()); assert.ok(has.has(S.cur) && has.has(S.next));
});
test('saves keep load, breaker and pending frags; old saves get defaults', () => {
  const S = board(['11', '1'], { load: 'bomb', breaker: 3, frags: 7 });
  const o = JSON.parse(JSON.stringify(toSave(S)));
  assert.ok(validSave(o)); const b = fromSave(o); assert.deepEqual([b.load, b.breaker, b.frags], ['bomb', 3, 7]);
  const old = { ...o }; delete old.load; delete old.breaker; delete old.frags;
  assert.ok(validSave(old)); const d = fromSave(old); assert.deepEqual([d.frags, d.load, d.breaker], [0, null, 0]);
  assert.ok(!validSave({ ...o, load: 'nope' })); assert.ok(!validSave({ ...o, load: 'overclock' })); assert.ok(!validSave({ ...o, frags: -1 }));
});
test('useItem: overclock adds 5, decrypt only to a colour on the board, a second shot item cannot load', () => {
  const S = board(['12', '1'], { cur: 1 });
  assert.ok(useItem(S, 'overclock')); assert.equal(S.shots, 25);
  assert.ok(!useItem(S, 'decrypt', 4)); assert.equal(S.cur, 1); assert.ok(useItem(S, 'decrypt', 2)); assert.equal(S.cur, 2);
  assert.ok(useItem(S, 'bomb')); assert.equal(S.load, 'bomb'); assert.ok(!useItem(S, 'sweep')); assert.equal(S.load, 'bomb');
  assert.ok(useItem(S, 'icebreaker')); assert.equal(S.breaker, 5); assert.ok(!useItem(S, 'rollback'));
});

test('payout: first win on the best level pays frags and loot, replays pay nothing', () => {
  const lv = [...Array(300).keys()].map(i => i + 1).find(l => lootFor(l));
  const S = { level: lv, grid: new Map(), frags: 42 };   // won: empty grid
  const p = payout({ frags: 10, items: {} }, S, lv);
  assert.equal(p.frags, 42); assert.equal(p.loot, lootFor(lv));
  assert.equal(p.deck.frags, 52); assert.equal(p.deck.items[lootFor(lv)], 1);
  const r = payout({ frags: 10, items: {} }, S, lv + 1);
  assert.deepEqual([r.frags, r.loot, r.deck.frags], [0, null, 10]);
  const notWon = payout({ frags: 10, items: {} }, { ...S, grid: new Map([[0, 1]]) }, lv);
  assert.equal(notWon.frags, 0);
});
