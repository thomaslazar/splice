// Host systems: the fictional corporation or agency each level breaks into. Pure: no DOM, no storage.
import { mulberry32, hash } from './core.js';
import { difficulty, isLong, hardness, runPos } from './levels.js';   // circular: used only inside function bodies

/* ---------- themes ---------- */
// hue: the bubble hue each accent resembles (magenta 0, cyan 1, acid 2, amber 3, violet 4, red 5)
export const THEMES = [{ a: '#39ff88', bg: '#060a07', hue: 2 }, { a: '#ff2a4a', bg: '#0b0607', hue: 5 },
  { a: '#20e8ff', bg: '#05090b', hue: 1 }, { a: '#b36bff', bg: '#08060b', hue: 4 },
  { a: '#ffb020', bg: '#0b0905', hue: 3 }, { a: '#ff3df0', bg: '#0b050a', hue: 0 }];
export const themeFor = level => THEMES[hash(level, 3) % 6];

/* ---------- names ---------- */
const SURNAMES = ['Kessler', 'Hayashi', 'Okonkwo', 'Reyes', 'Lindqvist', 'Tanaka', 'Sato', 'Adeyemi', 'Novak', 'Mensah',
  'Castellanos', 'Volkov', 'Nakamura', 'Haddad', 'Okafor', 'Brennan', 'Varga', 'Kowalczyk', 'Moreau', 'Achterberg',
  'Delacroix', 'Petrov', 'Chaudhry', 'Iyer', 'Nguyen', 'Park', 'Rahimi', 'Oyelaran', 'Soto', 'Ferreira',
  'Kaur', 'Zhou', 'Mwangi', 'Halvorsen', 'Esposito', 'Kaya', 'Sandoval', 'Yilmaz', 'Szabo', 'Ngata'];
const COINED = ['Halcyon', 'Novacrest', 'Mitsuda', 'Corvane', 'Lumetra', 'Aurexa', 'Syntaris', 'Velkoria', 'Obsidane',
  'Quorvant', 'Pyralis', 'Kestrion', 'Meridane', 'Torvale', 'Zenthra', 'Ashgrove', 'Ironveil', 'Solmara', 'Cindral',
  'Vantrel', 'Orbiqa', 'Nethra', 'Glasswater', 'Brightmoor', 'Duskline', 'Hexavon', 'Mirolux', 'Tessaline', 'Varnhold',
  'Coldspire', 'Ostrevan'];
const LETTERS = 'CDFHJKLMNPRSTVXZ';   // no vowels, no B or G: keeps clear of real agency acronyms
// ponytail: hand list of real firms and agencies the letters could spell; extend if one slips through
const REAL = new Set(['DHL', 'TNT', 'NTT', 'KPN', 'CNN', 'MTV', 'RTL', 'ZDF', 'CVS', 'KKR', 'PNC', 'DXC', 'NCR', 'DHS', 'NHS', 'FDA', 'CDC', 'TCL', 'DFL', 'HTC', 'ZTE', 'NHK', 'RCA', 'JVC', 'TDK', 'CSX', 'MMC']);
const pick = (r, a) => a[Math.floor(r() * a.length)];
function initials(r, n) {
  for (;;) { let s = ''; for (let i = 0; i < n; i++) s += pick(r, LETTERS); if (!REAL.has(s)) return s; }
}
const NAMES = {   // the four corporation name patterns, without the industry word
  pair: r => { const a = pick(r, SURNAMES); let b; do b = pick(r, SURNAMES); while (b === a); return `${a}-${b}`; },
  coined: r => pick(r, COINED),
  surname: r => pick(r, SURNAMES),
  initials: r => initials(r, 3),
};
const PATTERNS = { small: ['coined', 'surname'], corporate: ['pair', 'coined', 'surname', 'initials'], high: ['pair', 'initials'] };

