// Pure game logic: no DOM, no storage. Imported by src/ui.js and tools/sim.mjs.

/* ---------- random ---------- */
export const mulberry32 = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
export const hash = (...n) => n.reduce((h, x) => Math.imul(h ^ x, 2654435761) >>> 0, 2166136261);

/* ---------- geometry ---------- */
export const RH = Math.sqrt(3);   // row height in bubble radii
export const cellsIn = (cols, r) => r % 2 ? cols - 1 : cols;
export const key = (r, c) => r * 16 + c;
export const rc = k => [k >> 4, k & 15];
export const centre = (r, c) => ({ x: 1 + c * 2 + (r % 2), y: 1 + r * RH });
export function nbrs(cols, r, c) {
  const o = r % 2 ? [[0,-1],[0,1],[-1,0],[-1,1],[1,0],[1,1]] : [[0,-1],[0,1],[-1,-1],[-1,0],[1,-1],[1,0]];
  return o.map(([dr, dc]) => [r + dr, c + dc]).filter(([a, b]) => a >= 0 && b >= 0 && b < cellsIn(cols, a));
}
// Neighbour keys of key k, memoised per column count (the bot asks millions of times).
const NK = {};
export const nk = (cols, k) => { const m = NK[cols] ??= new Map(); let v = m.get(k);
  if (!v) m.set(k, v = nbrs(cols, k >> 4, k & 15).map(([a, b]) => key(a, b))); return v; };
// Keys reachable from row 0 through occupied cells; gone (optional) are keys to treat as empty.
export function connected(grid, cols, gone) {
  const seen = new Set(), st = [...grid.keys()].filter(k => k >> 4 === 0 && !gone?.has(k));
  while (st.length) {
    const k = st.pop(); if (seen.has(k)) continue; seen.add(k);
    for (const n of nk(cols, k)) if (grid.has(n) && !gone?.has(n) && !seen.has(n)) st.push(n);
  }
  return seen;
}

/* ---------- shots ---------- */
import { winRows, makeLayout, colourize, shotsFor } from './levels.js';   // circular: used only inside function bodies
import { needFor, limitFor } from './bot.js';   // circular too
import { iceFor } from './hosts.js';   // circular too
import { ITEMS, hits } from './items.js';   // circular too
export const MIN_ANGLE = 0.12, HIT = 0.82 * 2, SCROLL_AT = 2, SCROLL_FEW = 10;
export function viewTop(grid, cols) {
  let low = 0; for (const k of grid.keys()) low = Math.max(low, k >> 4);
  return Math.max(0, low - (winRows(cols) - 5));
}
export const shooterPos = (grid, cols, top = viewTop(grid, cols)) => ({ x: cols, y: 1 + (top + winRows(cols) - 1) * RH });
export const clampAim = ang => ang >= 0 ? null : Math.min(-MIN_ANGLE, Math.max(-Math.PI + MIN_ANGLE, ang));
export function trace(grid, cols, ang, top = viewTop(grid, cols)) {
  let { x, y } = shooterPos(grid, cols, top), dx = Math.cos(ang), dy = Math.sin(ang);
  const pts = [{ x, y }], hit = HIT * HIT, lo = 1, hi = 2 * cols - 1;
  for (let i = 0; i < 8000; i++) {
    x += dx * .25; y += dy * .25;
    if (x < lo) { x = 2 * lo - x; dx = -dx; pts.push({ x, y }); }
    if (x > hi) { x = 2 * hi - x; dx = -dx; pts.push({ x, y }); }
    let stop = y <= 1;
    const lr = Math.round((y - 1) / RH);
    // only the cells whose centre can be within HIT in x (centre x = 1 + 2c + r % 2)
    for (let r = Math.max(0, lr - 1); !stop && r <= lr + 1; r++) {
      const o = 1 + r % 2, cy = 1 + r * RH, c1 = Math.min(cellsIn(cols, r) - 1, Math.ceil((x - o + HIT) / 2));
      for (let c = Math.max(0, Math.floor((x - o - HIT) / 2)); c <= c1; c++)
        if (grid.has(key(r, c)) && (o + 2 * c - x) ** 2 + (cy - y) ** 2 < hit) { stop = true; break; } }
    if (stop) { pts.push({ x, y }); return { pts, cell: snap(grid, cols, x, y) }; }
  }
  return { pts, cell: null };
}
export function snap(grid, cols, x, y) {
  let best = null, bd = Infinity;
  const near = (r, c) => { const p = centre(r, c); return (p.x - x) ** 2 + (p.y - y) ** 2; };
  const r0 = Math.round((y - 1) / RH) - 1;
  for (let r = Math.max(0, r0); r <= r0 + 2; r++) for (let c = 0; c < cellsIn(cols, r); c++) {
    if (grid.has(key(r, c)) || r > 0 && !nbrs(cols, r, c).some(([a, b]) => grid.has(key(a, b)))) continue;
    const d = near(r, c); if (d < bd) { bd = d; best = [r, c]; } }
  if (best) return best;
  let occ = null; for (const k of grid.keys()) { const [r, c] = rc(k), d = near(r, c); if (d < bd) { bd = d; occ = [r, c]; } }
  if (!occ) return null;
  bd = Infinity;
  for (const [a, b] of nbrs(cols, ...occ)) if (!grid.has(key(a, b)) && near(a, b) < bd) { bd = near(a, b); best = [a, b]; }
  return best;
}

