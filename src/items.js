// Items: the shop table, level loot and the deck (frags and held items). Pure: no DOM, no storage.
import { mulberry32, hash } from './core.js';
import { tierFor, iceFor, ICE } from './hosts.js';
import { isLong } from './levels.js';   // circular: used only inside function bodies

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
