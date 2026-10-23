import test from 'node:test';
import assert from 'node:assert/strict';
import { solve, limitFor, HUMAN_K, HUMAN_C } from '../src/bot.js';
import { startState, won } from '../src/core.js';
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
    assert.equal(S.shots, shotsFor(limitFor(solve(probe).used), f));
    assert.equal(startState(3, f).shots, S.shots, 'deterministic');
  }
});

import { iceFor } from '../src/hosts.js';
test('levels with ice get the ice factor in their limit', () => {
  assert.equal(limitFor(10, 'black'), Math.ceil(10 * HUMAN_K * 1.5 + HUMAN_C));
  assert.equal(limitFor(10, 'static'), Math.ceil(10 * HUMAN_K * 1.1 + HUMAN_C));
  const lv = [...Array(200).keys()].map(i => i + 1).find(l => iceFor(l));
  const S = startState(lv, 0), probe = startState(lv, 0);
  assert.equal(S.shots, shotsFor(limitFor(solve(probe).used, iceFor(lv)), 0));
});