/* ---------- deal ---------- */
export const OFFSCREEN_W = 0.3, BLOCKED_W = 0.9, VIS_W = 3, PAIR_MIX = .5;   // PAIR_MIX: half of the reachable weight goes to colours that can complete a match
// The shot limit comes from the bot playing this exact attempt (see bot.js); cached, since restart replays it.
const need = new Map();
const lowRow = grid => { let low = 0; for (const k of grid.keys()) low = Math.max(low, k >> 4); return low; };
export function startState(level, fails) {
  const L = makeLayout(level), S = { level, fails, cols: L.cols, kind: L.kind, grid: colourize(L, level, fails),
    shots: Infinity, score: 0, cur: null, next: null, hist: [], draws: 0, frags: 0, load: null, breaker: 0 };
  S.top = viewTop(S.grid, S.cols); S.cur = deal(S); S.next = deal(S);
  const id = `${level}/${fails}`;
  if (!need.has(id)) { need.set(id, needFor(S));
    if (need.size > 8) need.delete(need.keys().next().value); }
  S.shots = shotsFor(limitFor(need.get(id), iceFor(level)), fails);
  S.maxShots = S.shots; S.startLow = lowRow(S.grid); return S;
}
// Bubbles the shooter can reach: on screen and touching the open space that connects to the
// row above the loss line (flood fill through empty cells).
function reachable(S) {   // colour -> count, plus out.pairs: colour -> reachable bubbles with a same-colour neighbour
  const out = new Map(), seen = new Set(), st = [], loss = lossRow(S); out.pairs = new Map();
  for (let c = 0; c < cellsIn(S.cols, loss - 1); c++) { const k = key(loss - 1, c); if (!S.grid.has(k)) { seen.add(k); st.push([loss - 1, c]); } }
  while (st.length) { const [r, c] = st.pop();
    for (const [a, b] of nbrs(S.cols, r, c)) { const k = key(a, b); if (seen.has(k) || a >= loss) continue; seen.add(k);
      if (!S.grid.has(k)) st.push([a, b]); else if (a >= S.top) { const col = S.grid.get(k); out.set(col, (out.get(col) || 0) + 1);
        if (nbrs(S.cols, a, b).some(([x, y]) => S.grid.get(key(x, y)) === col)) out.pairs.set(col, (out.pairs.get(col) || 0) + 1); } } }
  return out;
}
export function deal(S) {
  // Reachable colours weigh by their share of the reachable bubbles, half of it by their share of
  // reachable bubbles that already have a same-colour neighbour (visible ones if none are reachable); colours on screen but blocked weigh BLOCKED_W, off-screen-only ones OFFSCREEN_W. No colour three times in a row and
  // one reroll on a repeat, except for the only reachable colour.
  const rnd = mulberry32(S.salt ? hash(S.level, S.fails, 5, S.draws++, S.salt) : hash(S.level, S.fails, 5, S.draws++)), all = new Set(S.grid.values());
  if (!all.size) return null;
  let near = reachable(S);
  if (!near.size) for (const [k, c] of S.grid) if (k >> 4 >= S.top) near.set(c, (near.get(c) || 0) + 1);
  let n = 0; for (const v of near.values()) n += v;
  const pairs = near.pairs || new Map(); let np = 0; for (const v of pairs.values()) np += v;
  const vis = new Set(); for (const [k, c] of S.grid) if (k >> 4 >= S.top) vis.add(c);
  const h = S.hist, last = h[h.length - 1], l = [...all].sort((a, b) => a - b), only = near.size === 1 ? [...near.keys()][0] : null;
  const pool = h.length >= 2 && h[0] === last && last !== only && l.some(c => c !== last) ? l.filter(c => c !== last) : l;
  const draw = () => { const w = pool.map(c => near.has(c) ? 1 + VIS_W * (np ? (1 - PAIR_MIX) * near.get(c) / n + PAIR_MIX * (pairs.get(c) || 0) / np : near.get(c) / n) : vis.has(c) ? BLOCKED_W : OFFSCREEN_W); let x = rnd() * w.reduce((a, b) => a + b);
    for (let i = 0; i < pool.length; i++) if ((x -= w[i]) < 0) return pool[i]; return pool[pool.length - 1]; };
  let c = draw(); if (c === last && c !== only && pool.length > 1) c = draw();
  h.push(c); if (h.length > 2) h.shift(); return c;
}

