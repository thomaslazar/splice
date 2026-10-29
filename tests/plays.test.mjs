import test from 'node:test';
import assert from 'node:assert/strict';
import { startState, toSave, fromSave, validSave } from '../src/core.js';
import { logFrom, attemptOf, open, startAttempt, resume, close, shot, use, setOn, trim, fileOf } from '../src/plays.js';

const deck = { frags: 3, items: { bomb: 1 } };
const mk = (S = startState(12, 0)) => attemptOf(S, { ice: null, deck, at: 'T' });

test('logFrom repairs anything', () => {
  for (const x of [null, 'x', { attempts: 5 }, { on: 'yes' }]) {
    const l = logFrom(x);
    assert.equal(l.v, 1); assert.equal(l.on, false); assert.deepEqual(l.attempts, []); assert.equal(l.id, null);
  }
  const a = [{ level: 1 }];
  assert.equal(logFrom({ on: true, id: 'abcdefgh', attempts: a }).attempts, a);
});

test('attemptOf', () => {
  const S = startState(12, 0), a = mk(S);
  assert.equal(a.level, 12); assert.equal(a.limit, S.maxShots); assert.equal(a.need, S.need);
  assert.equal(a.end, null); assert.equal(a.deck.bomb, 1);
});

test('startAttempt closes the open one', () => {
  const l = logFrom(null), a = mk(), b = mk();
  startAttempt(l, a); startAttempt(l, b);
  assert.equal(a.end, 'left'); assert.equal(open(l), b);
});

test('resume', () => {
  const S = startState(12, 0), l = logFrom(null), a = mk(S);
  startAttempt(l, a);
  assert.equal(resume(l, S), true); assert.equal(a.end, null);
  assert.equal(resume(l, startState(12, 1)), false); assert.equal(a.end, 'left');
});

test('close, shot and use', () => {
  const S = startState(12, 0), l = logFrom(null);
  shot(l, { n: 1 }); use(l, 'bomb'); assert.deepEqual(l.attempts, []);
  startAttempt(l, mk(S)); shot(l, { n: 1 }); use(l, 'bomb');
  assert.deepEqual(open(l).shots[1], { u: 'bomb', n: 2 });
  close(l, 'won', S, { frags: 9 });
  assert.equal(l.attempts[0].left, S.shots); assert.equal(l.attempts[0].paid.frags, 9); assert.equal(open(l), null);
});

test('setOn off drops the open attempt', () => {
  const l = logFrom(null);
  startAttempt(l, mk()); close(l, 'won'); startAttempt(l, mk());
  setOn(l, false); assert.equal(l.attempts.length, 1); assert.equal(open(l), null);
});

test('trim keeps the newest and the open one', () => {
  const l = logFrom(null);
  for (let i = 0; i < 200; i++) { const a = mk(); a.level = i; a.shots = Array.from({ length: 50 }, (_, n) => ({ n })); startAttempt(l, a); }
  trim(l, 20000);
  assert.ok(JSON.stringify(l).length <= 20000);
  assert.equal(l.attempts.at(-1).level, 199); assert.equal(open(l), l.attempts.at(-1));
});

test('fileOf', () => {
  const f = fileOf(logFrom(null), { w: 390 }, 'abc1234', new Date('2026-10-29T10:00:00Z'));
  assert.equal(f.name, 'splice-plays-2026-10-29.json');
  const o = JSON.parse(f.text); assert.equal(o.build, 'abc1234'); assert.equal(o.device.w, 390);
});

test('need in state and save', () => {
  const S = startState(5, 0);
  assert.ok(S.need > 0); assert.equal(fromSave(toSave(S)).need, S.need);
  const o = toSave(S); delete o.need; assert.equal(validSave(o), true);
});

test('report', async () => {
  const { report } = await import('../tools/plays.mjs');
  const sh = (n, s, pc) => ({ n, s, c: 0, sw: [], st: 0, x: 0, am: 0, a: 0, l: 0, p: 0, d: 0, f: 0, b: 9, pc });
  const A = (level, end, left, extra = {}) => ({ level, fails: 0, hardness: 0.1, ice: null, limit: 40, need: 20, deck: {}, t: 30, shots: [], end, left, ...extra });
  const file = { v: 1, attempts: [A(3, 'won', 10, { shots: [sh(1, 40, 0)] }),
    A(4, 'lost-shots', 0, { deck: { bomb: 1 } }), A(4, 'won', 5, { deck: { bomb: 1 } }), A(5, null, null)] };
  const r = report([file]);
  assert.match(r, /0-0\.25.*25%/); assert.match(r, /1 level took 2 tries/);
  assert.match(r, /lost with items held, none used: 1/); assert.match(r, /open: 1/);
});
