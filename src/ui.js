// Canvas board, DOM HUD and sheets, input, animation, saving. All rules live in core.js.
import { hash, RH, key, rc, centre, lossRow, clampAim, trace, startState, swap, won, lost, fire, toSave, fromSave, validSave } from './core.js';
import { winRows } from './levels.js';
import { themeFor, hostFor } from './hosts.js';
import { drawHost } from './hostdraw.js';

const KEY = 'splice-v1', $ = s => document.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- language ---------- */
// Texts live in lang/<code>.json; lang/languages.json lists them. Missing keys fall back to English.
const LANG_KEY = 'splice-lang';
const getJSON = f => fetch(f).then(r => r.json());
const LANGS = await getJSON('lang/languages.json');
let T;
const t = (k, v = {}) => T[k].replace(/\{(\w+)\}/g, (_, n) => v[n]);
async function setLang(code) {
  const [en, tr] = await Promise.all([getJSON('lang/en.json'), code === 'en' ? {} : getJSON(`lang/${code}.json`)]);
  T = { ...en, ...tr }; document.documentElement.lang = code;
}
function pickLang() {
  try { const l = localStorage.getItem(LANG_KEY); if (LANGS[l]) return l; } catch (e) {}
  for (const n of navigator.languages || [navigator.language]) { const b = String(n).slice(0, 2).toLowerCase(); if (LANGS[b]) return b; }
  return 'en';
}
await setLang(pickLang());

/* ---------- look ---------- */
const HUES = [330, 185, 95, 42, 270, 5];   // magenta, cyan, acid, amber, violet, red
const cv = $('#board'), g = cv.getContext('2d'), PAD = 4;   // PAD: room for the ceiling line above row 0
const colour = (i, l = 60) => `hsl(${HUES[i]} 100% ${l}%)`;
function sym(i, x, y, s) {
  g.beginPath();
  switch (i) {
    case 0: g.arc(x, y, s * .45, 0, 7); break;
    case 1: g.moveTo(x, y - s * .6); g.lineTo(x + s * .55, y + s * .4); g.lineTo(x - s * .55, y + s * .4); g.closePath(); break;
    case 2: g.rect(x - s * .4, y - s * .4, s * .8, s * .8); break;
    case 3: g.moveTo(x, y - s * .6); g.lineTo(x + s * .5, y); g.lineTo(x, y + s * .6); g.lineTo(x - s * .5, y); g.closePath(); break;
    case 4: g.moveTo(x - s * .5, y); g.lineTo(x + s * .5, y); g.moveTo(x, y - s * .5); g.lineTo(x, y + s * .5); break;
    case 5: g.moveTo(x - s * .45, y - s * .45); g.lineTo(x + s * .45, y + s * .45); g.moveTo(x + s * .45, y - s * .45); g.lineTo(x - s * .45, y + s * .45); break;
  }
  g.stroke();
}
function bubble(x, y, col, a = 1, rr = sc) {   // x, y, rr in px
  g.globalAlpha = Math.max(0, a);
  g.shadowColor = colour(col); g.shadowBlur = rr * .6;
  g.fillStyle = colour(col, 18); g.beginPath(); g.arc(x, y, rr * .9, 0, 7); g.fill();
  g.shadowBlur = 0; g.lineWidth = Math.max(1.5, rr * .12); g.strokeStyle = colour(col); g.stroke();
  g.lineWidth = Math.max(1.2, rr * .1); sym(col, x, y, rr * .7);
  g.globalAlpha = 1;
}

