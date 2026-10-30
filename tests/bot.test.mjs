import test from 'node:test';
import assert from 'node:assert/strict';
import { solve, bestShot, needFor, limitFor, HUMAN_K, HUMAN_C } from '../src/bot.js';
import { startState, won, key } from '../src/core.js';
import { resolve, valueOf, itemPlan } from '../src/items.js';
import { shotsFor } from '../src/levels.js';

test('the bot clears early levels without a limit', () => {
  for (const lv of [1, 2, 3, 4, 5, 6]) { const r = solve(startState(lv, 0)); assert.ok(r.won, `level ${lv}`); assert.ok(r.used > 0); }
});
test('solve plays a copy and leaves the state alone', () => {
  const S = startState(3, 0), before = JSON.stringify([...S.grid]);
  solve(S); assert.equal(JSON.stringify([...S.grid]), before); assert.ok(!won(S));
});
test('the shot limit is the bot\'s need times HUMAN_K plus HUMAN_C, eased by fails', () => {
  assert.equal(limitFor(10), Math.ceil(10 * HUMAN_K + HUMAN_C));
  for (const f of [0, 5]) {
    const S = startState(3, f), probe = startState(3, f);
    assert.equal(S.shots, shotsFor(limitFor(needFor(probe)), f));
    assert.equal(startState(3, f).shots, S.shots, 'deterministic');
  }
});

import { iceFor } from '../src/hosts.js';
test('levels with ice get the ice factor in their limit', () => {
  assert.equal(limitFor(10, 'black'), Math.ceil(10 * HUMAN_K * 1.5 + HUMAN_C));
  assert.equal(limitFor(10, 'static'), Math.ceil(10 * HUMAN_K * 1.1 + HUMAN_C));
  assert.equal(limitFor(10, 'scrambler'), Math.ceil(10 * HUMAN_K * 1.25 + HUMAN_C));
  const lv = [...Array(200).keys()].map(i => i + 1).find(l => iceFor(l));
  const S = startState(lv, 0), probe = startState(lv, 0);
  assert.equal(S.shots, shotsFor(limitFor(needFor(probe), iceFor(lv)), 0));
});
test('the need is the middle of three runs with different colour luck', () => {
  const S = startState(12, 0), u = [0, 1, 2].map(s => solve(S, s).used);
  assert.ok(new Set(u).size > 1, `the salted runs should differ: ${u}`);
  assert.equal(needFor(S), [...u].sort((a, b) => a - b)[1]);
});

/* ---------- item bubbles ---------- */
test('the bot sets off a bomb when it clears more', () => {
  const rows = ['11111111', '1111111', '..1B....', '.22.....', '222.....', '.22.....'], grid = new Map();
  rows.forEach((s, r) => [...s].forEach((ch, c) => { if (ch !== '.') grid.set(key(r, c), ch === 'B' ? valueOf('bomb') : +ch); }));
  const S = { level: 1, fails: 0, cols: 8, grid, shots: 20, cur: 0, next: 0, hist: [], draws: 0, top: 0, salt: 0 };
  const b = bestShot(S), r = resolve(S, { ang: b.ang });
  assert.ok(r.fired.includes(key(2, 3)), 'bomb goes off');
  assert.ok(b.sc >= 5);
});
test('item levels: the bot still wins', () => {
  const lvs = []; for (let lv = 3; lv <= 120 && lvs.length < 5; lv++) if (itemPlan(lv).kind !== 'none') lvs.push(lv);
  for (const lv of lvs) assert.ok(solve(startState(lv, 0)).won, `level ${lv}`);
});
