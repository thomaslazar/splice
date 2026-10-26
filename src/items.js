// Items: the shop table, level loot and the deck (frags and held items). Pure: no DOM, no storage.
import { mulberry32, hash, key, isColour, rc, nk, trace, snap, connected, flood, lossRow, clampAim, cellsIn, HIT, RH, won } from './core.js';
import { tierFor, iceFor, ICE } from './hosts.js';
import { isLong, winRows } from './levels.js';   // circular: used only inside function bodies

/* ---------- table ---------- */
export const ITEMS = [['bomb', 'shot', 1], ['sweep', 'shot', 1], ['pierce', 'shot', 1], ['wildcard', 'shot', 1],
  ['overclock', 'instant', 1], ['decrypt', 'instant', 1], ['icebreaker', 'instant', 1], ['star', 'shot', 31],
  ['lightning', 'shot', 31], ['virus', 'shot', 61], ['purge', 'shot', 61], ['rainbow', 'shot', 61],
  ['rollback', 'instant', 91]].map(([id, kind, from]) => ({ id, kind, from }));
export const item = id => ITEMS.find(i => i.id === id);
// ponytail: placeholder prices, tune by playing
export const PRICES = { bomb: 400, sweep: 350, pierce: 450, wildcard: 300, overclock: 500, decrypt: 300, icebreaker: 450,
  star: 500, lightning: 500, virus: 600, purge: 700, rainbow: 700, rollback: 600 };
export const UNLOCKS = [31, 61, 91];
export const unlocked = level => ITEMS.filter(i => i.from <= level).map(i => i.id);

/* ---------- loot ---------- */
// High stakes (long levels too) and harsh ice always drop one; lighter ice 35%, otherwise 5%.
export const lootFor = level => {
  const rnd = mulberry32(hash(level, 21)), chance = rnd(), pick = rnd(), ice = iceFor(level);
  const sure = tierFor(level) === 'high' || isLong(level) || ICE[ice] === 'harsh';
  if (!sure && chance >= (ice ? .35 : .05)) return null;
  const ids = unlocked(level); return ids[Math.floor(pick * ids.length)];
};

/* ---------- deck ---------- */
const cnt = n => Number.isInteger(n) && n > 0;
export const deckFrom = o => {
  const items = {}, src = o && typeof o === 'object' && o.items && typeof o.items === 'object' ? o.items : {};
  for (const i of ITEMS) if (cnt(src[i.id])) items[i.id] = src[i.id];
  return { frags: o && Number.isInteger(o.frags) && o.frags > 0 ? o.frags : 0, items };
};
export const give = (d, id, n = 1) => ({ frags: d.frags, items: { ...d.items, [id]: (d.items[id] || 0) + n } });
export const take = (d, id) => {
  if (!(d.items[id] > 0)) return null;
  const items = { ...d.items }; if (--items[id] === 0) delete items[id];
  return { frags: d.frags, items };
};
export const buy = (d, id) => item(id) && d.frags >= PRICES[id] ? give({ frags: d.frags - PRICES[id], items: d.items }, id) : null;
export const owned = d => ITEMS.filter(i => d.items[i.id] > 0).map(i => [i.id, d.items[i.id]]);

// A first win on the best level (not already paid) pays the pending frags and the level's loot; replays and unwon boards pay nothing.
export const payout = (d, S, best, paid = 0) => {
  if (S.level !== best || paid === S.level || !won(S)) return { deck: d, frags: 0, loot: null };
  const loot = lootFor(S.level), n = { frags: d.frags + S.frags, items: d.items };
  return { deck: loot ? give(n, loot) : n, frags: S.frags, loot };
};

/* ---------- hex helpers (odd-r offset: odd rows sit half a cell right, as nbrs) ---------- */
const cube = k => { const r = k >> 4, x = (k & 15) - (r - (r & 1)) / 2; return [x, -x - r, r]; };
export const dist = (cols, a, b) => { const p = cube(a), q = cube(b); return Math.max(...p.map((v, i) => Math.abs(v - q[i]))); };
const DIRS = [[[0,-1],[0,1],[-1,-1],[-1,0],[1,-1],[1,0]], [[0,-1],[0,1],[-1,0],[-1,1],[1,0],[1,1]]];   // [even rows, odd rows]
export function ray(cols, k, d, n) {
  const out = []; let r = k >> 4, c = k & 15;
  while (out.length < n) { const [dr, dc] = DIRS[r % 2][d]; r += dr; c += dc;
    if (r < 0 || c < 0 || c >= cellsIn(cols, r)) break; out.push(key(r, c)); }
  return out;
}
export function within(cols, k, n) {
  const out = [], r0 = k >> 4;
  for (let r = Math.max(0, r0 - n); r <= r0 + n; r++) for (let c = 0; c < cellsIn(cols, r); c++) if (dist(cols, k, key(r, c)) <= n) out.push(key(r, c));
  return out;
}

