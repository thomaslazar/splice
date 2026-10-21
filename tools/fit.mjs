// Fits SHOT_K: plays a sample with no shot limit, fits log(shots used) = log k + e1 log(bubbles) + e2 log(colours)
// [+ e3 log(cols)] per kind (bands weighted equally), then scales k until the bot wins >= 95% in every band.
// Alternate levels of each kind are held out and reported per band. Usage: node tools/fit.mjs [levels] [runs]
import { play, band, parseLevels } from './sim.mjs';
import { makeLayout } from '../src/levels.js';

const pos = process.argv.slice(2), levels = parseLevels(pos[0] || '1-240'), runs = Number(pos[1] || 4); // run = fails, i.e. a colouring
const FEAT = { designed: ['cells', 'colours', 'cols'], noise: ['cells', 'colours'] }, TARGET = 0.95;
const rows = [];
for (const lv of levels) { const L = makeLayout(lv), f = { cells: L.cells.size, colours: L.nColours, cols: L.cols };
  for (let run = 0; run < runs; run++) rows.push({ lv, kind: L.kind, f, used: play(lv, run, true).used });
  process.stderr.write(`\r${lv}`); }
process.stderr.write('\n');

function solve(X, y, w) {   // weighted least squares, Gauss-Jordan on the normal equations
  const n = X[0].length, A = Array.from({ length: n }, () => Array(n + 1).fill(0));
  X.forEach((x, i) => { for (let a = 0; a < n; a++) { for (let b = 0; b < n; b++) A[a][b] += w[i] * x[a] * x[b]; A[a][n] += w[i] * x[a] * y[i]; } });
  for (let i = 0; i < n; i++) for (let r = 0; r < n; r++) if (r !== i) { const q = A[r][i] / A[i][i]; for (let c = i; c <= n; c++) A[r][c] -= q * A[i][c]; }
  return A.map((r, i) => r[n] / r[i]);
}
const med = a => [...a].sort((x, y) => x - y)[a.length >> 1];
const stats = (set, lim) => { const by = {};
  for (const d of set) { const l = lim(d), b = (by[band(d.lv)] ??= { n: 0, left: [] }); b.n++; if (d.used <= l) b.left.push((l - d.used) / l); }
  return by; };
const winMin = by => Math.min(...Object.values(by).map(b => b.left.length / b.n));

const K = {};
for (const kind of ['designed', 'noise']) {
  const all = rows.filter(d => d.kind === kind), lvs = [...new Set(all.map(d => d.lv))];
  const train = all.filter(d => lvs.indexOf(d.lv) % 2 === 0), test = all.filter(d => lvs.indexOf(d.lv) % 2);
  const cnt = {}; for (const d of train) cnt[band(d.lv)] = (cnt[band(d.lv)] || 0) + 1;
  const x = d => [1, ...FEAT[kind].map(f => Math.log(d.f[f]))];
  const e = solve(train.map(x), train.map(d => Math.log(d.used)), train.map(d => 1 / cnt[band(d.lv)]));
  const k = { k: Math.exp(e[0]), cells: 0, colours: 0, cols: 0 }; FEAT[kind].forEach((f, i) => k[f] = +e[i + 1].toFixed(3));
  const lim = (s, d) => Math.max(1, Math.ceil(s * k.k * d.f.cells ** k.cells * d.f.colours ** k.colours * d.f.cols ** k.cols));
  let s = 1; while (winMin(stats(train, d => lim(s, d))) < TARGET) s += 0.01;
  K[kind] = { ...k, k: +(s * k.k).toPrecision(4) };
  for (const [name, set] of [['train', train], ['held-out', test]])
    for (const [b, r] of Object.entries(stats(set, d => lim(s, d))).sort())
      console.log(`${kind} ${name} ${b}: n ${r.n}, win ${(100 * r.left.length / r.n).toFixed(0)}%, median left ${(100 * med(r.left)).toFixed(0)}%`);
}
console.log('export const SHOT_K =', JSON.stringify(K).replace(/"/g, '').replace(/([:,])/g, '$1 ').replace(/\{/g, '{ ').replace(/\}/g, ' }') + ';');