/* ---------- state ---------- */
// Board units are bubble radii (core.js); sc is px per unit. view is the top row shown, eased toward S.top.
let S, theme, sc = 1, W = 0, H = 0, view = 0, aim = null, aimId = null, asking = false, fly = null, fx = [];
// Host strip above the board: closed until the view reaches the ceiling, then opens over STRIP_MS.
// strip is how far open (0..1), stripAt when it started opening (null: closed).
const STRIP = 2 * RH, STRIP_MS = 400, sv = $('#strip'), sg = sv.getContext('2d');
let strip = 0, stripAt = null, refit = false;   // refit: fit() at the start of the next frame
// Win sequence: log line, QUIET ms, GLITCH ms into the accent colour, then the sheet.
// win: null, or { at, done }; done once the sheet is due (a reload on a won board starts done).
const QUIET = 600, GLITCH = 1200;   // the glitch: bursts apart and turns the accent colour
let win = null;
const busy = () => win !== null && !win.done;
const SY = () => 1 + (winRows(S.cols) - 1) * RH;   // shooter y in screen units
const X = u => u * sc, Y = u => (u - view * RH) * sc;
const target = () => S.top;
const ready = () => !fly && view === target() && (stripAt === null || strip === 1) && !busy() && $('#sheet').hidden && S.cur !== null && S.grid.size > 0;
function save() { try { localStorage.setItem(KEY, JSON.stringify(toSave(S))); } catch (e) {} }
function load() {   // a valid save, or [level, fails] to begin: an invalid save keeps its level, unreadable means level 1
  let o; try { o = JSON.parse(localStorage.getItem(KEY)); if (validSave(o)) return fromSave(o); } catch (e) {}
  return o && Number.isInteger(o.level) && o.level >= 1 ? [o.level, Number.isInteger(o.fails) && o.fails >= 0 ? o.fails : 0] : [1, 0];
}
// startState runs the bot to set the shot limit (up to about a second on big levels), so a level
// begins behind a short loading card; it stays up at least LOAD_MIN so it never just flickers.
const LOAD_MIN = 500; let loading = false;
async function begin(level, fails) {
  loading = true; aim = aimId = null; fly = win = null; $('#sheet').hidden = true;   // an old flight or win never reaches its sheet
  setTheme(level); $('#loadT').textContent = t('level', { n: level }); $('#loadM').textContent = t('loading'); $('#load').hidden = false;
  const t0 = performance.now();
  await new Promise(r => requestAnimationFrame(() => setTimeout(r)));   // let the card paint first
  const s = startState(level, fails);
  await new Promise(r => setTimeout(r, Math.max(0, LOAD_MIN - (performance.now() - t0))));
  $('#load').hidden = true; loading = false; start(s);
}
function hud() {
  $('#jack').textContent = t('jackedIn'); $('#host').textContent = hostFor(S.level).label;
  $('#lvl').textContent = t('lvl', { n: S.level }); $('#score').textContent = S.score;
  $('#restart').textContent = t('restart'); $('#wip').textContent = t('wip');
  // packets bar: up to 20 segments, each standing for per shots
  const per = Math.ceil(S.maxShots / 20), n = Math.ceil(S.maxShots / per), lit = Math.min(n, Math.ceil(S.shots / per));
  $('#pk').textContent = t('packets'); $('#shots').textContent = S.shots;
  $('#segs').innerHTML = '<i class="on"></i>'.repeat(lit) + '<i></i>'.repeat(n - lit);
}
function fit() {
  // everything but the canvases: header, frame padding, packets bar, log, wip line. The host label
  // wraps with the width, so set the width first, then measure (twice: the width shrinks once more).
  const hu = SY() + 2, dpr = devicePixelRatio || 1; let w = Math.min(520, innerWidth);
  for (let i = 0; i < 2; i++) {
    $('#deck').style.width = w + 'px';
    const rest = $('#deck').offsetHeight - cv.offsetHeight - sv.offsetHeight + $('#wip').offsetHeight;
    w = Math.min(520, innerWidth, (innerHeight - rest - PAD) * 2 * S.cols / (hu + strip * STRIP));
  }
  sc = w / (2 * S.cols); W = w; H = hu * sc; $('#deck').style.width = W + 'px';
  cv.style.width = W + 'px'; cv.style.height = H + PAD + 'px';
  cv.width = Math.round(W * dpr); cv.height = Math.round((H + PAD) * dpr); g.setTransform(dpr, 0, 0, dpr, 0, PAD * dpr);
  const sh = strip * STRIP * sc; sv.style.width = W + 'px'; sv.style.height = sh + 'px';
  sv.width = Math.round(W * dpr); sv.height = Math.round(sh * dpr); sg.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function reveal() {   // open the strip once the ceiling is in view and no packet flies; draw() refits next frame
  if (stripAt !== null || fly || S.top !== 0) return;
  stripAt = performance.now(); strip = 0;
}
function sheet() {   // result sheet; a pending restart question stays open unless the level ended
  const w = won(S), l = lost(S); if (asking && !w && !l) return;
  asking = false; $('#sheetC').hidden = true; $('#sheet').hidden = !w && !l; if (!w && !l) return;
  $('#sheetT').textContent = w ? t('winTitle') : t('loseTitle'); $('#sheetB').textContent = w ? t('winButton') : t('loseButton');
}
function setTheme(level) {
  theme = themeFor(level);
  document.documentElement.style.setProperty('--acc', theme.a); document.documentElement.style.setProperty('--bg', theme.bg);
}
/* ---------- run log ---------- */
// Two visible lines, newest on top, in memory only. Once-flags: host, trace rising, trace critical.
let lines = [], seen = {}, logTop = 0, logPct = 0;
function log(text) { lines.unshift(text); lines.length = Math.min(lines.length, 2); showLog(); }
function showLog() {
  const el = $('#log'); el.textContent = '';
  lines.forEach((l, i) => { const d = document.createElement('div'); d.textContent = l; d.style.opacity = i ? .45 : 1; if (!i) d.className = 'cur'; el.append(d); });
}
function pct() {
  let low = 0; for (const k of S.grid.keys()) low = Math.max(low, k >> 4);
  return Math.min(100, Math.max(0, Math.round(20 * (S.startLow - low) / (S.startLow + 1)) * 5));
}
const flagged = () => ({ host: S.top === 0, rising: S.shots <= .25 * S.maxShots, critical: S.shots <= 3 });
function logStart() {   // clear, connect, and set the once-flags that already hold without writing
  lines = []; seen = flagged(); logTop = S.top; logPct = pct(); log(t('logConnect', { host: hostFor(S.level).owner }));
}
function logShot(dropped) {   // events in the spec's order, after a landed shot
  if (dropped >= 6) log(t('logBreach', { n: dropped }));
  const p = pct(); if (S.top !== logTop && p !== logPct) log(t('logDeeper', { pct: p })); logTop = S.top; logPct = p;
  const f = flagged();
  for (const [n, text] of [['host', t('logHost')], ['rising', t('logTrace')], ['critical', t('logCritical')]]) if (f[n] && !seen[n]) { seen[n] = true; log(text); }
  if (lost(S)) log(t('logLost')); else if (won(S)) log(t('logRoot', { host: hostFor(S.level).owner }));
}
function start(s) {
  S = s; logStart(); view = target(); fly = null; fx = []; aim = aimId = null; asking = false;
  stripAt = S.top === 0 ? -Infinity : null; strip = S.top === 0 ? 1 : 0;   // open at once at the ceiling
  win = won(S) ? { at: -Infinity, done: true } : null;   // a reload on a won board: sheet at once, host in the accent
  setTheme(S.level);
  hud(); fit(); save(); sheet(); calm();
}
// Grace period after a sheet closes: a tap on its button can linger or repeat onto the board,
// and touches queued while startState ran its bot carry earlier timestamps; both are ignored.
const GRACE = 400; let calmAt = 0;
const calm = () => { calmAt = performance.now() + GRACE; };
const keep = () => { asking = false; $('#sheetC').hidden = true; $('#sheet').hidden = true; calm(); };
$('#restart').onclick = () => {   // ask first; only the confirm button restarts (fails unchanged)
  if (!$('#sheet').hidden || loading || busy()) return;
  asking = true; aim = aimId = null; $('#sheet').hidden = $('#sheetC').hidden = false;
  $('#sheetT').textContent = t('restartAsk'); $('#sheetB').textContent = t('restartYes'); $('#sheetC').textContent = t('restartNo');
};
$('#sheetB').onclick = () => asking ? begin(S.level, S.fails) : won(S) ? begin(S.level + 1, 0) : begin(S.level, S.fails + 1);
$('#sheetC').onclick = keep;
$('#sheet').onclick = e => { if (asking && e.target === $('#sheet')) keep(); };
addEventListener('keydown', e => { if (asking && e.key === 'Escape') keep(); });

/* ---------- moves ---------- */
function shoot() {
  if (!ready() || aim === null) return;
  const pre = new Map(S.grid), col = S.cur, m = fire(S, aim); aim = null;
  if (!m) return;
  save(); hud(); fly = { m, pre, col, i: 0, p: { ...m.pts[0] } };
  if (reduced) land();
}
function land() {
  const { m, pre, col } = fly; fly = null;
  if (!reduced) {
    const at = k => { const p = centre(...rc(k)); return { x: p.x, y: p.y - view * RH }; };   // screen units
    for (const k of m.popped) fx.push({ t: 'pop', ...at(k), col: pre.get(k) ?? col, k: 0 });
    for (const k of m.dropped) fx.push({ t: 'fall', ...at(k), col: pre.get(k), key: k, vx: (hash(k, 1) % 1000 / 1000 - .5) * .1, vy: -hash(k, 2) % 1000 / 1000 * .1, k: 0 });
    if (m.dropped.length >= 6) fx.push({ t: 'txt', s: `-${m.dropped.length}`, ...at(key(...m.cell)), k: 0 });
  }
  logShot(m.dropped.length);
  if (won(S)) { win = { at: performance.now(), done: false }; asking = false; $('#sheet').hidden = true; } else sheet();
  reveal();
}

/* ---------- input ---------- */
const pos = e => { const b = cv.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top - PAD }; };
const setAim = p => { aim = Math.atan2(p.y - SY() * sc, p.x - S.cols * sc); };
// Only the pointer that started the aim moves and fires it; any second pointer cancels the aim.
// A swap-strip touch never takes aimId, so its release never fires.
cv.addEventListener('pointerdown', e => {
  if (e.button !== 0 || !$('#sheet').hidden || e.timeStamp < calmAt || busy()) return;   // left button, touch or pen only
  if (aimId !== null) { aim = aimId = null; return; }
  const p = pos(e);
  // the whole strip at the shooter's height swaps; a touch that starts there never aims or fires
  if (p.y > SY() * sc - Math.max(1.6 * sc, 22)) { if (S.cur !== null) { swap(S); save(); } return; }
  aimId = e.pointerId; cv.setPointerCapture(e.pointerId); setAim(p);
});
cv.addEventListener('pointermove', e => { if (e.pointerId === aimId) setAim(pos(e)); });
cv.addEventListener('pointerup', e => { if (e.pointerId === aimId) { aimId = null; shoot(); } });
cv.addEventListener('pointercancel', e => { if (e.pointerId === aimId) aim = aimId = null; });
let wheelT = 0;   // one swap per wheel gesture; trackpads send many events
addEventListener('wheel', e => { e.preventDefault(); const n = performance.now();
  if (n - wheelT > 150 && !loading && $('#sheet').hidden && S && S.cur !== null && !busy()) { swap(S); save(); } wheelT = n; }, { passive: false });
