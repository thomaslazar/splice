import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { songFor, euclid, midi, SCALES, STEPS, ARRANGE, LOOP } from '../src/music.js';
import { ICE } from '../src/hosts.js';

const songs = Array.from({ length: 300 }, (_, i) => songFor(i + 1));

test('songs are deterministic and differ between levels', () => {
  assert.deepEqual(songFor(23), songFor(23));
  assert.ok(new Set(songs.map(s => JSON.stringify([s.bpm, s.root, s.scale, s.bass, s.arps]))).size > 280);
});
test('songs are well formed', () => {
  for (const s of songs) {
    assert.ok(s.bpm >= 122 && s.bpm <= 137, `bpm ${s.bpm}`);
    for (const k of ['kick', 'hat', 'open', 'clap', 'bass', 'gate', 'perc']) assert.equal(s[k].length, STEPS, k);
    for (const a of s.arps) { assert.equal(a.length, STEPS); for (const i of a) assert.ok(Number.isInteger(i) && i >= 0 && i < s.chords[0].length); }
    assert.equal(s.kick.filter((v, i) => i % 4 === 0 && v === 1).length, 4, 'four on the floor');
    assert.equal(s.sections.length, ARRANGE.length); assert.ok(LOOP < ARRANGE.length);
  }
});
test('every note is in the scale', () => {
  for (const s of songs) {
    const pcs = new Set(SCALES[s.scale].map(x => (s.root + x) % 12));
    for (const c of s.chords) for (const m of c) assert.ok(pcs.has(m % 12), `${s.id} ${m}`);
    for (const b of s.bass) if (b !== null) assert.ok(b === 0 || b === 12 || b === 7 || b === SCALES[s.scale][1]);
  }
});
test('ice shapes the track', () => {
  for (const ice of Object.keys(ICE)) assert.equal(songFor(40, ice).ice, ice);
  assert.ok(songFor(40, 'black').sections.every(x => !x.arp), 'black: no arp');
  assert.ok(songFor(40, 'lock').arps.every(a => a.every(i => i === 0)), 'lock: one note');
  assert.equal(songFor(40, 'scrambler').arps.length, 4);
  assert.ok(songFor(40, 'blink').gate.slice(10).every(g => !g), 'blink: the line drops out');
  assert.equal(songFor(40, 'jam').mix.delay, 0); assert.ok(songFor(40, 'lag').mix.delay > songFor(40, null).mix.delay);
  assert.ok(songFor(40, 'static').mix.crush > 0); assert.ok(songFor(40, 'jitter').mix.wobble > 0);
  assert.equal(songFor(40, null).id, '40:'); assert.equal(songFor(40, 'lag').id, '40:lag');
});
test('helpers', () => {
  assert.deepEqual(euclid(4, 16).map(Number).join(''), '1000100010001000');
  assert.equal(euclid(5, 16).filter(Boolean).length, 5);
  assert.equal(midi(36, SCALES.minor, 7), 48); assert.equal(midi(36, SCALES.minor, 2), 39);
});
test('no Math.random in the music or audio code', () => {
  for (const f of ['music.js', 'audio.js']) assert.ok(!readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8').includes('Math.random'));
});