/* ---------- moves ---------- */
export const swap = S => { [S.cur, S.next] = [S.next, S.cur]; };
export const isColour = v => v >= 0 && v <= 5;   // packet colours; other grid values are not colours
export const won = S => !S.grid.size;
export const lossRow = S => S.top + winRows(S.cols) - 2;   // the row directly above the shooter row
export const lost = S => !won(S) && (S.shots <= 0 || [...S.grid.keys()].some(k => k >> 4 >= lossRow(S)));
// Removes popped, drops what lost the ceiling, scores, scrolls, re-deals missing colours. advance: a normal shot also
// moves next to cur and costs a shot. extra is for item bubbles (unused so far).
export function settle(S, popped, extra = [], advance = false) {
  for (const k of popped) S.grid.delete(k);
  const dropped = [];
  if (popped.length) { const keep = connected(S.grid, S.cols); for (const k of [...S.grid.keys()]) if (!keep.has(k)) { S.grid.delete(k); dropped.push(k); } }
  const points = 10 * popped.length + 10 * dropped.length ** 2;
  // Never retracts; moves toward the ceiling only once just the top SCROLL_AT visible rows hold
  // bubbles, or at most SCROLL_FEW bubbles are left on screen.
  let low = -1, nv = 0; for (const k of S.grid.keys()) { low = Math.max(low, k >> 4); if (k >> 4 >= S.top) nv++; }
  if (low < S.top + SCROLL_AT || nv <= SCROLL_FEW) S.top = Math.min(S.top, viewTop(S.grid, S.cols));
  S.frags += dropped.length; S.score += points;
  if (advance) { S.shots--; S.cur = S.next; S.next = deal(S); }
  if (S.grid.size) { const has = new Set(S.grid.values());
    if (!has.has(S.cur)) S.cur = deal(S); if (!has.has(S.next)) S.next = deal(S); }
  return { popped, dropped, points };
}
export function fire(S, ang) {
  if (S.load) return fireItem(S, ang);
  const a = clampAim(ang); if (a === null || S.shots <= 0 || won(S)) return null;
  const { pts, cell } = trace(S.grid, S.cols, a, S.top); if (!cell) return null;
  const [r, c] = cell, k0 = key(r, c), col = S.cur, grp = [k0], seen = new Set(grp);
  S.grid.set(k0, col);
  for (let i = 0; i < grp.length; i++) for (const [x, y] of nbrs(S.cols, ...rc(grp[i]))) {
    const k = key(x, y); if (S.grid.get(k) === col && !seen.has(k)) { seen.add(k); grp.push(k); } }
  return { pts, cell, ...settle(S, grp.length >= 3 ? grp : [], [], true) };
}
// A loaded item flies instead of the packet: no shot spent, the packets stay.
function fireItem(S, ang) {
  const a = clampAim(ang); if (a === null || won(S)) return null;
  const h = hits(S, S.load, a); if (!h) return null;
  for (const [k, v] of h.recolour) S.grid.set(k, v);
  const pops = [...h.clear];
  if (h.cell && h.land !== null) { const k0 = key(...h.cell); S.grid.set(k0, h.land);
    if (S.load === 'wildcard') { const g = flood(S, [k0], h.land); if (g.length >= 3) pops.push(...g); } }
  S.load = null;
  return { pts: h.pts, cell: h.cell, ...settle(S, pops), recolour: h.recolour };
}
// Same-colour group (in S.grid) containing the start keys.
export function flood(S, start, col) {
  const g = [...new Set(start)], seen = new Set(g);
  for (let i = 0; i < g.length; i++) for (const n of nk(S.cols, g[i])) if (S.grid.get(n) === col && !seen.has(n)) { seen.add(n); g.push(n); }
  return g;
}

