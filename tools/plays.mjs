// Play log report: node tools/plays.mjs <file> [file ...]  (files shared from the menu's Play log)
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { hband } from './sim.mjs';

const TAP_MS = 300, TAP_PX = 10;   // as in src/ui.js

const med = a => a.length ? [...a].sort((x, y) => x - y)[a.length >> 1] : NaN;
const stat = a => a.length ? `n=${a.length} median ${med(a).toFixed(0)}% min ${Math.min(...a).toFixed(0)}% max ${Math.max(...a).toFixed(0)}%` : 'n=0';
const isUse = e => 'u' in e, held = a => Object.values(a.deck || {}).some(n => n > 0);
const usedAny = a => a.shots.some(e => isUse(e) || typeof e.c === 'string');

export function report(files) {
  const all = files.flatMap((f, i) => f.attempts.map(a => ({ ...a, k: i })));
  const done = all.filter(a => a.end !== null), wins = all.filter(a => a.end === 'won' && a.limit > 0);
  const out = [`attempts ${all.length}, open: ${all.length - done.length}, left: ${all.filter(a => a.end === 'left').length}`];
  const group = (title, key) => {
    const by = {}; for (const a of wins) (by[key(a)] ??= []).push(100 * a.left / a.limit);
    out.push('', title); for (const [k, v] of Object.entries(by).sort()) out.push(`  ${k.padEnd(10)} ${stat(v)}`);
  };
  group('shots left on a win, share of the limit, per hardness band', a => hband(a.level));
  group('per ICE', a => a.ice || 'none');
  const needs = wins.filter(a => a.need).map(a => 100 * a.need / a.limit);
  out.push(`  bot need as share of the limit: ${stat(needs)}`);

  const lv = {};
  for (const a of all) { const l = lv[`${a.k}:${a.level}`] ??= { tries: 0, won: false };
    if (!l.won && a.end && a.end !== 'left') { l.tries++; if (a.end === 'won') l.won = true; } }
  out.push('', 'tries per level (attempts until the win)');
  for (const n of [2, 3]) { const c = Object.values(lv).filter(l => l.won && l.tries === n).length; out.push(`  ${c} level${c === 1 ? '' : 's'} took ${n} tries`); }

  const H = all.filter(held), noUse = H.filter(a => !usedAny(a));
  out.push('', 'items', `  attempts holding items: ${H.length}`);
  const uses = {};
  for (const a of all) for (const e of a.shots) { const id = isUse(e) ? e.u : typeof e.c === 'string' ? e.c : null; if (!id) continue;
    const s = a.shots.find(x => !isUse(x) && x.n === e.n)?.s, pc = a.shots.find(x => !isUse(x) && x.n === e.n - 1)?.pc ?? 0;
    const u = uses[id] ??= { n: 0, s: [], pc: [] }; u.n++; if (s != null) u.s.push(s); u.pc.push(pc); }
  for (const [id, u] of Object.entries(uses).sort()) out.push(`  ${id.padEnd(10)} uses ${u.n}, shots left median ${u.s.length ? med(u.s) : 'n/a'}, progress median ${med(u.pc)}%`);
  out.push(`  lost with items held, none used: ${noUse.filter(a => a.end?.startsWith('lost')).length}`,
    `  close wins (10% of the limit or less left) with items held, none used: ${noUse.filter(a => a.end === 'won' && a.left <= .1 * a.limit).length}`);

  const sw = all.flatMap(a => a.shots.filter(e => !isUse(e)));
  const quick = sw.reduce((n, e) => n + e.sw.filter(([w, ms]) => w !== 'lock' && ms < 500).length, 0);
  const dbl = sw.reduce((n, e) => n + e.sw.filter(([, ms], i) => i && Math.abs(ms - e.sw[i - 1][1]) < 400).length, 0);
  out.push('', 'swaps', `  swaps under 500 ms before a release: ${quick}`, `  two swaps within 400 ms: ${dbl}`,
    `  aims started in the strip: ${sw.reduce((n, e) => n + (e.st || 0), 0)}`, `  cancelled aims: ${sw.reduce((n, e) => n + (e.x || 0), 0)}`,
    `  lock swaps: ${sw.reduce((n, e) => n + e.sw.filter(([w]) => w === 'lock').length, 0)}`);
  // ordered events (ev, newer logs): swaps undone before the shot, taps near the limits, re-deals
  const ev = sw.filter(e => e.ev), taps = ev.flatMap(e => e.ev.filter(([w, , src]) => w === 's' && src === 'tap'));
  const near = ev.flatMap(e => e.ev.filter(([w, , ms, px]) => w === 'u' && ms < 2 * TAP_MS && px < 2 * TAP_PX));
  if (ev.length) out.push(`  swaps undone before the shot (an even count of 2 or more): ${ev.filter(e => { const k = e.ev.filter(([w]) => w === 's').length; return k >= 2 && k % 2 === 0; }).length}`,
    `  swap taps: ${taps.length}, touch ms median ${taps.length ? med(taps.map(x => x[3])) : 'n/a'}, px median ${taps.length ? med(taps.map(x => x[4])) : 'n/a'}`,
    `  shots from the strip just past the tap limits (under ${2 * TAP_MS} ms and ${2 * TAP_PX} px): ${near.length}`,
    `  re-deals: ${ev.reduce((n, e) => n + e.ev.filter(([w]) => w === 'r').length, 0)}`);

  const t = done.filter(a => a.end !== 'left').map(a => a.t);
  out.push('', `time per finished attempt (median): ${t.length ? med(t).toFixed(0) + ' s' : 'n/a'}`);
  return out.join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fs = process.argv.slice(2).map(p => JSON.parse(readFileSync(p, 'utf8')));
  fs.forEach((f, i) => console.log(`== ${process.argv[2 + i]}\n${report([f])}\n`));
  if (fs.length > 1) console.log(`== combined\n${report(fs)}`);
}
