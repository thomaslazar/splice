// Balance report: the bot (src/bot.js) plays levels and reports shots needed vs the limit, per kind and band.
// Usage: node tools/sim.mjs [levels] [runs]   (levels: 1,3,5 or a range 1-60)
import { pathToFileURL } from 'node:url';
import { startState, fire, swap, won, lost, viewTop } from '../src/core.js';
import { solve, bestShot } from '../src/bot.js';
import { makeLayout, groupCount, hardness } from '../src/levels.js';

// Plays level with fails = run. The limit is the real starting S.shots, itself set from the same bot,
// so left% shows the human margin (HUMAN_K, HUMAN_C in src/bot.js) and the bot always wins.
export function play(level, run) {
  const t0 = performance.now(), S = startState(level, run), limit = S.shots, r = solve(S);
  return { won: r.won, used: r.used, limit, drop: r.drop, ms: (performance.now() - t0) / Math.max(1, r.used) / 2 };
}

// Bot plays level; a big clear is a shot removing more than half of the bubbles on screen while 12+ are shown.
export function bigClears(level) {
  const S = startState(level, 0); let shots = 0, big = 0;
  while (!won(S) && !lost(S) && shots < 400) {
    const vis = [...S.grid.keys()].filter(q => q >> 4 >= S.top).length, b = bestShot(S); if (!b) break;
    if (b.sw) swap(S);
    const before = new Map(S.grid), m = fire(S, b.ang); if (!m) break;
    shots++;
    const gone = [...m.popped, ...m.dropped].filter(q => q >> 4 >= viewTop(before, S.cols) || q >> 4 >= S.top).length;
    if (vis >= 12 && gone >= vis * .5) big++;
  }
  return { won: won(S), shots, big };
}
export const hband = lv => ['0-0.25', '0.25-0.5', '0.5-0.75', '0.75-1'][Math.min(3, Math.floor(hardness(lv) * 4))];

export const band = lv => lv <= 10 ? '1-10' : lv <= 25 ? '11-25' : lv <= 40 ? '26-40' : '41+';
export const parseLevels = s => s.split(',').flatMap(p => { const [a, b = a] = p.split('-').map(Number);
  return Array.from({ length: b - a + 1 }, (_, i) => a + i); });

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pos = process.argv.slice(2);
  if (pos.includes('--clears')) {
    const levels = parseLevels(pos[0] && !pos[0].startsWith('--') ? pos[0] : '1-80'), by = {};
    for (const lv of levels) {
      const r = bigClears(lv), k = by[`${makeLayout(lv).kind} ${hband(lv)}`] ??= { levels: 0, wins: 0, shots: 0, big: 0 };
      k.levels++; k.wins += r.won; k.shots += r.shots; k.big += r.big;
    }
    console.log('group                 levels wins shots big  big/level');
    for (const [name, k] of Object.entries(by).sort())
      console.log(name.padEnd(21), ...[k.levels, k.wins, k.shots, k.big].map(x => String(x).padStart(5)), (k.big / k.levels).toFixed(2).padStart(9));
    process.exit();
  }
  const levels = parseLevels(pos[0] || '1,3,5,10,15,20,25,30,40,50,60'), runs = Number(pos[1] || 1);
  const by = {}, med = a => a.length ? [...a].sort((x, y) => x - y)[a.length >> 1] : NaN;
  const add = (name, won, left) => { const k = by[name] ??= { n: 0, w: 0, left: [] }; k.n++; if (won) { k.w++; k.left.push(left); } };
  console.log('level run kind cols scr bubbles groups limit won used left% maxdrop ms/shot');
  for (const lv of levels) for (let run = 0; run < runs; run++) {
    const L = makeLayout(lv), r = play(lv, run), left = 100 * (r.limit - r.used) / r.limit, w = r.won && r.used <= r.limit;
    add(L.kind, w, left); add(`${L.kind} ${band(lv)}`, w, left);
    console.log([lv, run, L.kind, L.cols, L.screens, L.cells.size, groupCount(L), r.limit, r.won ? 'yes' : 'no', r.used,
      left.toFixed(1), r.drop, r.ms.toFixed(1)].join('\t'));
  }
  for (const [name, k] of Object.entries(by).sort())
    console.log(`${name}: win rate ${(100 * k.w / k.n).toFixed(0)}% (${k.w}/${k.n}), median shots left ${med(k.left).toFixed(1)}%`);
}
