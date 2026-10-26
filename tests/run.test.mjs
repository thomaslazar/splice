import test from 'node:test';
import assert from 'node:assert/strict';
import { runFrom, enter, clampLevel } from '../src/run.js';

test('runFrom keeps a valid run, else starts from the save', () => {
  assert.deepEqual(runFrom({ best: 22, fails: 3 }, 14, 0), { best: 22, fails: 3 });
  assert.deepEqual(runFrom(null, 30, 2), { best: 30, fails: 2 });
  for (const bad of [{}, { best: 0, fails: 0 }, { best: '5', fails: 0 }, { best: 5, fails: -1 }, { best: 2.5, fails: 0 }, 'x'])
    assert.deepEqual(runFrom(bad, 7, 1), { best: 7, fails: 1 });
  assert.equal(runFrom({ best: 5, fails: 0 }, 9, 0).best, 9);
});
test('enter: a new level becomes best with its fails', () => {
  assert.deepEqual(enter({ best: 22, fails: 4 }, 23, 0), { run: { best: 23, fails: 0 }, fails: 0 });
  assert.deepEqual(enter({ best: 22, fails: 4 }, 50, 0), { run: { best: 50, fails: 0 }, fails: 0 });
});
test('enter: the best level keeps its earned fails on every path', () => {
  assert.deepEqual(enter({ best: 22, fails: 4 }, 22, 0), { run: { best: 22, fails: 4 }, fails: 4 });   // back, pick, next from 21
  assert.deepEqual(enter({ best: 22, fails: 4 }, 22, 5), { run: { best: 22, fails: 5 }, fails: 5 });   // try again
});
test('enter: lower levels leave the run alone', () => {
  const run = { best: 22, fails: 4 };
  assert.deepEqual(enter(run, 14, 0), { run: { best: 22, fails: 4 }, fails: 0 });
  assert.deepEqual(enter(run, 1, 2), { run: { best: 22, fails: 4 }, fails: 2 });
  assert.deepEqual(run, { best: 22, fails: 4 });   // not mutated
});
test('clampLevel keeps typed numbers in 1..best', () => {
  assert.equal(clampLevel('14', 22, 9), 14);
  assert.equal(clampLevel('999', 22, 9), 22);
  assert.equal(clampLevel('0', 22, 9), 1);
  assert.equal(clampLevel('-3', 22, 9), 1);
  for (const junk of ['', 'abc', '12.5', ' ']) assert.equal(clampLevel(junk, 22, 9), 9);
  assert.equal(clampLevel('', 22, 40), 22);   // cur above best (a ?level visit) still clamps
});
