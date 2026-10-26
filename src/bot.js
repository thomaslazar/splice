// Greedy bot over the core API, pure. startState uses it to set each attempt's shot limit;
// tools/sim.mjs uses it to report balance.
import { trace, fire, swap, won, lost, lossRow, clampAim, MIN_ANGLE, key, nbrs, nk, connected } from './core.js';   // circular: used only inside function bodies
import { resolve, isItem } from './items.js';   // circular: used only inside function bodies
import { ICE, ICE_K, ICE_TYPE_K } from './hosts.js';   // circular: used only inside function bodies

// Shot limit = bot's need on this exact colouring * HUMAN_K * the ICE factor (ICE_K, 1 without ICE)
// + HUMAN_C (the bot aims perfectly, sees off-screen bubbles and ignores ICE; people need more). Tune by playtest.
export const HUMAN_K = 1.4, HUMAN_C = 3, MAX_SHOTS = 3000;
export const limitFor = (used, ice = null) => Math.ceil(used * HUMAN_K * (ice ? ICE_TYPE_K[ice] ?? ICE_K[ICE[ice]] : 1) + HUMAN_C);

const ANGLES = {};   // per count, built on first use: MIN_ANGLE is not ready while the circular import loads
const LOW = 20;   // penalty for sticking a bubble next to the loss line

// What a packet of colour col landing in cell would pop and drop, without touching grid.
function outcome(grid, cols, cell, col) {
  const k0 = key(...cell), grp = [k0], seen = new Set(grp);
  for (let i = 0; i < grp.length; i++) for (const k of nk(cols, grp[i])) if (grid.get(k) === col && !seen.has(k)) { seen.add(k); grp.push(k); }
  if (grp.length < 3) return { popped: 0, dropped: 0 };
  seen.delete(k0);   // the packet itself is not on the grid
  return { popped: grp.length, dropped: grid.size - seen.size - connected(grid, cols, seen).size };
}

// Landing next to an item bubble: resolve it on a copy of S with cur = col. Cleared bubbles (colour or
// item, bombs included) count as popped; dropped is what the rest loses its hold on, as in outcome.
function itemOutcome(S, ang, col) {
  const r = resolve({ ...S, cur: col }, { ang }); if (!r) return { popped: 0, dropped: 0 };
  return { popped: r.popped.size + r.clear.size, dropped: r.after.size - connected(r.after, S.cols).size };
}

// One shot: best of angles x (no swap, swap), scored by popped + 2 * dropped.
export function bestShot(S, n = 120) {
  ANGLES[n] ??= Array.from({ length: n }, (_, i) => -Math.PI + MIN_ANGLE + i * (Math.PI - 2 * MIN_ANGLE) / (n - 1));
  const seen = new Set(), loss = lossRow(S); let best = null;
  for (const ang of ANGLES[n]) {
    const { cell } = trace(S.grid, S.cols, clampAim(ang), S.top); if (!cell) continue;
    for (const sw of [false, true]) {
      const col = sw ? S.next : S.cur, id = key(...cell) * 8 + col;
      if (col === null || seen.has(id)) continue; seen.add(id);
      const r = nk(S.cols, key(...cell)).some(x => isItem(S.grid.get(x))) ? itemOutcome(S, clampAim(ang), col) : outcome(S.grid, S.cols, cell, col);
      const side = nbrs(S.cols, ...cell).some(([a, b]) => S.grid.get(key(a, b)) === col) ? 0.1 : 0;
      const low = !r.popped && cell[0] >= loss - 1 ? LOW : 0;   // sticking a bubble next to the loss line
      const sc = r.popped + 2 * r.dropped + side - low;
      if (!best || sc > best.sc) best = { sc, ang, sw, drop: r.dropped };
    }
  }
  return best;
}

// The shots a level needs: the middle of three bot runs with different colour luck, so one lucky
// or unlucky run does not set the limit (a lost run counts at least a third of the bubbles).
export const needFor = S => [0, 1, 2].map(salt => { const r = solve(S, salt); return r.won ? r.used : Math.max(r.used, Math.ceil(S.grid.size / 3)); })
  .sort((a, b) => a - b)[1];

// Plays a copy of S with no shot limit; returns {won, used, drop}. salt gives the copy other colour
// luck (deal() mixes it into its seed); n is the number of angles tried per shot.
export function solve(S0, salt = 0, n = 120) {
  const S = { ...S0, grid: new Map(S0.grid), hist: [...S0.hist], shots: Infinity, salt }; let used = 0, drop = 0;
  while (!won(S) && !lost(S) && used < MAX_SHOTS) {
    const b = bestShot(S, n); if (!b) break;
    if (b.sw) swap(S);
    fire(S, b.ang); used++; drop = Math.max(drop, b.drop);
  }
  return { won: won(S), used, drop };
}