/* ---------- saves ---------- */
export const toSave = S => ({ v: 1, level: S.level, fails: S.fails, cols: S.cols, kind: S.kind, grid: [...S.grid],
  shots: S.shots, score: S.score, cur: S.cur, next: S.next, hist: [...S.hist], draws: S.draws, top: S.top,
  maxShots: S.maxShots, startLow: S.startLow, frags: S.frags, load: S.load, breaker: S.breaker });
export const fromSave = o => ({ maxShots: Math.max(o.shots, 1), startLow: lowRow(new Map(o.grid)), frags: 0, load: null, breaker: 0, ...o, grid: new Map(o.grid), hist: [...o.hist] });
export function validSave(o) {
  const col = c => Number.isInteger(c) && c >= 0 && c <= 5, nul = c => c === null || col(c);
  return !!o && o.v === 1 && Number.isInteger(o.level) && o.level >= 1 && Number.isInteger(o.fails) && o.fails >= 0 &&
    [8, 10, 12].includes(o.cols) && Array.isArray(o.grid) &&
    o.grid.every(e => Array.isArray(e) && Number.isInteger(e[0]) && e[0] >= 0 && (e[0] & 15) < cellsIn(o.cols, e[0] >> 4) && col(e[1])) &&
    nul(o.cur) && nul(o.next) && ['designed', 'noise'].includes(o.kind) &&
    Array.isArray(o.hist) && o.hist.length <= 2 && o.hist.every(col) && [o.shots, o.score, o.draws, o.top].every(n => Number.isInteger(n) && n >= 0) &&
    (o.maxShots === undefined || Number.isInteger(o.maxShots) && o.maxShots >= 1) && (o.startLow === undefined || Number.isInteger(o.startLow) && o.startLow >= 0) &&
    [o.frags, o.breaker].every(n => n === undefined || Number.isInteger(n) && n >= 0) &&
    (o.load === undefined || o.load === null || ITEMS.some(i => i.id === o.load && i.kind === 'shot'));
}
