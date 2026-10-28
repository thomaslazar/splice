// Level generation and colouring: pure, seeded, no DOM. Imports core.js (which later imports back; keep uses inside functions).
import { mulberry32, hash, cellsIn, key, rc, nbrs, connected } from './core.js';
import { iceFor } from './hosts.js';   // circular: used only inside function bodies

export const difficulty = level => Math.min(1, level / 40);
export const isLong = level => level % 5 === 0;
const SPLIT = .7;   // at full hardness, mirrors and bands split 70% of the time (100% made the front confetti)
// Hardness climbs over each run of RUN levels and starts again; runPos is 1..RUN within the run.
export const RUN = 30, runPos = level => (level - 1) % RUN + 1, hardness = level => (runPos(level) - 1) / (RUN - 1);
// The board's share of the hardness: a level with ICE gets a lighter board (three quarters), so
// ICE does not stack on the hardest layouts.
export const boardHardness = level => (iceFor(level) ? .75 : 1) * hardness(level);
export const winRows = cols => Math.round(1.7 * cols);
const xOf = k => (k & 15) + (k >> 4) % 2 / 2;   // a cell key's x in unit coords (odd rows +0.5)

// Shapes are predicates over unit coords: x in 0..cols-1 (odd rows +0.5), y in rows*0.866.
// Each returns a band index (sub-group for colouring) or -1 outside.
function shapeMakers(rnd, cols) {
  const X = cols - 1, ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)), rf = (a, b) => a + rnd() * (b - a);
  const bandFn = (mode, w) => ({
    solid: () => 0,
    rows: (x, y) => Math.floor(y / w),
    cols: (x, y) => Math.floor(x / w),
    diag: (x, y) => Math.floor((x + y) / w),
    adiag: (x, y) => Math.floor((X - x + y) / w),
  })[mode];
  const pickBand = () => bandFn(['solid','rows','rows','cols','diag','adiag'][ri(0, 5)], rf(1, 2.2));
  return [
    // hanging lines: vertical strips side by side, each own colour
    () => { const n = ri(2, 4), gap = rf(1.5, 2.6), w = rf(0.4, 0.9), x0 = X / 2 - gap * (n - 1) / 2,
        top = rf(1, 3), len = rf(4, 8);
      return (x, y) => { if (y < top || y > top + len) return -1;
        for (let i = 0; i < n; i++) if (Math.abs(x - (x0 + i * gap)) <= w) return i; return -1; }; },
    // rhombus with bands
    () => { const c0 = rf(X * 0.3, X * 0.7), c1 = rf(3, 6), rad = rf(2.5, 4.5), b = pickBand();
      return (x, y) => Math.abs(x - c0) + Math.abs(y - c1) * 1.1 <= rad ? b(x, y) : -1; },
    // circle / ring
    () => { const c0 = rf(X * 0.3, X * 0.7), c1 = rf(3, 6), r2 = rf(2.2, 3.8), r1 = rnd() < .5 ? 0 : r2 - rf(1, 1.6);
      return (x, y) => { const d = Math.hypot(x - c0, y - c1); return d <= r2 && d >= r1 ? (d < r2 - 1.1 ? 1 : 0) : -1; }; },
    // downward triangle
    () => { const c0 = rf(X * 0.35, X * 0.65), top = rf(0, 2), h = rf(4, 7), b = pickBand();
      return (x, y) => y >= top && y <= top + h && Math.abs(x - c0) <= (top + h - y) * 0.75 ? b(x, y) : -1; },
    // chevron / V
    () => { const c0 = X / 2, top = rf(1, 3), th = rf(0.9, 1.5), sl = rf(0.6, 1.1);
      return (x, y) => { const v = y - top - Math.abs(x - c0) * sl; return v >= 0 && v <= th * 2 ? (x < c0 ? 0 : 1) : -1; }; },
    // diagonal bar
    () => { const k = rf(0.5, 1.2) * (rnd() < .5 ? 1 : -1), off = rf(1, 4), th = rf(0.8, 1.4);
      return (x, y) => Math.abs(y - off - (x - X / 2) * k) <= th ? 0 : -1; },
    // shelf: horizontal band, often a guard under anchors
    () => { const y0 = rf(2, 6), th = rf(0.8, 1.8), b = pickBand();
      return (x, y) => Math.abs(y - y0) <= th ? b(x, y) : -1; },
  ];
}

