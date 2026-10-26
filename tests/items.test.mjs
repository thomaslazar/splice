import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, PRICES, unlocked, lootFor, deckFrom, buy, take, give, owned } from '../src/items.js';
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
