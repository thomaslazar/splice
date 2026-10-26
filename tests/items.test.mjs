import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve, ITEMS, PRICES, unlocked, lootFor, deckFrom, buy, take, give, owned, dist, ray, within, hits, useItem, payout, ITEM_BASE, SHOTS, isItem, itemOf, valueOf, itemPlan, secOf, placeItems } from '../src/items.js';
import { hash, key, nbrs, trace, fire, won, lost, lossRow, deal, settle, startState, toSave, fromSave, validSave } from '../src/core.js';
import { tierFor, iceFor, ICE } from '../src/hosts.js';
import { isLong, makeLayout, colourize } from '../src/levels.js';

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
test('lightning climbs to the top, at most 8', () => {
  const S = board(Array.from({ length: 9 }, (_, r) => r % 2 ? '...1...' : '...1....'));
  const h = hits(S, 'lightning', -Math.PI / 2);
  assert.ok(h.cell[0] >= 9); assert.equal(h.clear.size, 8);
  // two bubbles above the landing cell: the one in the landing column wins
  const F = board(['........', '.......', '........', '.......', '........', '.......', '........', '.......', '...11...']);
  const g = hits(F, 'lightning', aimAt(F, 9, 3));
  assert.deepEqual([...g.clear], [key(8, 3)]);
});
test('lightning from a side hit steps to the neighbour with the lowest row, then climbs', () => {
  // a hanging line down column 0 (even rows) and 0 (odd rows); landing (2,1) touches row 1 and row 2 bubbles
  const S = board(['1.......', '1.......', '1.......', '1.......']);
  const a = aimAt(S, 2, 1), h = hits(S, 'lightning', a);
  assert.equal(h.cell.join(), '2,1');
  assert.ok(h.clear.has(key(1, 0)) && h.clear.has(key(0, 0)), 'climbs the line');
  assert.ok(!h.clear.has(key(2, 0)), 'does not take the same-row neighbour first');
});
test('an item with no effect returns null and is not spent', () => {
  const none = (id, rows, r, c) => { const S = board(rows, { load: id }), a = aimAt(S, r, c), before = new Map(S.grid);
    assert.equal(hits(S, id, a), null, id); assert.equal(fire(S, a), null); assert.equal(S.load, id); assert.deepEqual(S.grid, before); };
  none('rainbow', ['12121212', '.......'], 1, 1);   // every touched colour is alone
  none('virus', ['11111111', '1111111'], 2, 0);   // everything in range already has the hit colour
  none('sweep', ['1.......', '.......'], 1, 0);   // the landing row is empty
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
  assert.ok(h.popped.size >= 2 && h.land === null);
  const cols = new Set([...h.popped].map(k => S.grid.get(k)));
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
  assert.ok(!useItem(S, 'decrypt', 4)); S.grid.set(key(9, 0), 6); assert.ok(!useItem(S, 'decrypt', 6)); S.grid.delete(key(9, 0)); assert.equal(S.cur, 1); assert.ok(useItem(S, 'decrypt', 2)); assert.equal(S.cur, 2);
  assert.ok(useItem(S, 'bomb')); assert.equal(S.load, 'bomb'); assert.ok(!useItem(S, 'sweep')); assert.equal(S.load, 'bomb');
  assert.ok(useItem(S, 'icebreaker')); assert.equal(S.breaker, 5); S.breaker = 2; assert.ok(!useItem(S, 'icebreaker')); assert.equal(S.breaker, 2); S.breaker = 5; assert.ok(!useItem(S, 'rollback'));
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
  const again = payout({ frags: 10, items: {} }, S, lv, lv);   // already paid on this level
  assert.deepEqual([again.frags, again.loot, again.deck.frags], [0, null, 10]);
});

