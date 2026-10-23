// Greedy bot over the core API, pure. startState uses it to set each attempt's shot limit;
// tools/sim.mjs uses it to report balance.
import { trace, fire, swap, won, lost, lossRow, clampAim, MIN_ANGLE, key, rc, nbrs, connected } from './core.js';   // circular: used only inside function bodies
import { ICE, ICE_K } from './hosts.js';   // circular: used only inside function bodies

// Shot limit = bot's need on this exact colouring * HUMAN_K + HUMAN_C (the bot aims perfectly and
// sees off-screen bubbles; people need more). Tune by playtest.
export const HUMAN_K = 1.4, HUMAN_C = 3, MAX_SHOTS = 3000;
export const limitFor = (used, ice = null) => Math.ceil(used * HUMAN_K * (ice ? ICE_K[ICE[ice]] : 1) + HUMAN_C);

let ANGLES;   // built on first use: MIN_ANGLE is not ready while the circular import loads
const LOW = 20;   // penalty for sticking a bubble next to the loss line

// What a packet of colour col landing in cell would pop and drop, without touching grid.
function outcome(grid, cols, cell, col) {
  const g = new Map(grid), k0 = key(...cell), grp = [k0], seen = new Set(grp); g.set(k0, col);
  for (let i = 0; i < grp.length; i++) for (const [x, y] of nbrs(cols, ...rc(grp[i]))) {
    const k = key(x, y); if (g.get(k) === col && !seen.has(k)) { seen.add(k); grp.push(k); } }
  if (grp.length < 3) return { popped: 0, dropped: 0 };
  for (const k of grp) g.delete(k);
  return { popped: grp.length, dropped: g.size - connected(g, cols).size };
}

// One shot: best of angles x (no swap, swap), scored by popped + 2 * dropped.
export function bestShot(S) {
  ANGLES ??= Array.from({ length: 120 }, (_, i) => -Math.PI + MIN_ANGLE + i * (Math.PI - 2 * MIN_ANGLE) / 119);
  const seen = new Set(), loss = lossRow(S); let best = null;
  for (const ang of ANGLES) {
    const { cell } = trace(S.grid, S.cols, clampAim(ang), S.top); if (!cell) continue;
    for (const sw of [false, true]) {
      const col = sw ? S.next : S.cur, id = key(...cell) * 8 + col;
      if (col === null || seen.has(id)) continue; seen.add(id);
      const r = outcome(S.grid, S.cols, cell, col);
      const side = nbrs(S.cols, ...cell).some(([a, b]) => S.grid.get(key(a, b)) === col) ? 0.1 : 0;
      const low = !r.popped && cell[0] >= loss - 1 ? LOW : 0;   // sticking a bubble next to the loss line
      const sc = r.popped + 2 * r.dropped + side - low;
      if (!best || sc > best.sc) best = { sc, ang, sw, drop: r.dropped };
    }
  }
  return best;
}

// Plays a copy of S with no shot limit; returns {won, used, drop}.
export function solve(S0) {
  const S = { ...S0, grid: new Map(S0.grid), hist: [...S0.hist], shots: Infinity }; let used = 0, drop = 0;
  while (!won(S) && !lost(S) && used < MAX_SHOTS) {
    const b = bestShot(S); if (!b) break;
    if (b.sw) swap(S);
    fire(S, b.ang); used++; drop = Math.max(drop, b.drop);
  }
  return { won: won(S), used, drop };
}
