// Items: the shop table, level loot and the deck (frags and held items). Pure: no DOM, no storage.
import { mulberry32, hash, key, isColour, rc, nk, trace, connected, flood, lossRow, clampAim, cellsIn, HIT, RH, won } from './core.js';
import { tierFor, iceFor, ICE } from './hosts.js';
import { isLong, winRows, colourize } from './levels.js';   // circular: used only inside function bodies

/* ---------- table ---------- */
export const ITEMS = [['bomb', 'shot', 1], ['sweep', 'shot', 1], ['pierce', 'shot', 1], ['wildcard', 'shot', 1],
  ['overclock', 'instant', 1], ['decrypt', 'instant', 1], ['icebreaker', 'instant', 1], ['star', 'shot', 31],
  ['lightning', 'shot', 31], ['virus', 'shot', 61], ['purge', 'shot', 61], ['rainbow', 'shot', 61],
  ['rollback', 'instant', 91]].map(([id, kind, from]) => ({ id, kind, from }));
export const item = id => ITEMS.find(i => i.id === id);
// prices and loot rates: owner OK after playtest (early frags build a nest egg for the hard levels)
export const PRICES = { bomb: 400, sweep: 350, pierce: 450, wildcard: 300, overclock: 500, decrypt: 300, icebreaker: 450,
  star: 500, lightning: 500, virus: 600, purge: 700, rainbow: 700, rollback: 600 };
export const UNLOCKS = [31, 61, 91];
export const unlocked = level => ITEMS.filter(i => i.from <= level).map(i => i.id);