/* ---------- industries ---------- */
const INDUSTRIES = {
  finance: [['Trust', 'Capital', 'Bank', 'Holdings'], { vault: 4, ledger: 4, 'trading floor': 3, payroll: 2, archive: 1 }],
  insurance: [['Mutual', 'Assurance'], { 'claims db': 4, 'actuarial core': 3, archive: 2, payroll: 2 }],
  biotech: [['Biotech', 'Genomics'], { 'r&d node': 4, 'clinical db': 3, 'sample vault': 2, archive: 1 }],
  pharma: [['Pharma', 'Labs'], { 'r&d node': 3, 'clinical db': 4, 'supply chain': 2, 'patent archive': 2 }],
  aerospace: [['Orbital', 'Aerospace'], { 'flight control': 4, telemetry: 3, 'r&d node': 2, 'launch command': 2 }],
  defense: [['Defense', 'Arms', 'Dynamics'], { command: 4, 'weapons r&d': 3, 'surveillance grid': 3, armory: 2 }],
  security: [['Security', 'Shield'], { gate: 4, 'surveillance grid': 4, 'access control': 3, archive: 1 }],
  media: [['Media', 'Broadcast', 'Studios'], { broadcast: 4, 'content vault': 3, 'ad engine': 3, archive: 1 }],
  telecom: [['Telecom', 'Networks'], { 'switching core': 4, 'subscriber db': 3, 'relay grid': 3 }],
  logistics: [['Logistics', 'Freight'], { 'supply chain': 4, 'shipping manifest': 4, 'fleet control': 3 }],
  energy: [['Energy', 'Power'], { 'reactor control': 4, 'grid control': 4, telemetry: 2 }],
  ai: [['AI', 'Systems', 'Cognition'], { core: 4, 'training cluster': 3, 'r&d node': 2 }],
};
const TOP = ['command', 'weapons r&d', 'launch command', 'core', 'training cluster', 'reactor control', 'surveillance grid'];
// tier -> industry weights, and which systems that tier may hit
const TIERS = {
  small: { industries: { logistics: 1, media: 1, insurance: 1, telecom: 1 }, ok: s => !TOP.includes(s) },
  corporate: { industries: { finance: 1, biotech: 1, pharma: 1, energy: 1, security: 1, telecom: 1 }, ok: s => !TOP.includes(s) },
  high: { industries: { defense: 3, ai: 3, aerospace: 3, security: 1, energy: 1 },
    ok: (s, ind) => !['security', 'energy'].includes(ind) || TOP.includes(s) },
};
const systemsOf = (tier, ind) => Object.entries(INDUSTRIES[ind][1]).filter(([s]) => TIERS[tier].ok(s, ind));

/* ---------- government ---------- */
const GOV_BODIES = ['Ministry of', 'Bureau of', 'Office of', 'Department of', 'Commission for'];
const GOV_TOPICS = ['Records', 'Public Order', 'Civic Infrastructure', 'Continuity', 'Civil Harmony', 'Population Services',
  'Transit', 'Revenue', 'Statistics', 'Public Safety', 'Data Integrity', 'Labour Allocation', 'Internal Affairs'];
const JURISDICTIONS = ['Neo-Lagos Municipal', 'Federated Coast', 'New Kowloon', 'Greater Tethys', 'Free City of Varn',
  'Northern Accord', 'Pacific Compact', 'Outer Ring', 'Meridian Union', 'Baltic Arcology', 'Sahel Federation', 'Neo-Quito Metro'];
const GOV_SYSTEMS = {
  small: { 'city records': 4, 'permit office': 3, 'traffic control': 3, 'parking db': 2 },
  corporate: { 'tax records': 4, 'census db': 3, customs: 3, 'police records': 3, 'benefits db': 2 },
  high: { 'signals intelligence': 4, 'black archive': 3, 'border command': 3, 'satellite uplink': 2, 'defence command': 2 },
};
const fits = (owner, system, n) => `${owner} // ${system}`.length <= n;
function govName(r, system) {   // phone-readable: up to 4 tries for a label within 40, never over 52
  let base;
  for (let t = 0; !base || !fits(base, system, t < 4 ? 40 : 52); t++) {
    const x = r();
    base = x < 0.6 ? `${pick(r, GOV_BODIES)} ${pick(r, GOV_TOPICS)}` : x < 0.8 ? `Directorate ${1 + Math.floor(r() * 19)}` : initials(r, 4);
  }
  const full = `${pick(r, JURISDICTIONS)} ${base}`;   // a jurisdiction only when the label stays within 40
  return r() < 0.5 && fits(full, system, 40) ? full : base;
}

