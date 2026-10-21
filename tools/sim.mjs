// Balance bot: plays levels greedily and reports win rate / shots left per kind.
// Usage: node tools/sim.mjs [levels] [runs] [--unlimited]
import { startState, trace, fire, swap, won, lost, clampAim, MIN_ANGLE, key, rc, nbrs } from '../src/core.js';
import { makeLayout, shotLimit, groupCount } from '../src/levels.js';

const args = process.argv.slice(2), unlimited = args.includes('--unlimited'), pos = args.filter(a => !a.startsWith('--'));
const levels = (pos[0] || '1,3,5,10,15,20,25,30,40,50,60').split(',').map(Number), runs = Number(pos[1] || 1);
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

function play(level, run) {
  const S = startState(level, run), limit = S.shots; let used = 0, drop = 0, ms = 0;
  if (unlimited) S.shots = Infinity;
  while (!won(S) && !lost(S) && used < 3000) {
    const t0 = performance.now(), b = bestShot(S); ms += performance.now() - t0;
    if (!b) break;
    if (b.sw) swap(S);
    fire(S, b.ang); used++; drop = Math.max(drop, b.drop);
  }
  return { won: won(S), used, drop, ms: ms / Math.max(1, used) };
}

const by = {}, pct = a => a.length ? [...a].sort((x, y) => x - y)[a.length >> 1] : NaN;
console.log('level run kind cols scr bubbles groups limit won used left% maxdrop ms/shot');
for (const lv of levels) for (let run = 0; run < runs; run++) {
  const L = makeLayout(lv), limit = shotLimit(L), r = play(lv, run), left = 100 * (limit - r.used) / limit;
  (by[L.kind] ??= { n: 0, w: 0, left: [], need: [] }); const k = by[L.kind];
  k.n++; k.need.push(r.used); if (r.won && (unlimited || r.used <= limit)) { k.w++; k.left.push(left); }
  console.log([lv, run, L.kind, L.cols, L.screens, L.cells.size, groupCount(L), limit, r.won ? 'yes' : 'no', r.used,
    left.toFixed(1), r.drop, r.ms.toFixed(1)].join('\t'));
}
for (const [kind, k] of Object.entries(by))
  console.log(`${kind}: win rate ${(100 * k.w / k.n).toFixed(0)}% (${k.w}/${k.n}), median shots left ${pct(k.left).toFixed(1)}%`);
