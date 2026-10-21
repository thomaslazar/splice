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
export function connected(grid, cols) {
  const seen = new Set(), st = [...grid.keys()].filter(k => k >> 4 === 0);
  while (st.length) {
    const k = st.pop(); if (seen.has(k)) continue; seen.add(k);
    const [r, c] = rc(k);
    for (const [a, b] of nbrs(cols, r, c)) if (grid.has(key(a, b))) st.push(key(a, b));
  }
  return seen;
}

/* ---------- shots ---------- */
import { winRows, makeLayout, colourize, shotLimit, shotsFor } from './levels.js';   // circular: used only inside function bodies
export const MIN_ANGLE = 0.12, HIT = 0.82 * 2;
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
    for (let r = Math.max(0, lr - 1); !stop && r <= lr + 1; r++) for (let c = 0; c < cellsIn(cols, r); c++) {
      if (grid.has(key(r, c))) { const p = centre(r, c); if ((p.x - x) ** 2 + (p.y - y) ** 2 < hit) { stop = true; break; } } }
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
export const OFFSCREEN_W = 0.3;
export function startState(level, fails) {
  const L = makeLayout(level), S = { level, fails, cols: L.cols, kind: L.kind, grid: colourize(L, level, fails),
    shots: shotsFor(shotLimit(L), fails), score: 0, cur: null, next: null, hist: [], draws: 0 };
  S.top = viewTop(S.grid, S.cols); S.cur = deal(S); S.next = deal(S); return S;
}
export function deal(S) {
  const rnd = mulberry32(hash(S.level, S.fails, 5, S.draws++)), top = S.top, vis = new Set(), all = new Set();
  for (const [k, c] of S.grid) { all.add(c); if (k >> 4 >= top) vis.add(c); }
  if (!all.size) return null;
  const h = S.hist, last = h[h.length - 1], l = [...all].sort((a, b) => a - b);
  const pool = h.length >= 2 && h[0] === last && l.some(c => c !== last) ? l.filter(c => c !== last) : l;
  const draw = () => { const w = pool.map(c => vis.has(c) ? 1 : OFFSCREEN_W); let x = rnd() * w.reduce((a, b) => a + b);
    for (let i = 0; i < pool.length; i++) if ((x -= w[i]) < 0) return pool[i]; return pool[pool.length - 1]; };
  let c = draw(); if (c === last && pool.length > 1) c = draw();
  h.push(c); if (h.length > 2) h.shift(); return c;
}

/* ---------- moves ---------- */
export const swap = S => { [S.cur, S.next] = [S.next, S.cur]; };
export const won = S => !S.grid.size;
export const lossRow = S => S.top + winRows(S.cols) - 2;   // the row directly above the shooter row
export const lost = S => !won(S) && (S.shots <= 0 || [...S.grid.keys()].some(k => k >> 4 >= lossRow(S)));
export function fire(S, ang) {
  const a = clampAim(ang); if (a === null || S.shots <= 0 || won(S)) return null;
  const { pts, cell } = trace(S.grid, S.cols, a, S.top); if (!cell) return null;
  const [r, c] = cell, k0 = key(r, c), col = S.cur, grp = [k0], seen = new Set(grp);
  S.grid.set(k0, col);
  for (let i = 0; i < grp.length; i++) for (const [x, y] of nbrs(S.cols, ...rc(grp[i]))) {
    const k = key(x, y); if (S.grid.get(k) === col && !seen.has(k)) { seen.add(k); grp.push(k); } }
  const popped = grp.length >= 3 ? grp : [], dropped = [];
  for (const k of popped) S.grid.delete(k);
  if (popped.length) { const keep = connected(S.grid, S.cols); for (const k of [...S.grid.keys()]) if (!keep.has(k)) { S.grid.delete(k); dropped.push(k); } }
  const points = 10 * popped.length + 10 * dropped.length ** 2;
  S.top = Math.min(S.top, viewTop(S.grid, S.cols));   // never retracts, only moves toward the ceiling
  S.score += points; S.shots--; S.cur = S.next; S.next = deal(S);
  if (S.grid.size) { const has = new Set(S.grid.values());
    if (!has.has(S.cur)) S.cur = deal(S); if (!has.has(S.next)) S.next = deal(S); }
  return { pts, cell, popped, dropped, points };
}

/* ---------- saves ---------- */
export const toSave = S => ({ v: 1, level: S.level, fails: S.fails, cols: S.cols, kind: S.kind, grid: [...S.grid],
  shots: S.shots, score: S.score, cur: S.cur, next: S.next, hist: [...S.hist], draws: S.draws, top: S.top });
export const fromSave = o => ({ ...o, grid: new Map(o.grid), hist: [...o.hist] });
export function validSave(o) {
  const col = c => Number.isInteger(c) && c >= 0 && c <= 5, nul = c => c === null || col(c);
  return !!o && o.v === 1 && Number.isInteger(o.level) && o.level >= 1 && Number.isInteger(o.fails) && o.fails >= 0 &&
    [8, 10, 12].includes(o.cols) && Array.isArray(o.grid) &&
    o.grid.every(e => Array.isArray(e) && Number.isInteger(e[0]) && e[0] >= 0 && (e[0] & 15) < cellsIn(o.cols, e[0] >> 4) && col(e[1])) &&
    nul(o.cur) && nul(o.next) && ['designed', 'noise'].includes(o.kind) &&
    Array.isArray(o.hist) && o.hist.length <= 2 && o.hist.every(col) && [o.shots, o.score, o.draws, o.top].every(n => Number.isInteger(n) && n >= 0);
}