/* ---------- item bubbles ---------- */
export const ITEM_BASE = 6;   // grid values 0..5 are colours, ITEM_BASE + i is item bubble SHOTS[i]
export const SHOTS = ITEMS.filter(i => i.kind === 'shot').map(i => i.id);
export const isItem = v => v >= ITEM_BASE;
export const itemOf = v => SHOTS[v - ITEM_BASE];
export const valueOf = id => ITEM_BASE + SHOTS.indexOf(id);
export const itemPlan = level => {
  if (level < 3) return { kind: 'none', perScreen: 0 };
  const r = mulberry32(hash(level, 23)), has = r() < .25, full = r() < .2;
  return !has ? { kind: 'none', perScreen: 0 } : full ? { kind: 'full', perScreen: 3 } : { kind: 'normal', perScreen: 2 };
};
// Rows per screen: designed layouts stack bands of sec rows from row 0; noise splits its rows into layout.screens bands.
export const secOf = (layout, grid) => {
  if (layout.kind === 'designed') return Math.round(1.6 * layout.cols);
  let rows = 0; for (const k of grid.keys()) rows = Math.max(rows, (k >> 4) + 1);
  return Math.ceil(rows / layout.screens);
};
// Same on every try: seeded from the level only (scored on the fails 0 colours; a retry only reshuffles colours).
// Normal screens get 0..2, full ones 3. Each item goes to one of the 3 reachable spots where it does the most, never next
// to another item bubble, and never a second sweep in a row that has one (the first clears it, the second does nothing).
export function placeItems(layout, level, grid) {
  const plan = itemPlan(level), out = new Map(grid); if (plan.kind === 'none') return out;
  const rnd = mulberry32(hash(level, 24)), ids = unlocked(level).filter(id => SHOTS.includes(id)), cols = layout.cols;
  const base = colourize(layout, level, 0), sec = secOf(layout, base), bands = new Map();
  for (const k of [...base.keys()].sort((a, b) => a - b)) { const s = Math.floor((k >> 4) / sec); bands.has(s) ? bands.get(s).push(k) : bands.set(s, [k]); }
  for (const [s, ks] of [...bands].sort((a, b) => a[0] - b[0])) {
    // the board as it is once this screen is the lowest one left: the screens below it are cleared by then
    const g = new Map([...base].filter(([k]) => (k >> 4) < (s + 1) * sec)), mine = [];   // this screen's item bubbles
    const n = Math.min(ks.length, plan.kind === 'full' ? plan.perScreen : Math.floor(rnd() * 3));
    for (let i = 0; i < n; i++) {
      const id = ids[Math.floor(rnd() * ids.length)], pick = rnd(), best = [], open = openOf(g, cols);
      const scored = ks.filter(k => isColour(g.get(k)) && !nk(cols, k).some(x => isItem(g.get(x))) && !(id === 'sweep' && mine.some(x => itemOf(g.get(x)) === 'sweep' && x >> 4 === k >> 4))).map(k => [worth(g, cols, id, k), k]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
      for (const [, k] of scored) {   // it, and the ones already on this screen, must stay reachable
        const v = g.get(k); g.set(k, valueOf(id)); if ([k, ...mine].every(x => reach(g, cols, x, open))) best.push(k); g.set(k, v);
        if (best.length === 3) break;
      }
      if (!best.length) continue;
      const k = best[Math.floor(pick * best.length)]; g.set(k, valueOf(id)); base.set(k, valueOf(id)); out.set(k, valueOf(id)); mine.push(k);
    }
  }
  return out;
}
// What item id set off at k does to g: the bubbles it clears, pops or recolours. Pierce goes straight up; a colour-reading
// item takes the colour of a neighbour. Falls do not count: with them every item went to the neck of its screen, where
// one shot dropped the whole screen.
export const worth = (g, cols, id, k) => area(g, cols, id, k).size;
function area(g, cols, id, k) {
  const v = g.get(k); g.delete(k);   // read g with k taken out, as a fired item bubble is
  const nc = nk(cols, k).filter(x => isColour(g.get(x))), hit = nc.length ? g.get(nc[0]) : null;
  let gone;
  if (id === 'wildcard') {   // its biggest touching group pops (effect() also weighs the falls of each, too slow here)
    const view = { cols, grid: g }; gone = new Set();
    for (const col of new Set(nc.map(x => g.get(x)))) { const grp = flood(view, nc.filter(x => g.get(x) === col), col); if (grp.length >= 2 && grp.length > gone.size) gone = new Set(grp); }
  } else {
    const S = { cols, grid: g, top: Math.max(0, (k >> 4) - winRows(cols) + 5), cur: hit ?? 0 };
    const e = effect(S, g, id, k, hit, [0, -1]); gone = new Set([...e.clear, ...e.pop, ...e.recolour.keys()]);
  }
  g.set(k, v); return gone;
}
// Whether start still reaches the ceiling with gone taken out. Climbs first, so it usually takes about as many steps as
// start is rows deep.
function hangs(g, cols, gone, start) {
  const seen = new Set([start]), st = [start];
  while (st.length) {
    const x = st.pop(); if (x >> 4 === 0) return true;
    for (const up of [false, true]) for (const y of nk(cols, x)) if ((y >> 4 < x >> 4) === up && g.has(y) && !gone.has(y) && !seen.has(y)) { seen.add(y); st.push(y); }   // rows above go on top
  }
  return false;
}
// Empty cells a packet can get to: flood through empty cells from the row below the lowest bubble.
export function openOf(g, cols) {
  let low = 0; for (const k of g.keys()) low = Math.max(low, k >> 4);
  const st = Array.from({ length: cellsIn(cols, low + 1) }, (_, c) => key(low + 1, c)), seen = new Set(st);
  while (st.length) for (const n of nk(cols, st.pop())) if (!g.has(n) && (n >> 4) <= low + 1 && !seen.has(n)) { seen.add(n); st.push(n); }
  return seen;
}
// Whether pops can open k to that space while it still hangs: for each colour neighbour of k, dig the cheapest way from it
// to the space (fewest groups, at most 3; another item bubble on the way counts as one, as touching it sets it off), take
// those out and check that k
// still reaches the ceiling.
export function reach(g, cols, k, open) {
  if (nk(cols, k).some(x => open.has(x))) return true;
  const view = { cols, grid: g };
  for (const n of nk(cols, k)) {
    if (!g.has(n)) continue;
    const cost = new Map([[n, 1]]), from = new Map(), bk = [[], [n], [], []]; let end = null;   // buckets by cost: staying in a group is free
    for (let c = 1; c <= 3 && end === null; c++) while (bk[c].length) {
      const x = bk[c].pop(); if (cost.get(x) !== c) continue;
      if (nk(cols, x).some(y => open.has(y))) { end = x; break; }
      for (const y of nk(cols, x)) if (g.has(y) && y !== k) {
        const cy = c + (g.get(y) === g.get(x) ? 0 : 1);
        if (cy <= 3 && cy < (cost.get(y) ?? Infinity)) { cost.set(y, cy); from.set(y, x); bk[cy].push(y); }
      }
    }
    if (end === null) continue;
    const gone = new Set(); for (let x = end; x !== undefined; x = from.get(x)) if (!gone.has(x)) flood(view, [x], g.get(x)).forEach(y => gone.add(y));
    if (hangs(g, cols, gone, k)) return true;
  }
  return false;
}

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
const centre = k => [1 + 2 * (k & 15) + ((k >> 4) % 2), 1 + (k >> 4) * RH];
// Pierce flies from (x, y) along the unit vector (dx, dy), bouncing off the walls, and takes the first 10 bubbles it passes within HIT.
function pierce(S, g, x, y, dx, dy) {
  const { cols } = S, lo = 1, hi = 2 * cols - 1, clear = new Set(), pts = [{ x, y }];
  for (let i = 0; i < 8000 && clear.size < 10 && y > 1; i++) {
    x += dx * .25; y += dy * .25;
    if (x < lo) { x = 2 * lo - x; dx = -dx; pts.push({ x, y }); }
    if (x > hi) { x = 2 * hi - x; dx = -dx; pts.push({ x, y }); }
    const lr = Math.round((y - 1) / RH);
    for (let r = Math.max(0, lr - 1); r <= lr + 1; r++) for (let c = 0; c < cellsIn(cols, r); c++) {
      const k = key(r, c); if (g.has(k) && !clear.has(k) && clear.size < 10 && (1 + 2 * c + r % 2 - x) ** 2 + (1 + r * RH - y) ** 2 < HIT * HIT) clear.add(k); }
  }
  pts.push({ x, y });
  return { pts, clear };
}

// The effect of shot item id centred on cell k (a landing cell, or an item bubble already taken out of g), reading g.
// hit: the hit colour or null; dir: unit vector for Pierce. Returns { clear, pop, recolour, land }; g is not touched.
function effect(S, g, id, k, hit, dir) {
  const { cols } = S, [r0, c0] = rc(k), clear = new Set(), pop = new Set(), recolour = new Map(), occ = x => g.has(x);
  const nb = nk(cols, k).filter(occ), nbc = nb.filter(x => isColour(g.get(x))), view = { cols, grid: g };
  let land = null;
  if (id === 'bomb') within(cols, k, 2).filter(occ).forEach(x => clear.add(x));
  else if (id === 'sweep') for (let c = 0; c < cellsIn(cols, r0); c++) occ(key(r0, c)) && clear.add(key(r0, c));
  else if (id === 'star') for (let d = 0; d < 6; d++) ray(cols, k, d, 4).filter(occ).forEach(x => clear.add(x));
  else if (id === 'lightning') {   // first to the neighbour with the lowest row (nearer column, then left), then up through the row above
    const near = (p, q) => Math.abs((p & 15) - c0) - Math.abs((q & 15) - c0) || (p & 15) - (q & 15);
    let from = nb.sort((p, q) => (p >> 4) - (q >> 4) || near(p, q))[0];
    while (from !== undefined && clear.size < 8) {
      clear.add(from); const r = from >> 4; if (!r) break;
      from = nk(cols, from).filter(x => x >> 4 === r - 1 && occ(x) && !clear.has(x)).sort(near)[0]; }
  }
  else if (id === 'pierce') { const [x, y] = centre(k); pierce(S, g, x, y, dir[0], dir[1]).clear.forEach(x => clear.add(x)); }
  else if (id === 'purge') { if (hit !== null) for (const [x, v] of g) if (v === hit && (x >> 4) >= S.top && (x >> 4) <= lossRow(S)) clear.add(x); }
  else if (id === 'virus') { land = hit ?? (S.grid.has(k) ? null : S.cur);   // an item bubble with no colour next to it does nothing
    if (hit !== null) within(cols, k, 4).filter(occ).forEach(x => isColour(g.get(x)) && g.get(x) !== hit && recolour.set(x, hit)); }
  else if (id === 'wildcard') {
    land = S.cur; let best = -1, bd = -1;
    for (const col of new Set(nbc.map(x => g.get(x)))) {
      const grp = flood(view, nb.filter(x => g.get(x) === col), col), gone = new Set(grp.length + 1 >= 3 ? grp : []);
      const d = g.size - gone.size - connected(g, cols, gone).size;
      if (grp.length > best || grp.length === best && d > bd) { best = grp.length; bd = d; land = col; } }
    const grp = flood(view, nb.filter(x => g.get(x) === land), land); if (grp.length + 1 >= 3) { grp.forEach(x => pop.add(x)); pop.add(k); }
  }
  else if (id === 'rainbow') for (const col of new Set(nbc.map(x => g.get(x)))) {
    const grp = flood(view, nb.filter(x => g.get(x) === col), col); if (grp.length >= 2) grp.forEach(x => pop.add(x)); }
  return { clear, pop, recolour, land };
}

const lastDir = pts => { const p = pts[pts.length - 2], q = pts[pts.length - 1], d = Math.hypot(q.x - p.x, q.y - p.y) || 1; return [(q.x - p.x) / d, (q.y - p.y) / d]; };

// Plays one shot on a copy of the grid: the shot's own effect, the touched item bubbles in key order, then chains breadth
// first, each item bubble once. shot is { ang } (the packet S.cur) or { ang, id } (a deck item). Pure. Null if the shot cannot
// fly or a deck item would change nothing. clear = base cells taken out by item effects (a fired item bubble is in clear unless it turns into a colour bubble, Wildcard or Virus; a fired Wildcard that then pops is in both clear and popped), popped =
// cells taken out by colour pops (the landed packet too), recolour = surviving base cells that changed value, after = the grid.
export function resolve(S, shot) {
  const a = clampAim(shot.ang); if (a === null) return null;
  const { cols } = S, id = shot.id, g = new Map(S.grid), clear = new Set(), popped = new Set(), fired = [], queue = [], seen = new Set(), hitOf = new Map();
  const enqueue = (set, hit = null) => { for (const x of [...set].sort((p, q) => p - q)) if (isItem(S.grid.get(x)) && !seen.has(x)) { seen.add(x); queue.push(x); hitOf.set(x, hit); } };
  const apply = (e, k) => {
    for (const [x, v] of e.recolour) g.set(x, v);
    if (e.land !== null && k !== null) g.set(k, e.land);
    for (const x of e.clear) { clear.add(x); g.delete(x); }
    for (const x of e.pop) { popped.add(x); g.delete(x); }
  };
  let pts, cell = null, land = null, dir;
  if (id === 'pierce') {
    const p = pierce(S, g, cols, 1 + (S.top + winRows(cols) - 1) * RH, Math.cos(a), Math.sin(a));
    pts = p.pts; dir = lastDir(pts); apply({ clear: p.clear, pop: new Set(), recolour: new Map(), land: null }, null); enqueue(p.clear);
  } else {
    const t = trace(g, cols, a, S.top); if (!t.cell) return null;
    pts = t.pts; cell = t.cell; dir = lastDir(pts);
    const k0 = key(...cell), end = pts[pts.length - 1];
    enqueue(nk(cols, k0).filter(x => isItem(g.get(x))), id ? null : S.cur);   // touched first
    if (id) {
      const nbc = nk(cols, k0).filter(x => g.has(x) && isColour(g.get(x)));
      const dd = x => { const [r, c] = rc(x); return (1 + 2 * c + r % 2 - end.x) ** 2 + (1 + r * RH - end.y) ** 2; };
      const e = effect(S, g, id, k0, nbc.length ? g.get(nbc.reduce((p, x) => dd(x) < dd(p) ? x : p)) : null, dir);
      land = e.land; apply(e, k0); enqueue(e.clear);
    } else {
      g.set(k0, S.cur);
      const grp = flood({ cols, grid: g }, [k0], S.cur); if (grp.length >= 3) for (const x of grp) { popped.add(x); g.delete(x); }
    }
  }
  for (let i = 0; i < queue.length; i++) {   // item bubbles go off at their own cell; the queue grows with chains
    const k = queue[i]; fired.push(k); g.delete(k); clear.add(k);
    const first = hitOf.get(k) ?? g.get(nk(cols, k).find(x => g.has(x) && isColour(g.get(x))));
    const e = effect(S, g, itemOf(S.grid.get(k)), k, first ?? null, dir); apply(e, k); if (g.has(k)) clear.delete(k); enqueue(e.clear);   // a bubble that became a colour stays
  }
  const recolour = new Map(); for (const [k, v] of g) if (S.grid.has(k) && S.grid.get(k) !== v) recolour.set(k, v);
  if (id && id !== 'wildcard' && !clear.size && !recolour.size && !popped.size) return null;   // nothing to do: the item stays loaded
  return { pts, cell, clear, popped, recolour, land, fired, after: g };
}

// What a deck item would do at angle ang: the preview (resolve with chains).
export const hits = (S, id, ang) => resolve(S, { ang, id });

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
