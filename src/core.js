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
import { winRows } from './levels.js';   // circular: used only inside function bodies
export const MIN_ANGLE = 0.12, HIT = 0.82 * 2;
export function viewTop(grid, cols) {
  let low = 0; for (const k of grid.keys()) low = Math.max(low, k >> 4);
  return Math.max(0, low - (winRows(cols) - 5));
}
export const shooterPos = (grid, cols) => ({ x: cols, y: 1 + (viewTop(grid, cols) + winRows(cols) - 1) * RH });
export const clampAim = ang => ang >= 0 ? null : Math.min(-MIN_ANGLE, Math.max(-Math.PI + MIN_ANGLE, ang));
export function trace(grid, cols, ang) {
  let { x, y } = shooterPos(grid, cols), dx = Math.cos(ang), dy = Math.sin(ang);
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
