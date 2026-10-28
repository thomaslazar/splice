import test from 'node:test';
import assert from 'node:assert/strict';
import { hostFor, tierFor, themeFor, THEMES, SHAPES } from '../src/hosts.js';
import { isLong } from '../src/levels.js';

const N = 6000, hosts = Array.from({ length: N }, (_, i) => hostFor(i + 1));

test('hosts are deterministic and well formed', () => {
  assert.deepEqual(hostFor(17), hostFor(17));
  for (const h of hosts) {
    assert.equal(h.label, `${h.owner} // ${h.system}`.toUpperCase());
    assert.ok(SHAPES.includes(h.shape));
    assert.ok(Number.isInteger(h.hue) && h.hue >= 0 && h.hue <= 5);
  }
});
test('the host hue is never the accent hue', () => {
  hosts.forEach((h, i) => assert.notEqual(h.hue, themeFor(i + 1).hue));
  assert.equal(THEMES.length, 6);
});
test('long levels are high stakes and tiers follow difficulty', () => {
  for (let lv = 1; lv <= 200; lv++) if (isLong(lv)) assert.equal(tierFor(lv), 'high');
  assert.equal(tierFor(1), 'small');
  const mix = new Set(); for (let lv = 40; lv <= 400; lv++) if (!isLong(lv)) mix.add(tierFor(lv));
  assert.deepEqual([...mix].sort(), ['corporate', 'high', 'small']);
  assert.equal(hostFor(5).tier, 'high');
});
test('variety: every shape, many systems, government targets, recurring corporations', () => {
  for (const s of SHAPES) assert.ok(hosts.some(h => h.shape === s), s);
  assert.ok(new Set(hosts.map(h => h.system)).size >= 30);
  const gov = hosts.filter(h => h.gov).length / N; assert.ok(gov > 0.1 && gov < 0.25, `gov share ${gov}`);
  assert.ok(new Set(hosts.map(h => h.industry)).size >= 13);
  const stretch = hosts.slice(30, 60).filter(h => !h.gov).map(h => h.owner);
  assert.ok(new Set(stretch).size < stretch.length, 'a corporation recurs within 30 levels');
});
test('every system of every industry and every government tier is reachable', () => {
  const SYS = { finance: ['vault', 'ledger', 'trading floor', 'payroll', 'archive'], insurance: ['claims db', 'actuarial core', 'archive', 'payroll'],
    biotech: ['r&d node', 'clinical db', 'sample vault', 'archive'], pharma: ['r&d node', 'clinical db', 'supply chain', 'patent archive'],
    aerospace: ['flight control', 'telemetry', 'r&d node', 'launch command'], defense: ['command', 'weapons r&d', 'surveillance grid', 'armory'],
    security: ['gate', 'surveillance grid', 'access control', 'archive'], media: ['broadcast', 'content vault', 'ad engine', 'archive'],
    telecom: ['switching core', 'subscriber db', 'relay grid'], logistics: ['supply chain', 'shipping manifest', 'fleet control'],
    energy: ['reactor control', 'grid control', 'telemetry'], ai: ['core', 'training cluster', 'r&d node'] };
  const GOV = { small: ['city records', 'permit office', 'traffic control', 'parking db'], corporate: ['tax records', 'census db', 'customs', 'police records', 'benefits db'],
    high: ['signals intelligence', 'black archive', 'border command', 'satellite uplink', 'defence command'] };
  const got = new Set(hosts.map(h => h.gov ? `gov ${h.tier} ${h.system}` : `${h.industry} ${h.system}`)), miss = [];
  for (const [ind, ss] of Object.entries(SYS)) for (const s of ss) if (!got.has(`${ind} ${s}`)) miss.push(`${ind} ${s}`);
  for (const [t, ss] of Object.entries(GOV)) for (const s of ss) if (!got.has(`gov ${t} ${s}`)) miss.push(`gov ${t} ${s}`);
  assert.deepEqual(miss, []);
});
test('no corporation and system pair on two levels in a row', () => {
  for (let i = 1; i < N; i++) assert.ok(!(hosts[i].owner === hosts[i - 1].owner && hosts[i].system === hosts[i - 1].system), `level ${i + 1}`);
});
test('high stakes systems only on high stakes levels, small-time names are small firms', () => {
  const TOP = ['command', 'weapons r&d', 'launch command', 'core', 'training cluster', 'reactor control', 'signals intelligence', 'black archive', 'border command', 'satellite uplink', 'defence command'];
  for (const h of hosts) if (TOP.includes(h.system)) assert.equal(h.tier, 'high', `${h.label} on tier ${h.tier}`);
});
test('no real brands or agencies', () => {
  const DENY = /\b(NSA|CIA|FBI|MI6|GCHQ|KGB|FSB|Google|Apple|Microsoft|Amazon|Meta|Tesla|Pfizer|Boeing|Lockheed|Raytheon|Siemens|Sony|Samsung|Mitsubishi|Toyota|Arasaka|Militech|Weyland)\b/i;
  for (const h of hosts) assert.ok(!DENY.test(h.owner), h.owner);
});
test('systems are spread: within each tier no system exceeds 25% of its hosts', () => {
  for (const t of ['small', 'corporate', 'high']) {
    const T = hosts.filter(h => h.tier === t), n = {};
    for (const h of T) n[h.system] = (n[h.system] || 0) + 1;
    for (const [s, c] of Object.entries(n)) assert.ok(c / T.length <= 0.25, `${t}: ${s} ${c}/${T.length}`);
  }
});
test('labels are short: 95% within 40 characters, none over 52', () => {
  const L = hosts.map(h => h.label.length);
  assert.ok(L.filter(x => x <= 40).length / N >= 0.95);
  assert.ok(Math.max(...L) <= 52, `max ${Math.max(...L)}`);
});
test('label limits hold everywhere: none over 52, a government jurisdiction only within 40', () => {
  const BASE = /^(Ministry of|Bureau of|Office of|Department of|Commission for) |^Directorate \d+$|^[A-Z]{4}$/;
  for (let lv = 1; lv <= 20000; lv++) {
    const h = hostFor(lv);
    assert.ok(h.label.length <= 52, `level ${lv}: ${h.label}`);
    if (h.gov && !BASE.test(h.owner)) assert.ok(h.label.length <= 40, `level ${lv}: ${h.label}`);
  }
});

