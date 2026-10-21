// Pure game logic: no DOM, no storage. Imported by src/ui.js and tools/sim.mjs.

/* ---------- random ---------- */
export const mulberry32 = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
export const hash = (...n) => n.reduce((h, x) => Math.imul(h ^ x, 2654435761) >>> 0, 2166136261);

/* ---------- geometry ---------- */
export const RH = Math.sqrt(3);   // row height in bubble radii
export const cellsIn = (cols, r) => r % 2 ? cols - 1 : cols;
export const key = (r, c) => r * 64 + c;
export const rc = k => [k >> 6, k & 63];
export const centre = (r, c) => ({ x: 1 + c * 2 + (r % 2), y: 1 + r * RH });
export function nbrs(cols, r, c) {
  const o = r % 2 ? [[0,-1],[0,1],[-1,0],[-1,1],[1,0],[1,1]] : [[0,-1],[0,1],[-1,-1],[-1,0],[1,-1],[1,0]];
  return o.map(([dr, dc]) => [r + dr, c + dc]).filter(([a, b]) => a >= 0 && b >= 0 && b < cellsIn(cols, a));
}
export function connected(grid, cols) {
  const seen = new Set(), st = [...grid.keys()].filter(k => k >> 6 === 0);
  while (st.length) {
    const k = st.pop(); if (seen.has(k)) continue; seen.add(k);
    const [r, c] = rc(k);
    for (const [a, b] of nbrs(cols, r, c)) if (grid.has(key(a, b))) st.push(key(a, b));
  }
  return seen;
}