/* ---------- hosts ---------- */
export const SHAPES = ['cubes', 'pyramid', 'spire', 'sphere', 'fortress', 'lattice'];
const SHAPE_OF = {
  cubes: ['vault', 'ledger', 'sample vault', 'content vault', 'claims db', 'subscriber db', 'armory',
    'city records', 'parking db', 'census db', 'benefits db'],
  pyramid: ['r&d node', 'weapons r&d', 'clinical db', 'patent archive', 'archive', 'actuarial core',
    'tax records', 'police records', 'black archive'],
  spire: ['command', 'launch command', 'flight control', 'reactor control', 'trading floor',
    'traffic control', 'border command', 'defence command'],
  sphere: ['broadcast', 'telemetry', 'ad engine', 'relay grid', 'signals intelligence', 'satellite uplink'],
  fortress: ['gate', 'access control', 'payroll', 'shipping manifest', 'supply chain', 'permit office', 'customs'],
  lattice: ['core', 'training cluster', 'switching core', 'surveillance grid', 'grid control', 'fleet control'],
};
const shapeOf = s => SHAPES.find(k => SHAPE_OF[k].includes(s));

export function tierFor(level) {
  if (isLong(level)) return 'high';
  const d = difficulty(level), x = mulberry32(hash(level, 12))();   // small-time at every difficulty, high grows with it
  return x < 0.15 + 0.85 * (1 - d) ? 'small' : x < 1 - 0.3 * d ? 'corporate' : 'high';
}
function weighted(r, list) {   // list: [[name, weight]]
  let x = r() * list.reduce((s, [, w]) => s + w, 0);
  for (const [s, w] of list) if ((x -= w) < 0) return s;
  return list[list.length - 1][0];
}
const pools = new Map();
function pool(tier, stretch) {   // 24 recurring corporations per tier and 30-level stretch
  const k = `${tier} ${stretch}`; if (pools.has(k)) return pools.get(k);
  const r = mulberry32(hash(stretch, ['small', 'corporate', 'high'].indexOf(tier), 13));
  return pools.set(k, Array.from({ length: 24 }, () => {
    const industry = weighted(r, Object.entries(TIERS[tier].industries));
    const longest = systemsOf(tier, industry).reduce((a, [s]) => s.length > a.length ? s : a, '');
    const p = pick(r, PATTERNS[tier]); let owner;   // 8 tries in the drawn pattern for a label within 40, 4 in any, never over 52
    for (let t = 0; !owner || !fits(owner, longest, t < 12 ? 40 : 52); t++)
      owner = `${NAMES[t < 8 ? p : pick(r, PATTERNS[tier])](r)} ${pick(r, INDUSTRIES[industry][0])}`;
    return { owner, industry };
  })).get(k);
}
function rawHost(level, r) {
  const tier = tierFor(level);
  if (r() < 1 / 6) {
    const list = Object.entries(GOV_SYSTEMS[tier]);   // named in settle, once the system is final
    return { owner: null, gov: true, industry: 'gov', tier, list, system: weighted(r, list) };
  }
  const P = pool(tier, Math.floor((level - 1) / 30)), i = Math.floor(r() * 24);
  const list = systemsOf(tier, P[i].industry);
  return { ...P[i], gov: false, tier, list, P, i, system: weighted(r, list) };
}
// The no-repeat rule compares with the previous level's final host (a rerolled one included),
// so hosts are settled in level order and cached.
const hosts = [null];
export function hostFor(level) {
  for (let k = hosts.length; k <= level; k++) hosts[k] = settle(k, hosts.slice(Math.max(1, k - 3), k));
  return hosts[level];
}
function settle(level, recent) {
  const r = mulberry32(hash(level, 11)), h = rawHost(level, r), prev = recent.at(-1);
  // variety: up to three rerolls away from the last three levels' systems
  for (let t = 0; t < 3 && recent.some(p => p.system === h.system); t++) h.system = weighted(r, h.list);
  if (prev && prev.owner === h.owner && prev.system === h.system) {
    if (h.list.length > 1) h.system = h.list[(h.list.findIndex(([s]) => s === prev.system) + 1) % h.list.length][0];
    else for (let j = 1; j < 24; j++) {   // a one-system corporation: move to the next corporation in the pool that differs
      Object.assign(h, h.P[(h.i + j) % 24]); h.list = systemsOf(h.tier, h.industry); h.system = weighted(r, h.list);
      if (h.owner !== prev.owner || h.system !== prev.system) break;
    }
  }
  while (h.gov && (!h.owner || prev?.owner === h.owner && prev.system === h.system)) h.owner = govName(r, h.system);
  const theme = themeFor(level).hue; let hue = Math.floor(r() * 5); if (hue >= theme) hue++;
  const { owner, gov, industry, system, tier } = h;
  return { owner, gov, industry, system, tier, label: `${owner} // ${system}`.toUpperCase(), shape: shapeOf(system), hue,
    params: { size: 0.85 + r() * 0.3, steps: 3 + Math.floor(r() * 4), towers: 2 + Math.floor(r() * 3),
      nodes: 7 + Math.floor(r() * 6) } };
}