import { iceFor, ICE } from '../src/hosts.js';
import { runPos } from '../src/levels.js';

const SEV = { mild: 1, medium: 2, harsh: 3 }, CAP = { small: 1, corporate: 2, high: 3 };
// ICE follows the run of 30: none at 1-11, every other level 12-20 (mild), every level 21-26
// (up to medium) and 27-30 (up to harsh), capped by the host's tier; black only at 27-30 on high stakes
test('ice follows the 30-level run, the tier caps and the black ice rule', () => {
  const seen = new Set();
  for (let lv = 1; lv <= 4000; lv++) { const ice = iceFor(lv), p = runPos(lv), host = hostFor(lv);
    assert.equal(iceFor(lv), ice);
    const due = p >= 21 || p >= 12 && p % 2 === 0;
    assert.equal(!!ice, due, `level ${lv} (run position ${p})`);
    if (!ice) continue; seen.add(ice);
    assert.ok(SEV[ICE[ice]] <= CAP[host.tier], `${ice} on ${host.tier}`);
    if (p <= 20) assert.equal(ICE[ice], 'mild', `level ${lv}: ${ice} too early in the run`);
    if (p <= 26) assert.ok(ICE[ice] !== 'harsh', `level ${lv}: ${ice} too early in the run`);
    if (ice === 'black') assert.ok(p >= 27 && host.tier === 'high');
  }
  assert.deepEqual([...seen].sort(), Object.keys(ICE).sort());
});
test('half of every run has ice', () => {
  for (let run = 0; run < 50; run++) assert.equal(Array.from({ length: 30 }, (_, i) => 30 * run + i + 1).filter(l => iceFor(l)).length, 15);
});
test('ice types are spread: each is 3% to 45% of the levels with ice (1-2000)', () => {
  const n = {}; let all = 0;
  for (let lv = 1; lv <= 2000; lv++) { const ice = iceFor(lv); if (ice) { n[ice] = (n[ice] || 0) + 1; all++; } }
  for (const t of Object.keys(ICE)) { const s = (n[t] || 0) / all; assert.ok(s >= 0.03 && s <= 0.45, `${t} ${(100 * s).toFixed(1)}%`); }
});