addEventListener('resize', () => S && fit());
// the header can change height mid-level (score digits, font swap): refit next frame on a height change only
let hudH = 0; new ResizeObserver(([e]) => { if (S && e.contentRect.height !== hudH) { hudH = e.contentRect.height; refit = true; } }).observe($('#hud'));

/* ---------- draw ---------- */
function drawStrip(now) {   // the host, base just above the board, fading in as the strip opens
  if (!strip) return;
  const sh = strip * STRIP * sc, host = hostFor(S.level), p = win ? (now - win.at - QUIET) / GLITCH : -1;
  sg.clearRect(0, 0, W, sh); sg.globalAlpha = strip;
  // the glitch: the host bursts apart sideways in horizontal slices (quick start, slowing down),
  // flickering into the accent colour on the way, and stays in pieces; reduced motion: colour only
  const q = Math.min(1, Math.max(0, p)), go = p >= 0 && !reduced;
  const acc = p >= 1 || p >= 0 && (reduced || Math.sin(now / 1000 * 55) > 1 - 2.5 * q);
  drawHost(sg, host, W / 2, sh - 3, STRIP * sc * .78, acc ? theme.a : colour(host.hue),
    go && p < 1 ? .5 * (1 - q) : 0, now / 1000, go ? 1 - (1 - q) ** 2 : 0);
  sg.globalAlpha = 1;
}
function draw() {
  if (!S) return requestAnimationFrame(draw);   // first level still loading
  const now = performance.now();
  // fit() clears the canvases, so code that runs mid-frame sets refit and fit() runs here, before any drawing
  if (stripAt !== null && strip < 1) { const k = reduced ? 1 : Math.min(1, (now - stripAt) / STRIP_MS); strip = 1 - (1 - k) ** 2; refit = true; }   // ease out
  if (refit) { refit = false; fit(); }
  if (busy() && now - win.at >= QUIET + (reduced ? 0 : GLITCH)) { win.done = true; sheet(); }
  drawStrip(now);
  g.fillStyle = theme.bg; g.fillRect(0, -PAD, W, H + PAD);
  if (!fly) { const tg = target(), d = tg - view; view = reduced || Math.abs(d) < .05 ? tg : view + Math.sign(d) * Math.max(Math.abs(d) * .08, .02); }   // ease, min speed, snap
  for (const [k, col] of fly ? fly.pre : S.grid) { const p = centre(...rc(k)), y = Y(p.y); if (y > -sc && y < H + sc) bubble(X(p.x), y, col); }
  g.fillStyle = theme.a; g.fillRect(0, Y(0) - 3, W, 3);   // ceiling line, on screen only when row 0 is
  // loss line: between the loss row and the row above it; tied to the screen, not S.top, so it
  // stays put while the view eases after a scroll (lossRow(S) - S.top is constant)
  const ly = Y(1 + (view + lossRow(S) - S.top - .5) * RH);
  g.strokeStyle = theme.a; g.globalAlpha = .5; g.lineWidth = 2; g.setLineDash([8, 6]);
  g.beginPath(); g.moveTo(0, ly); g.lineTo(W, ly); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
  const a = clampAim(aim ?? 0);
  if (aimId !== null && a !== null && ready()) {
    const tr = trace(S.grid, S.cols, a, S.top);
    g.strokeStyle = theme.a; g.globalAlpha = .7; g.lineWidth = 2; g.setLineDash([2, 6]);
    g.beginPath(); tr.pts.forEach((p, i) => i ? g.lineTo(X(p.x), Y(p.y)) : g.moveTo(X(p.x), Y(p.y))); g.stroke(); g.setLineDash([]);
    if (tr.cell) { const c = centre(...tr.cell); g.strokeStyle = colour(S.cur); g.beginPath(); g.arc(X(c.x), Y(c.y), sc * .9, 0, 7); g.stroke(); }
    g.globalAlpha = 1;
  }
  if (fly) {   // packet moves about 1.1 radius per frame along the traced path
    const f = fly, pts = f.m.pts; let move = 1.1;
    while (move > 0 && f.i < pts.length - 1) {
      const n = pts[f.i + 1], d = Math.hypot(n.x - f.p.x, n.y - f.p.y);
      if (d <= move) { f.p = { ...n }; f.i++; move -= d; } else { f.p.x += (n.x - f.p.x) / d * move; f.p.y += (n.y - f.p.y) / d * move; move = 0; }
    }
    bubble(X(f.p.x), Y(f.p.y), f.col);
    if (f.i >= pts.length - 1) land();
  }
  if (S.cur !== null && S.grid.size) { const y = SY() * sc; bubble(X(S.cols), y, S.cur); if (S.next !== null) bubble(X(S.cols + 3), y, S.next, .8, sc * .75); }
  fx = fx.filter(a => {
    a.k++;
    const on = a.y * sc > -2 * sc && a.y * sc < H + 2 * sc;   // skip off-canvas effects (shadowBlur is costly)
    if (a.t === 'pop') { if (on) bubble(X(a.x), a.y * sc, a.col, 1 - a.k / 12, sc * (1 + a.k / 12)); return a.k < 12; }
    if (a.t === 'fall') {   // glitch jitter seeded from the bubble key
      a.vy += .025; a.y += a.vy; a.x += a.vx + (a.k % 6 < 1 ? (hash(a.key, a.k) % 1000 / 1000 - .5) : 0);
      if (on) bubble(X(a.x), a.y * sc, a.col, .9); return a.y * sc < H + sc;
    }
    g.fillStyle = theme.a; g.font = `bold ${sc * 1.4}px 'Chakra Petch', ui-monospace, Menlo, monospace`; g.textAlign = 'center';
    g.globalAlpha = Math.max(0, 1 - a.k / 50); g.fillText(a.s, X(a.x), a.y * sc - a.k); g.globalAlpha = 1; return a.k < 50;
  });
  requestAnimationFrame(draw);
}
// No zoom: iOS ignores user-scalable=no, so block Safari's pinch gestures (double-tap is off via touch-action)
for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, e => e.preventDefault());
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});   // offline play
{ const l = load(); Array.isArray(l) ? begin(...l) : start(l); } draw();
