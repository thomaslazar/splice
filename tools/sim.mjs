// Balance bot: plays levels greedily and reports win rate / shots left per kind and per difficulty band.
// Usage: node tools/sim.mjs [levels] [runs] [--unlimited]   (levels: 1,3,5 or a range 1-60)
import { pathToFileURL } from 'node:url';
import { startState, trace, fire, swap, won, lost, clampAim, MIN_ANGLE, key, nbrs } from '../src/core.js';
import { makeLayout, groupCount } from '../src/levels.js';

const ANGLES = Array.from({ length: 120 }, (_, i) => -Math.PI + MIN_ANGLE + i * (Math.PI - 2 * MIN_ANGLE) / 119);

// One shot: best of angles x (no swap, swap). Traces on the live state; clones only once per distinct (cell, colour).
function bestShot(S) {
  const seen = new Map(); let best = null;
  for (const ang of ANGLES) {
    const { cell } = trace(S.grid, S.cols, clampAim(ang)); if (!cell) continue;
    for (const sw of [false, true]) {
      const col = sw ? S.next : S.cur, id = key(...cell) * 8 + col;
      if (seen.has(id)) continue; seen.set(id, 1);
      const T = structuredClone(S); if (sw) swap(T);
      const r = fire(T, ang); if (!r) continue;
      const side = nbrs(S.cols, ...cell).some(([a, b]) => S.grid.get(key(a, b)) === col) ? 0.1 : 0;
      const sc = r.popped.length + 2 * r.dropped.length + side;
      if (!best || sc > best.sc) best = { sc, ang, sw, drop: r.dropped.length };
    }
  }
  return best;
}

// Plays level with fails = run; limit is the real starting S.shots (with easing).
export function play(level, run, unlimited = false) {
  const S = startState(level, run), limit = S.shots; let used = 0, drop = 0, ms = 0;
  if (unlimited) S.shots = Infinity;
  while (!won(S) && !lost(S) && used < 3000) {
    const t0 = performance.now(), b = bestShot(S); ms += performance.now() - t0;
    if (!b) break;
    if (b.sw) swap(S);
    fire(S, b.ang); used++; drop = Math.max(drop, b.drop);
  }
  return { won: won(S), used, limit, drop, ms: ms / Math.max(1, used) };
}

export const band = lv => lv <= 10 ? '1-10' : lv <= 25 ? '11-25' : lv <= 40 ? '26-40' : '41+';
export const parseLevels = s => s.split(',').flatMap(p => { const [a, b = a] = p.split('-').map(Number);
  return Array.from({ length: b - a + 1 }, (_, i) => a + i); });

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), unlimited = args.includes('--unlimited'), pos = args.filter(a => !a.startsWith('--'));
  const levels = parseLevels(pos[0] || '1,3,5,10,15,20,25,30,40,50,60'), runs = Number(pos[1] || 1);
  const by = {}, med = a => a.length ? [...a].sort((x, y) => x - y)[a.length >> 1] : NaN;
  const add = (name, won, left) => { const k = by[name] ??= { n: 0, w: 0, left: [] }; k.n++; if (won) { k.w++; k.left.push(left); } };
  console.log('level run kind cols scr bubbles groups limit won used left% maxdrop ms/shot');
  for (const lv of levels) for (let run = 0; run < runs; run++) {
    const L = makeLayout(lv), r = play(lv, run, unlimited), left = 100 * (r.limit - r.used) / r.limit, w = r.won && (unlimited || r.used <= r.limit);
    add(L.kind, w, left); add(`${L.kind} ${band(lv)}`, w, left);
    console.log([lv, run, L.kind, L.cols, L.screens, L.cells.size, groupCount(L), r.limit, r.won ? 'yes' : 'no', r.used,
      left.toFixed(1), r.drop, r.ms.toFixed(1)].join('\t'));
  }
  for (const [name, k] of Object.entries(by).sort())
    console.log(`${name}: win rate ${(100 * k.w / k.n).toFixed(0)}% (${k.w}/${k.n}), median shots left ${med(k.left).toFixed(1)}%`);
}