/* ---------- item bubbles ---------- */
const placed = (lv, fails = 0) => { const L = makeLayout(lv); return { L, grid: placeItems(L, lv, colourize(L, lv, fails)) }; };   // startState runs the bot: too slow here
const itemKeys = S => [...S.grid].filter(([, v]) => isItem(v));
test('item values map to shot ids', () => {
  assert.equal(ITEM_BASE, 6); assert.equal(SHOTS.length, 9);
  for (const id of SHOTS) assert.equal(itemOf(valueOf(id)), id);
  assert.ok(isItem(6) && !isItem(5));
});
test('item plan: none below 3, about a quarter with items, a fifth of those full', () => {
  for (let lv = 1; lv < 3; lv++) assert.equal(itemPlan(lv).kind, 'none');
  let has = 0, full = 0; const n = 2998;
  for (let lv = 3; lv <= 3000; lv++) { const k = itemPlan(lv).kind; if (k !== 'none') has++; if (k === 'full') full++; }
  assert.ok(has / n > .2 && has / n < .3, `items ${has / n}`); assert.ok(full / has > .13 && full / has < .27, `full ${full / has}`);
});
test('placement is seeded by level, not fails', () => {
  for (let lv = 3; lv <= 40; lv++) assert.deepEqual(itemKeys(placed(lv, 0)), itemKeys(placed(lv, 4)), `level ${lv}`);
});
test('only unlocked shot items are placed', () => {
  const bad = new Set(['star', 'lightning', 'virus', 'purge', 'rainbow']); let any = 0;
  for (let lv = 3; lv <= 30; lv++) for (const [, v] of itemKeys(placed(lv))) { any++; assert.ok(!bad.has(itemOf(v)), `level ${lv}`); }
  assert.ok(any > 0);
});
test('per screen: at most 2 on normal levels, at most 4 on full ones', () => {
  let seen = 0;
  for (let lv = 3; lv <= 60; lv++) { const S = placed(lv), sec = secOf(S.L, S.grid), per = new Map();
    for (const [k] of itemKeys(S)) { const b = Math.floor((k >> 4) / sec); per.set(b, (per.get(b) || 0) + 1); seen++; }
    for (const c of per.values()) assert.ok(c <= (itemPlan(lv).kind === 'full' ? 4 : 2), `level ${lv}`); }
  assert.ok(seen > 0);
});

/* ---------- colour rules ---------- */
test('only item bubbles left: won, they fall', () => {
  const S = board(['16', '66']); S.grid.set(key(0, 1), 7);
  assert.ok(!won(S)); const r = settle(S, [key(0, 0)]);
  assert.ok(won(S)); assert.equal(S.grid.size, 0); assert.equal(r.dropped.length, 3); assert.equal(S.frags, 0, 'item bubbles pay no frags');
});
test('deal never gives an item value', () => {
  const S = board(['1666', '6666', '6666']); S.hist = [];
  for (let i = 0; i < 50; i++) assert.equal(deal(S), 1);
});
test('a v1 save is invalid now, v2 round-trips with item bubbles', () => {
  const S = startState(3, 0); S.grid.set(key(0, 0), 7);
  const sv = toSave(S); assert.equal(sv.v, 2); assert.ok(validSave(sv));
  assert.ok(fromSave(JSON.parse(JSON.stringify(sv))).grid.get(key(0, 0)) === 7);
  assert.ok(!validSave({ ...sv, v: 1 }));
  assert.ok(!validSave({ ...sv, grid: [[0, 15]] })); assert.ok(!validSave({ ...sv, cur: 7 }));
});
test('an item bubble on the loss line loses', () => {
  const S = board(['1']); S.grid.set(key(lossRow(S), 0), 6); assert.ok(lost(S));
});
test('virus and purge ignore item bubbles', () => {
  const S = board(['111', '2.6.']); S.grid.set(key(1, 1), 6); S.grid.set(key(1, 2), 6);
  const g = new Map(S.grid); const h = hits(S, 'virus', aimAt(S, 2, 0));
  if (h) for (const k of h.recolour.keys()) assert.ok(g.get(k) < 6);
  const P = board(['16', '66']); P.grid.set(key(1, 0), 1);
  const p = hits(P, 'purge', aimAt(P, 2, 0)); if (p) for (const k of p.clear) assert.ok(P.grid.get(k) < 6);
});

