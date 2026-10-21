import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = f => JSON.parse(readFileSync(new URL(`../lang/${f}`, import.meta.url), 'utf8'));
const langs = read('languages.json'), en = read('en.json');
const holes = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();

test('every listed language has a file, every file is listed', () => {
  assert.ok(langs.en, 'English is the base language');
  const files = readdirSync(new URL('../lang/', import.meta.url)).filter(f => f !== 'languages.json').map(f => f.replace(/\.json$/, ''));
  assert.deepEqual(files.sort(), Object.keys(langs).sort());
});
for (const code of Object.keys(langs)) test(`${code}.json matches en.json`, () => {
  const tr = read(`${code}.json`);
  assert.deepEqual(Object.keys(tr).sort(), Object.keys(en).sort(), 'same keys as en.json');
  for (const k in en) {
    assert.equal(typeof tr[k], 'string', k); assert.ok(tr[k].trim(), `${k} is empty`);
    assert.deepEqual(holes(tr[k]), holes(en[k]), `${k}: same {placeholders} as en.json`);
    assert.ok(!tr[k].includes('—'), `${k}: no em-dashes`);
  }
});
test('the UI uses exactly the keys in en.json', () => {
  const ui = readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');
  const used = new Set([...ui.matchAll(/\bt\('(\w+)'/g)].map(m => m[1]));
  assert.deepEqual([...used].sort(), Object.keys(en).sort());
});
