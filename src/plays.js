// Opt-in play log: pure, mutates only the log passed in. Shot entry: {n, s, c, sw, st, x, am, a, l, p, d, f, b, pc}.
import { ITEM_BASE, itemPlan } from './items.js';
import { hardness } from './levels.js';
export const PLAYS_V = 1, PLAYS_MAX = 1e6;
export const logFrom = o => {
  const l = o && typeof o === 'object' ? o : {};
  return { v: PLAYS_V, on: l.on === true, id: typeof l.id === 'string' && l.id.length >= 8 && l.id.length <= 32 ? l.id : null,
    attempts: Array.isArray(l.attempts) ? l.attempts : [] };
};
export const attemptOf = (S, { ice, deck, at }) => { const v = [...S.grid.values()];
  return { level: S.level, fails: S.fails, kind: S.kind, cols: S.cols, colours: new Set(v.filter(x => x < ITEM_BASE)).size,
    hardness: hardness(S.level), ice, items: itemPlan(S.level).kind !== 'none', itemBubbles: v.filter(x => x >= ITEM_BASE),
    limit: S.maxShots, need: S.need ?? null, deck: { ...deck.items }, frags: deck.frags, at, t: 0, shots: [], end: null, left: null, paid: null }; };
export const open = log => { const a = log.attempts.at(-1); return a && a.end === null ? a : null; };
export const close = (log, end, S, paid = null) => { const a = open(log); if (a) { a.end = end; a.left = S ? S.shots : null; a.paid = paid; } };
export const startAttempt = (log, attempt) => { close(log, 'left'); log.attempts.push(attempt); };
export const resume = (log, S) => { const a = open(log); if (a && a.level === S.level && a.fails === S.fails) return true; close(log, 'left', S); return false; };
export const shot = (log, entry) => open(log)?.shots.push(entry);
export const use = (log, id) => { const a = open(log); if (a) a.shots.push({ u: id, n: a.shots.filter(e => !e.u).length + 1 }); };
export const setOn = (log, on) => { log.on = on; if (!on && open(log)) log.attempts.pop(); };
export const trim = (log, max = PLAYS_MAX) => {
  while (JSON.stringify(log).length > max && log.attempts.length > (open(log) ? 1 : 0)) log.attempts.shift();
};
export const fileOf = (log, device, build, date) => ({ name: `splice-plays-${date.toISOString().slice(0, 10)}.json`,
  text: JSON.stringify({ v: PLAYS_V, build, id: log.id, device, attempts: log.attempts }) });