/* ---------- item bubbles and chains ---------- */
const V = id => valueOf(id);
test('a packet touching an item bubble sets it off', () => {
  const S = board(full(6)); S.grid.delete(key(5, 3)); S.grid.set(key(4, 3), V('sweep')); S.cur = 2;
  const R = resolve(S, { ang: aimAt(S, 5, 3) });
  assert.deepEqual(R.fired, [key(4, 3)]); assert.ok(R.clear.has(key(4, 3)));
  for (let c = 0; c < 7; c++) assert.ok(R.clear.has(key(4, c)), 'whole row of the item bubble');
});
test('two touched item bubbles both go off', () => {
  const S = board(full(6)); S.grid.delete(key(5, 3)); S.cur = 2;
  S.grid.set(key(4, 3), V('bomb')); S.grid.set(key(5, 2), V('sweep'));
  const f = fire(S, aimAt(S, 5, 3));
  assert.deepEqual(f.fired.sort((a, b) => a - b), [key(4, 3), key(5, 2)]);
  assert.ok(!S.grid.has(key(4, 3)) && !S.grid.has(key(5, 2)));
});
test('a bomb inside another bomb\'s blast chains', () => {
  const S = board(full(8)); S.grid.delete(key(7, 3)); S.cur = 2;
  S.grid.set(key(6, 3), V('bomb')); S.grid.set(key(4, 3), V('bomb'));   // second one 2 away from the first
  const R = resolve(S, { ang: aimAt(S, 7, 3) });
  assert.deepEqual(R.fired.sort((a, b) => a - b), [key(4, 3), key(6, 3)]);
  assert.ok(R.clear.has(key(2, 3)), 'the second blast reaches 2 further');
});
test('mutual chain: each goes off once', () => {
  const S = board(full(8)); S.grid.delete(key(7, 3)); S.cur = 2;
  S.grid.set(key(6, 3), V('bomb')); S.grid.set(key(6, 2), V('bomb'));
  const R = resolve(S, { ang: aimAt(S, 7, 3) });
  assert.equal(R.fired.length, 2);
});
const above = (r, c) => key(...nbrs(8, r, c).find(([x]) => x === r - 1));   // a neighbour of cell (r, c) in the row above
test('an item bubble in a colour pop does not go off', () => {
  const S = board(['.11.....', '.......'], { cur: 1 }); S.grid.set(key(0, 3), V('bomb')); S.grid.set(key(0, 7), 3);
  const R = resolve(S, { ang: aimAt(S, 0, 0) });   // lands at (0,0), pops (0,0) (0,1) (0,2); the bomb touches (0,2) only
  assert.deepEqual([...R.popped].sort((a, b) => a - b), [key(0, 0), key(0, 1), key(0, 2)]);
  assert.deepEqual(R.fired, []); assert.ok(R.after.has(key(0, 3)));
});
test('a falling item bubble does nothing', () => {
  const S = board(['.11.....', '2.......', '3.......'], { cur: 1 }); S.grid.set(key(2, 0), V('bomb')); S.grid.set(key(0, 7), 3);
  S.grid.set(key(0, 0), 1); S.grid.delete(key(0, 1)); S.grid.set(key(0, 1), 1); S.grid.delete(key(0, 2));
  const f = fire(S, aimAt(S, 0, 2));   // pops (0,0) (0,1) (0,2): everything hanging below them falls, including the item
  assert.deepEqual(f.fired, []); assert.ok(f.dropped.includes(key(2, 0))); assert.ok(!S.grid.has(key(2, 0)));
});
test('virus bubble spreads the colour of the packet that hit it', () => {
  const S = board(['11111111', '2222222', '3333333', '1111111'], { cur: 4 });
  const v = above(4, 3); S.grid.set(v, V('virus'));
  const R = resolve(S, { ang: aimAt(S, 4, 3) });
  assert.deepEqual(R.fired, [v]);
  assert.ok(R.recolour.size > 0); for (const x of R.recolour.values()) assert.equal(x, 4);
});
test('pierce bubble continues in the shot\'s direction', () => {
  const S = board(full(10)); S.grid.delete(key(9, 3)); S.cur = 2; const p = above(9, 3); S.grid.set(p, V('pierce'));
  const R = resolve(S, { ang: aimAt(S, 9, 3) });
  assert.deepEqual(R.fired, [p]); assert.ok(R.clear.size > 2 && R.clear.size <= 11);
  assert.ok([...R.clear].every(k => k >> 4 < 9), 'it flies up, not back down');
});
test('a chain that removes the next colour re-deals it', () => {
  const S = board(['11111111', '2222222', '.......'], { cur: 1, next: 2 }); S.grid.set(key(1, 3), V('sweep'));
  const f = fire(S, aimAt(S, 2, 3));   // the packet lands under the sweep bubble, row 1 goes, the packet falls
  assert.deepEqual(f.fired, [key(1, 3)]); assert.equal(S.next, 1); assert.equal(S.cur, 1);
});
test('the preview from hits equals what fire does', () => {
  for (const id of ['bomb', 'sweep', 'star', 'lightning', 'pierce', 'purge']) for (let seed = 1; seed <= 12; seed++) {
    const rows = Array.from({ length: 8 }, (_, r) => [...Array(r % 2 ? 7 : 8)].map((_, c) => (hash(seed, r, c) % 9) < 1 ? '.' : String(hash(seed, r, c, 2) % 3 + 1)).join(''));
    for (const ang of [-1.2, -1.57, -1.9, -2.4, -.8]) {
      const S = board(rows, { load: id }), h = hits(S, id, ang), before = new Map(S.grid); if (!h) continue;
      const f = fire(S, ang), removed = new Set([...before.keys()].filter(k => !S.grid.has(k))); for (const k of f.dropped) removed.delete(k);
      same(h.clear, removed);
    }
  }
});
