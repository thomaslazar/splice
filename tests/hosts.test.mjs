import test from 'node:test';
import assert from 'node:assert/strict';
import { hostFor, tierFor, themeFor, THEMES, SHAPES } from '../src/hosts.js';
import { isLong } from '../src/levels.js';

const N = 3000, hosts = Array.from({ length: N }, (_, i) => hostFor(i + 1));

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
  assert.equal(tierFor(1), 'small'); assert.equal(tierFor(22), 'corporate');
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