/* ---------- effects ---------- */
// Pierce flies its own path and takes the first 10 bubbles it passes within HIT.
function pierce(S, ang) {
  const { cols, grid } = S, lo = 1, hi = 2 * cols - 1, clear = new Set();
  let x = cols, y = 1 + (S.top + winRows(cols) - 1) * RH, dx = Math.cos(ang), dy = Math.sin(ang);
  const pts = [{ x, y }];
  for (let i = 0; i < 8000 && clear.size < 10 && y > 1; i++) {
    x += dx * .25; y += dy * .25;
    if (x < lo) { x = 2 * lo - x; dx = -dx; pts.push({ x, y }); }
    if (x > hi) { x = 2 * hi - x; dx = -dx; pts.push({ x, y }); }
    const lr = Math.round((y - 1) / RH);
    for (let r = Math.max(0, lr - 1); r <= lr + 1; r++) for (let c = 0; c < cellsIn(cols, r); c++) {
      const k = key(r, c); if (grid.has(k) && !clear.has(k) && clear.size < 10 && (1 + 2 * c + r % 2 - x) ** 2 + (1 + r * RH - y) ** 2 < HIT * HIT) clear.add(k); }
  }
  pts.push({ x, y });
  return clear.size ? { pts, cell: null, clear, recolour: new Map(), land: null } : null;
}

// What shot item id would do at angle ang. Pure: S is not touched.
export function hits(S, id, ang) {
  const a = clampAim(ang); if (a === null) return null;
  if (id === 'pierce') return pierce(S, a);
  const { cols, grid } = S, { pts, cell } = trace(grid, cols, a, S.top); if (!cell) return null;
  const k0 = key(...cell), clear = new Set(), recolour = new Map(), occ = k => grid.has(k);
  const nb = nk(cols, k0).filter(occ), end = pts[pts.length - 1];
  const dd = k => { const [r, c] = rc(k); return (1 + 2 * c + r % 2 - end.x) ** 2 + (1 + r * RH - end.y) ** 2; };
  const hitCol = nb.length ? grid.get(nb.reduce((p, k) => dd(k) < dd(p) ? k : p)) : null;   // colour of the neighbour nearest the impact
  let land = null;
  if (id === 'bomb') within(cols, k0, 2).filter(occ).forEach(k => clear.add(k));
  else if (id === 'sweep') for (let c = 0; c < cellsIn(cols, cell[0]); c++) occ(key(cell[0], c)) && clear.add(key(cell[0], c));
  else if (id === 'star') for (let d = 0; d < 6; d++) ray(cols, k0, d, 4).filter(occ).forEach(k => clear.add(k));
  else if (id === 'lightning') {   // first to the neighbour with the lowest row (nearer column, then left), then up through the row above
    const near = (p, q) => Math.abs((p & 15) - cell[1]) - Math.abs((q & 15) - cell[1]) || (p & 15) - (q & 15);
    let from = nb.sort((p, q) => (p >> 4) - (q >> 4) || near(p, q))[0];
    while (from !== undefined && clear.size < 8) {
      clear.add(from); const r = from >> 4; if (!r) break;
      from = nk(cols, from).filter(k => k >> 4 === r - 1 && occ(k) && !clear.has(k)).sort(near)[0]; }
  }
  else if (id === 'purge') { if (hitCol !== null) for (const [k, v] of grid) if (v === hitCol && (k >> 4) >= S.top && (k >> 4) <= lossRow(S)) clear.add(k); }
  else if (id === 'virus') { land = hitCol ?? S.cur; if (hitCol !== null) within(cols, k0, 4).filter(occ).forEach(k => grid.get(k) !== hitCol && recolour.set(k, hitCol)); }
  else if (id === 'wildcard') {
    land = S.cur; let best = -1, bd = -1;
    for (const col of new Set(nb.map(k => grid.get(k)))) {
      const g = flood(S, nb.filter(k => grid.get(k) === col), col), pop = g.length + 1 >= 3 ? g : [];
      const gone = new Set(pop), d = grid.size - gone.size - connected(grid, cols, gone).size;
      if (g.length > best || g.length === best && d > bd) { best = g.length; bd = d; land = col; } }
  }
  else if (id === 'rainbow') for (const col of new Set(nb.map(k => grid.get(k)))) {
    const g = flood(S, nb.filter(k => grid.get(k) === col), col); if (g.length >= 2) g.forEach(k => clear.add(k)); }
  else return null;
  if (id !== 'wildcard' && !clear.size && !recolour.size) return null;   // nothing to do: the item stays loaded
  return { pts, cell, clear, recolour, land };
}

/* ---------- use ---------- */
export function useItem(S, id, arg) {
  if (id === 'overclock') S.shots += 5;
  else if (id === 'decrypt') { if (!isColour(arg) || ![...S.grid.values()].includes(arg)) return false; S.cur = arg; }
  else if (id === 'icebreaker') { if (S.breaker > 0) return false; S.breaker = 5; }
  else if (item(id)?.kind === 'shot' && S.load === null) S.load = id;
  else return false;
  return true;
}
export const unload = S => { S.load = null; };