/* ---------- ICE ---------- */
export const ICE = { static: 'mild', lag: 'mild', blink: 'mild', scrambler: 'medium', lock: 'medium', jam: 'medium', monochrome: 'harsh', black: 'harsh', jitter: 'harsh' };
export const ICE_K = { mild: 1.1, medium: 1.25, harsh: 1.5 };
// per-type overrides: scrambler is cheap to play around (shoot a wrong colour away), so less room
export const ICE_TYPE_K = { scrambler: 1.1 };
const SEVERITY = { mild: 1, medium: 2, harsh: 3 }, CAP = { small: 1, corporate: 2, high: 3 };
const LIKES = { security: ['scrambler', 'lock', 'static'], media: ['static', 'blink'], telecom: ['static', 'lag'],
  finance: ['scrambler', 'lag'], insurance: ['scrambler', 'blink'], ai: ['jitter', 'monochrome', 'lag'],
  defense: ['black', 'monochrome', 'lock'], aerospace: ['black', 'lock'], biotech: ['static', 'scrambler', 'jam'],
  pharma: ['static', 'scrambler', 'jam'], energy: ['jam', 'scrambler', 'static'], logistics: ['jam', 'scrambler', 'static'] };
const GOV_LIKES = { small: [], corporate: ['scrambler', 'static', 'lock'], high: ['monochrome', 'black', 'lock'] };
// ICE follows the run (runPos 1..30): none at 1-11, every other level 12-20 (mild), every level
// 21-26 (up to medium) and 27-30 (up to harsh), always capped by the host's tier.
export function iceFor(level) {
  const p = runPos(level), pickR = mulberry32(hash(level, 13))();
  if (p < 12 || p <= 20 && p % 2) return null;
  const { gov, industry, tier } = hostFor(level), cap = Math.min(CAP[tier], p <= 20 ? 1 : p <= 26 ? 2 : 3);
  const ok = t => SEVERITY[ICE[t]] <= cap && (t !== 'black' || p >= 27 && tier === 'high');
  const likes = (gov ? GOV_LIKES[tier] : LIKES[industry]).filter(ok);
  let list = likes.length ? likes : Object.keys(ICE).filter(ok);   // any type within the cap
  // the end of a run on high stakes is always harsh; the mild stretch spreads evenly over both mild types
  if (cap === 3) list = Object.keys(ICE).filter(t => ok(t) && ICE[t] === 'harsh');
  if (cap === 1) list = Object.keys(ICE).filter(ok);
  // ponytail: preferred types weighted 2:1:1 by order; tune by playing
  // types at the current severity cap count double, so the end of a run brings the harsher ICE
  const even = cap === 1 || cap === 3, w = list.map((t, i) => (even ? 1 : (i ? 1 : 2) * (SEVERITY[ICE[t]] === cap ? 2 : 1)));
  let x = pickR * w.reduce((a, b) => a + b);
  return list.find((_, i) => (x -= w[i]) < 0);
}