// Connect every floating component to the ceiling with thin stems (the anchors).
// Each structure gets 1 + extra stems (extra grows with hardness h), spread along its top edge.
function addStems(cells, cols, rnd, mirror, h) {
  const grow = (r, c) => {
    const grp = 1e6 + cells.size * 1000;
    while (r > 0) {
      const ups = nbrs(cols, r, c).filter(([a]) => a === r - 1);
      [r, c] = ups[Math.floor(rnd() * ups.length)];
      if (cells.has(key(r, c))) break;
      cells.set(key(r, c), grp);
      const m = cellsIn(cols, r) - 1 - c; // mirrored layouts get mirrored stems
      if (mirror && !cells.has(key(r, m))) cells.set(key(r, m), grp + 500);
    }
  };
  for (;;) {
    const seen = connected(cells, cols), loose = new Set([...cells.keys()].filter(k => !seen.has(k)));
    if (!loose.size) return;
    // topmost loose bubble; prefer the middle of its row
    const top = Math.min(...[...loose].map(k => k >> 4)), row = [...loose].filter(k => k >> 4 === top);
    const start = row[Math.floor(row.length / 2)], extra = Math.min(2, Math.floor(h * 2 + rnd()));
    grow(...rc(start));
    if (!extra) continue;
    const comp = new Set([start]), st = [start]; // the structure this stem holds
    while (st.length) for (const [r, c] of nbrs(cols, ...rc(st.pop()))) { const k = key(r, c); if (loose.has(k) && !comp.has(k)) { comp.add(k); st.push(k); } }
    // top edge near the top: nothing above; extra stems go left and right of the main one
    const edge = [...comp].filter(k => k >> 4 <= top + 2 && nbrs(cols, ...rc(k)).every(([a, b]) => a !== (k >> 4) - 1 || !cells.has(key(a, b))))
      .sort((a, b) => xOf(a) - xOf(b));
    const ends = [edge[0], edge[edge.length - 1]].filter(k => Math.abs(xOf(k) - xOf(start)) >= 2);
    if (extra === 1 && ends.length === 2) ends.splice(Math.floor(rnd() * 2), 1);
    for (const k of ends) grow(...rc(k));
  }
}

