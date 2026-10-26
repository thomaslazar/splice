// Run rules: the best level reached, the fails earned on it, and the level number typed in. Pure: no DOM, no storage.

// The saved run if it is valid, else one that starts from the level save. Best is never below level.
export function runFrom(o, level, fails) {
  const ok = o && typeof o === 'object' && Number.isInteger(o.best) && o.best >= 1 && Number.isInteger(o.fails) && o.fails >= 0;
  const run = ok ? o : { best: level, fails };
  return run.best >= level ? run : { best: level, fails: run.fails };
}

// Starting a level: returns the run to store and the fails to play with. The best level keeps its earned fails.
export function enter(run, level, fails) {
  if (level > run.best) return { run: { best: level, fails }, fails };
  if (level === run.best) {
    const f = Math.max(fails, run.fails);
    return { run: { best: run.best, fails: f }, fails: f };
  }
  return { run, fails };
}

// The level number typed in, kept in 1..best. Blank or non-integer text means cur.
export function clampLevel(text, best, cur) {
  const t = String(text).trim();
  const n = t === '' ? cur : Number(t);
  return Math.min(best, Math.max(1, Number.isInteger(n) ? n : cur));
}