function generate(level) {
  const rnd = mulberry32(hash(level, 7)), d = difficulty(level), h = boardHardness(level);
  const kind = level < 3 ? 'designed' : rnd() < 0.25 ? 'noise' : 'designed';
  const w = [0.4 - 0.25 * d, 0.45, 0.15 + 0.25 * d];
  if (isLong(level)) { const m = Math.min(0.15, w[0]); w[0] -= m; w[2] += m; }
  const p = rnd(); // weights sum to 1
  const cols = [8, 10, 12][p < w[0] ? 0 : p < w[0] + w[1] ? 1 : 2];
  const nColours = Math.min(6, 3 + Math.floor(d * 3.5)), sec = Math.round(1.6 * cols), cells = new Map();
  if (kind === 'noise') {
    const rows = 2 * sec + Math.round(d * 6); let id = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cellsIn(cols, r); c++) cells.set(key(r, c), id++);
    return { cols, kind, screens: 2, nColours, cells };
  }
  const screens = 4 + Math.round(d * 4) + (isLong(level) ? 2 + Math.floor(rnd() * 3) : 0);
  for (let s = 0; s < screens; s++) {
    const base = s * sec;
    for (let tries = 0; tries < 20; tries++) {
      const part = new Map(), makers = shapeMakers(rnd, cols), n = 2 + Math.floor(rnd() * (2 + d * 2)), mirror = rnd() < 0.65;
      const drop = rnd() < 0.5 ? 2 + Math.floor(rnd() * 3) : 0; // push shapes down so stems are needed
      const shapes = Array.from({ length: n }, () => makers[Math.floor(rnd() * makers.length)]());
      for (let r = base; r < base + sec; r++) for (let c = 0; c < cellsIn(cols, r); c++) {
        let x = c + (r % 2 ? .5 : 0); const y = (r - base - drop) * 0.866;
        if (mirror && x > (cols - 1) / 2) x = cols - 1 - x;
        for (let i = n - 1; i >= 0; i--) { const b = shapes[i](x, y); if (b >= 0) { part.set(key(r, c), s * 1000 + i * 100 + b); break; } }
      }
      if (part.size < 25 + d * 30) continue;
      // Harder levels break shapes into more groups: per shape, the right half of a mirror
      // (axis cells stay left) and band segments cut at shared x positions. Variant v adds v * 1e5.
      // Mirrored sections cut on folded x, so the segments mirror too (outer, inner) instead of a left/right split.
      const half = (cols - 1) / 2, fx = k => mirror && xOf(k) > half ? cols - 1 - xOf(k) : xOf(k), ext = new Map(), size = new Map();
      for (const [k, g] of part) { const i = g % 1000 / 100 | 0, e = ext.get(i) || [Infinity, -Infinity];
        ext.set(i, [Math.min(e[0], fx(k)), Math.max(e[1], fx(k))]); }
      const cut = new Map([...ext].map(([i, [lo, hi]]) => { const asym = mirror && rnd() < SPLIT * h, n = rnd() < SPLIT * h ? 3 : 2;
        return [i, { asym, at: Array.from({ length: n - 1 }, (_, j) => lo + (hi - lo) * (j + 1 + (rnd() - .5) * .5) / n) }]; }));
      for (const [k, g] of part) { const S = cut.get(g % 1000 / 100 | 0);
        const id = g + (S.asym && xOf(k) > half ? 3e5 : 0); part.set(k, id); size.set(id, (size.get(id) || 0) + 1); }
      const split = new Set([...size].filter(([, n]) => n >= 6 && rnd() < SPLIT * h).map(([id]) => id));
      for (const [k, g] of part) cells.set(k, split.has(g) ? g + 1e5 * cut.get(g % 1000 / 100 | 0).at.filter(a => fx(k) > a).length : g);
      addStems(cells, cols, rnd, mirror, h);
      break;
    }
  }
  return { cols, kind, screens, nColours, cells };
}

const cache = new Map();   // the last few levels only (play asks for one level at a time)
export const makeLayout = level => { let L = cache.get(level);
  if (!L) { cache.set(level, L = generate(level)); if (cache.size > 4) cache.delete(cache.keys().next().value); }
  return L; };

// Colour groups so touching groups differ where possible; retry reshuffles.
export function colourize(layout, level, fails) {
  const rnd = mulberry32(hash(level, fails, 99)), { cells, cols, nColours } = layout, col = new Map(), adj = new Map();
  for (const [k, g] of cells) for (const [r, c] of nbrs(cols, ...rc(k))) {
    const o = cells.get(key(r, c)); if (o === undefined || o === g) continue;
    if (!adj.has(g)) adj.set(g, new Set()); adj.get(g).add(o);
  }
  const perm = [0, 1, 2, 3, 4, 5];
  for (let i = 5; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  perm.length = nColours;
  for (const g of new Set(cells.values())) {
    const nb = [...adj.get(g) || []];
    if (layout.kind === 'noise') { // clumpy noise: often copy a coloured neighbour
      const have = nb.filter(o => col.has(o));
      col.set(g, have.length && rnd() < 0.45 - 0.20 * boardHardness(level) ? col.get(have[Math.floor(rnd() * have.length)]) : perm[Math.floor(rnd() * nColours)]);
      continue;
    }
    const taken = new Set(nb.map(o => col.get(o))), free = perm.filter(x => !taken.has(x)), pool = free.length ? free : perm;
    col.set(g, pool[Math.floor(rnd() * pool.length)]);
  }
  return new Map([...cells].map(([k, g]) => [k, col.get(g)]));
}

/* ---------- shot limit ---------- */
// The base limit comes from the bot (bot.js); fails ease it here.
export const groupCount = layout => new Set(layout.cells.values()).size;
export const shotsFor = (base, fails) => Math.round(base * (1 + 0.1 * Math.min(4, Math.max(0, fails - 3))));
