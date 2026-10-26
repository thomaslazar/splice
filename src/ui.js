// Canvas board, DOM HUD and sheets, input, animation, saving. All rules live in core.js.
import { hash, RH, key, rc, centre, lossRow, clampAim, trace, startState, swap, won, lost, fire, toSave, fromSave, validSave } from './core.js';
import { winRows } from './levels.js';
import { themeFor, hostFor, iceFor, ICE } from './hosts.js';
import { runFrom, enter, clampLevel } from './run.js';
import { drawHost } from './hostdraw.js';
import { ICONS } from './icons.js';
import { item, deckFrom, give, take, owned, hits, useItem, unload } from './items.js';

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
$('#turnText').textContent = t('turnPhone');

/* ---------- look ---------- */
const HUES = [330, 185, 95, 42, 270, 5];   // magenta, cyan, acid, amber, violet, red
const cv = $('#board'), g = cv.getContext('2d'), PAD = 4;   // PAD: room for the ceiling line above row 0
const colour = (i, l = 60) => `hsl(${HUES[i]} 100% ${l}%)`;
function sym(i, x, y, s, ctx = g) {
  const g = ctx; g.beginPath();
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
function bubble(x, y, col, a = 1, rr = sc, ctx = g) {   // x, y, rr in px
  const g = ctx;
  const mono = fxOf().mono, c = mono ? '#a9aeb8' : colour(col);   // monochrome ICE: one neutral tone
  g.globalAlpha = Math.max(0, a);
  g.shadowColor = c; g.shadowBlur = rr * .6;
  g.fillStyle = mono ? '#1b1d22' : colour(col, 18); g.beginPath(); g.arc(x, y, rr * .9, 0, 7); g.fill();
  g.shadowBlur = 0; g.lineWidth = Math.max(1.5, rr * .12); g.strokeStyle = c; g.stroke();
  if (mono) g.strokeStyle = '#eef0f4';   // brighter, thicker symbols: they are the only cue left
  g.lineWidth = Math.max(mono ? 1.6 : 1.2, rr * (mono ? .14 : .1)); sym(col, x, y, rr * .7, g);
  g.globalAlpha = 1;
}
const paths = {}, iconPath = id => paths[id] ??= new Path2D(ICONS[id]);
// an item packet: dark round bubble, white ring and glow (Rainbow: a ring of the six hues), the item's icon inside
function itemBubble(x, y, id, a = 1, rr = sc, ctx = g) {
  const g = ctx, k = rr * 1.3 / 24;
  g.globalAlpha = Math.max(0, a); g.lineWidth = Math.max(1.5, rr * .12);
  g.shadowColor = '#fff'; g.shadowBlur = rr * .6; g.fillStyle = '#07080b'; g.beginPath(); g.arc(x, y, rr * .9, 0, 7); g.fill();
  g.shadowBlur = 0; g.strokeStyle = '#fff'; g.stroke();
  if (id === 'rainbow' && !fxOf().mono) HUES.forEach((_, i) => { g.strokeStyle = colour(i); g.beginPath(); g.arc(x, y, rr * .9, i * Math.PI / 3, (i + 1) * Math.PI / 3); g.stroke(); });
  g.save(); g.translate(x - 12 * k, y - 12 * k); g.scale(k, k); g.lineWidth = 1.8; g.lineCap = g.lineJoin = 'round'; g.strokeStyle = '#fff'; g.stroke(iconPath(id)); g.restore();
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
const shut = () => $('#sheet').hidden && $('#menu').hidden && $('#drawer').hidden;
const ready = () => !fly && view === target() && (stripAt === null || strip === 1) && !busy() && shut() && S.cur !== null && S.grid.size > 0;
function save() { try { localStorage.setItem(KEY, JSON.stringify(toSave(S))); } catch (e) {} }
const RUN_KEY = 'splice-run'; let run;   // run: { best, fails }, the best level reached
function saveRun() { try { localStorage.setItem(RUN_KEY, JSON.stringify(run)); } catch (e) {} }
const DECK_KEY = 'splice-deck'; let deck, prev = null;   // deck: { frags, items }; prev: { s: save before the last shot, id: item it fired }
try { deck = deckFrom(JSON.parse(localStorage.getItem(DECK_KEY))); } catch (e) { deck = deckFrom(null); }
function saveDeck() { try { localStorage.setItem(DECK_KEY, JSON.stringify(deck)); } catch (e) {} }
function load() {   // a valid save, or [level, fails] to begin: an invalid save keeps its level, unreadable means level 1
  let o; try { o = JSON.parse(localStorage.getItem(KEY)); if (validSave(o)) return fromSave(o); } catch (e) {}
  return o && Number.isInteger(o.level) && o.level >= 1 ? [o.level, Number.isInteger(o.fails) && o.fails >= 0 ? o.fails : 0] : [1, 0];
}
// startState runs the bot to set the shot limit (up to about a second on big levels), so a level
// begins behind a short loading card; it stays up at least LOAD_MIN so it never just flickers.
const LOAD_MIN = 500; let loading = false;
async function begin(level, fails) {
  const e = enter(run, level, fails); run = e.run; fails = e.fails; saveRun();
  loading = true; aim = aimId = null; fly = win = null; $('#sheet').hidden = true; closeDrawer();   // an old flight or win never reaches its sheet
  setTheme(level); $('#loadT').textContent = t('level', { n: level }); $('#loadM').textContent = t('loading'); $('#load').hidden = false;
  const t0 = performance.now();
  await new Promise(r => requestAnimationFrame(() => setTimeout(r)));   // let the card paint first
  const s = startState(level, fails);
  await new Promise(r => setTimeout(r, Math.max(0, LOAD_MIN - (performance.now() - t0))));
  $('#load').hidden = true; loading = false; start(s);
  if (ice) flash('ice');   // a fresh start only; a reload of a saved board calls start() directly
}
// Running out: 'low' at 25% of the shots or fewer, 'crit' at 3 or fewer (same thresholds as the trace log lines).
const warn = () => won(S) ? '' : S.shots <= 3 ? 'crit' : S.shots <= .25 * S.maxShots ? 'low' : '';
const WARN = { low: '#ffb020', crit: '#ff2a4a' };
function hud() {
  $('#jack').textContent = t('jackedIn'); $('#ice').textContent = ice ? iceName(ice) : ''; $('#host').textContent = hostFor(S.level).label;
  $('#lvl').textContent = t('lvl', { n: S.level }); $('#score').textContent = S.score;
  $('#menuBtn').ariaLabel = t('menu'); $('#deckBtn').textContent = t('deck'); $('#deckBtn').classList.toggle('empty', !owned(deck).length); $('#wip').textContent = t('wip');
  // packets bar: up to 20 segments, each standing for per shots
  const per = Math.ceil(S.maxShots / 20), n = Math.ceil(S.maxShots / per), lit = Math.min(n, Math.ceil(S.shots / per));
  $('#pk').textContent = t('packets'); $('#shots').textContent = S.shots; $('#bar').dataset.warn = warn();
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
  asking = false; $('#sheetC').hidden = $('#sheetP').hidden = true; $('#sheet').hidden = !w && !l; if (!w && !l) return;
  $('#sheetT').textContent = w ? t('winTitle') : t('loseTitle'); $('#sheetB').textContent = w ? t('winButton') : t('loseButton');
}
function setTheme(level) {
  theme = themeFor(level);
  document.documentElement.style.setProperty('--acc', theme.a); document.documentElement.style.setProperty('--bg', theme.bg);
}
/* ---------- run log ---------- */
// Two visible lines, newest on top, in memory only. Once-flags: host, trace rising, trace critical.
let lines = [], seen = {}, logTop = 0, logPct = 0;
// A trace warning also flashes once, big, in the middle of the screen (amber, then red).
let alertT;
function flash(kind) {
  const a = $('#alert'); a.textContent = kind === 'critical' ? t('alertCritical') : kind === 'restored' ? t('alertRestored', { n: restore }) : kind === 'note' ? t('linkCopied') : kind === 'breaker' ? t('alertBreaker') : kind === 'ice' ? t('alertIce', { ice: iceName(ice) }) : t('alertTrace'); a.dataset.kind = kind;
  a.hidden = true; void a.offsetWidth; a.hidden = false;   // restart the animation
  clearTimeout(alertT); alertT = setTimeout(() => { a.hidden = true; }, 1400);
}
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
  if (ice) log(t('logIce', { ice: iceName(ice) }));
}
function logShot(dropped) {   // events in the spec's order, after a landed shot
  if (dropped >= 6) log(t('logBreach', { n: dropped }));
  if (iceOn() === 'jam' && dropped >= JAM_DROP && !won(S) && !lost(S)) { restore = 3; log(t('logRestored', { n: restore })); flash('restored'); }
  const p = pct(); if (S.top !== logTop && p !== logPct) log(t('logDeeper', { pct: p })); logTop = S.top; logPct = p;
  const f = flagged(); if (won(S)) f.rising = f.critical = false;   // no trace warning on the winning shot
  for (const [n, text] of [['host', t('logHost')], ['rising', t('logTrace')], ['critical', t('logCritical')]]) if (f[n] && !seen[n]) {
    seen[n] = true; log(text); if (n !== 'host') flash(n); }
  if (lost(S)) log(t('logLost')); else if (won(S)) log(t('logRoot', { host: hostFor(S.level).owner }));
}
/* ---------- ICE ---------- */
// One type per level (iceFor). Its effects all live in FX: draw() asks fxOf() for the active one.
// aim(pts) returns the part of the traced path to draw (null: none); the target ring shows only
// with the whole path. hide(slot) ('cur' or 'next') draws that queue packet as a glitchy "?";
// swapped() runs after a swap; locked ignores swaps and marks the next packet. ang(a) bends the
// aim angle: the line drawn and the shot both use the bent angle, so the line never lies and
// the challenge is timing the release; over() draws on top of the board; mono draws bubbles in
// one neutral tone. Firing, landing and dealing are the same as without ICE.
// Local playtest: ?ice=<type> forces that ICE on every level (effects only; the shot limit keeps
// the level's own), ?level=N starts level N fresh. Not linked anywhere in the game.
const PLAY = Object.fromEntries(new URLSearchParams(location.search));
let ice = null, restore = 0;   // jam: full aim line for the next `restore` shots; a reload starts jammed
// scrambler: each new packet arrives hidden with chance SCRAMBLE (seeded from the draw count);
// a hidden packet stays "?" in the next slot and at the shooter and shows only in flight.
// hid = [cur, next]; a swap swaps them; a reload shows the shooter packet.
const SCRAMBLE = .4; let hid = [false, false], clearHid = 0;   // clearHid: the next n new packets arrive unhidden (after Decrypt)
const scrambled = () => hash(S.level, S.fails, S.draws, 77) % 100 < SCRAMBLE * 100;
const ITEM_NAMES = { bomb: () => t('item_bomb'), sweep: () => t('item_sweep'), pierce: () => t('item_pierce'), wildcard: () => t('item_wildcard'),
  overclock: () => t('item_overclock'), decrypt: () => t('item_decrypt'), icebreaker: () => t('item_icebreaker'), star: () => t('item_star'),
  lightning: () => t('item_lightning'), virus: () => t('item_virus'), purge: () => t('item_purge'), rainbow: () => t('item_rainbow'), rollback: () => t('item_rollback') };
const iceName = i => ({ static: t('iceStatic'), jitter: t('iceJitter'), scrambler: t('iceScrambler'), lock: t('iceLock'),
  jam: t('iceJam'), monochrome: t('iceMonochrome'), black: t('iceBlack') })[i];
const cut = pts => pts.slice(0, 2);   // to the first wall bounce, or the end if none
// jam: the first bounce or JAM_LEN radii (about four bubbles), whichever is shorter, so a jam also
// bites on levels that need no bounces
const JAM_LEN = 8, short = pts => { const [a, b] = cut(pts), d = Math.hypot(b.x - a.x, b.y - a.y);
  return d <= JAM_LEN ? [a, b] : [a, { x: a.x + (b.x - a.x) * JAM_LEN / d, y: a.y + (b.y - a.y) * JAM_LEN / d }]; };
const JAM_DROP = 10, JAMMED = '#8a93a6';   // jam: a drop of JAM_DROP or more restores the line; the jammed line's colour
const FX = {
  jam: { aim: pts => restore > 0 ? pts : short(pts) },
  // a few degrees, smooth: two slow sines; reduced motion: steady, cut at the first bounce instead
  jitter: reduced ? { aim: cut } : { ang: a => { const s = performance.now() / 1000; return a + .06 * Math.sin(s * 2.3) + .03 * Math.sin(s * 5.1 + 1); } },
  static: { over: glitchBlocks },
  monochrome: { mono: true },
  black: { aim: () => null },
  scrambler: { hide: slot => hid[slot === 'cur' ? 0 : 1], swapped: () => { hid = [hid[1], hid[0]]; } },
  lock: { locked: true },
};
function trySwap() { const f = fxOf(); if (f.locked || S.load) return; swap(S); f.swapped?.(); save(); }
function packet(x, y, col, slot, a = 1, rr = sc) {   // a queue packet, through the ICE hooks
  const f = fxOf();
  if (f.hide?.(slot)) {   // no colour, no symbol: a grey ring and a "?" that glitches sideways (static with reduced motion)
    const tk = Math.floor(performance.now() / 70), j = reduced || hash(tk, 7) % 5 ? 0 : (hash(tk, 8) % 1000 / 1000 - .5) * rr * .5;
    g.globalAlpha = a; g.lineWidth = Math.max(1.5, rr * .12); g.strokeStyle = '#8a8f98'; g.fillStyle = '#14161a';
    g.beginPath(); g.arc(x, y, rr * .9, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#c8ccd4'; g.font = `600 ${rr * 1.1}px 'Chakra Petch', ui-monospace, Menlo, monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('?', x + j, y + rr * .05); g.textBaseline = 'alphabetic'; g.globalAlpha = 1;
  } else bubble(x, y, col, a, rr);
  if (f.locked && slot === 'next') {   // small padlock at the top right
    const s = rr * .5, lx = x + rr * .85, ly = y - rr * .7;
    g.globalAlpha = a; g.strokeStyle = g.fillStyle = theme.a; g.lineWidth = Math.max(1.2, s * .3);
    g.beginPath(); g.arc(lx, ly - s * .35, s * .5, Math.PI, 0); g.stroke();
    g.fillRect(lx - s * .8, ly - s * .35, s * 1.6, s * 1.2); g.globalAlpha = 1;
  }
}
const iceOn = () => S.breaker > 0 ? null : ice;   // the ICE in effect: none while the ICE breaker runs
const fxOf = () => FX[iceOn()] || {};
// static: 3 blocks of about 2 x 2 bubbles drift over the board above the loss line (never the
// shooter zone), each on its own seeded slow Lissajous path; reduced motion: fixed. Purely drawn.
function glitchBlocks(now, bottom) {
  const s = reduced ? 0 : now / 1000, b = 4 * sc, tk = Math.floor(now / 90), u = (i, n) => hash(S.level, i, n) % 1000 / 1000;
  for (let i = 0; i < 3; i++) {
    const x = (W - b) * (.5 + .5 * Math.sin(s * (.15 + .1 * u(i, 1)) + 6.3 * u(i, 2)));
    const y = Math.max(0, bottom - b) * (.5 + .5 * Math.sin(s * (.11 + .08 * u(i, 3)) + 6.3 * u(i, 4)));
    for (let r = 0; r < 8; r++) {   // horizontal bands of grey noise, re-rolled every tick (not with reduced motion)
      const h = hash(S.level, i, r, reduced ? 0 : tk), o = (h % 7 - 3) * b * .03;
      g.fillStyle = `hsl(0 0% ${6 + h % 22}%)`; g.fillRect(x + o, y + r * b / 8, b, b / 8 + .5);
    }
    g.strokeStyle = theme.a; g.globalAlpha = .35; g.lineWidth = 1; g.strokeRect(x, y, b, b); g.globalAlpha = 1;
  }
}
function start(s) {
  S = s; ice = PLAY.ice in ICE ? PLAY.ice : iceFor(S.level); restore = clearHid = 0; prev = null; hid = [false, iceOn() === 'scrambler' && scrambled()]; logStart(); view = target(); fly = null; fx = []; aim = aimId = null; asking = false;
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
function ask(kind) {   // the restart and start-over questions share the sheet
  asking = kind; aim = aimId = null; $('#sheet').hidden = $('#sheetC').hidden = false; $('#sheetP').hidden = kind !== 'over';
  const o = kind === 'over';
  $('#sheetT').textContent = o ? t('overAsk') : t('restartAsk'); $('#sheetP').textContent = o ? t('overText') : '';
  $('#sheetB').textContent = o ? t('overYes') : t('restartYes'); $('#sheetC').textContent = o ? t('cancel') : t('keepPlaying');
}
$('#sheetB').onclick = () => asking === 'over' ? begin(1, 0) : asking ? begin(S.level, S.fails) : won(S) ? begin(S.level + 1, 0) : begin(S.level, S.fails + 1);
$('#sheetC').onclick = keep;
$('#sheet').onclick = e => { if (asking && e.target === $('#sheet')) keep(); };
/* ---------- menu ---------- */
const picked = () => clampLevel($('#lvlIn').value, run.best, S.level);
function menuText() {   // every panel text; Info adds its own here
  const tb = $('#tabs').children; tb[0].textContent = t('tabRun'); tb[1].textContent = t('tabShop'); tb[2].textContent = t('tabInfo');
  $('#curL').textContent = t('curLevel'); $('#curN').textContent = S.level; $('#bestL').textContent = t('bestLevel'); $('#bestN').textContent = run.best;
  $('#mRestart').textContent = t('restartLevel'); $('#mBack').textContent = t('backTo', { n: run.best }); $('#mBack').hidden = S.level >= run.best;
  $('#mOver').textContent = t('startOver'); $('#pickL').textContent = t('pickLevel'); $('#lvlDn').textContent = '\u2212'; $('#lvlUp').textContent = '+';
  $('#lvlDn').ariaLabel = t('levelDown'); $('#lvlUp').ariaLabel = t('levelUp'); $('#mKeep').textContent = t('keepPlaying'); pick();
  $('#iName').textContent = t('appName'); $('#iText').textContent = t('infoText'); $('#iHow').textContent = t('howTo'); $('#iShare').textContent = t('share');
  $('#iSrc').textContent = t('sourceCode'); $('#iLic').textContent = t('license'); $('#iCred').textContent = t('credits'); $('#iLang').textContent = t('language');
}
function pick() { const n = picked(); $('#pickHost').textContent = hostFor(n).label; $('#mPlay').textContent = t('playLevel', { n }); }
function tab(name) {
  if (name === 'shop') return;
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.tab === name);
  for (const s of document.querySelectorAll('#menu section')) s.hidden = s.dataset.tab !== name;
}
async function share() {   // the phone's share sheet, else copy the link; anything else shows it to copy by hand
  const url = location.origin + location.pathname, u = $('#iUrl'); u.hidden = true;
  try {
    if (navigator.share) return await navigator.share({ title: t('appName'), text: t('shareText'), url });
    await navigator.clipboard.writeText(url); flash('note');
  } catch (e) { if (e.name !== 'AbortError') { u.textContent = url; u.hidden = false; } }
}
$('#iShare').onclick = share;
for (const [code, name] of Object.entries(LANGS)) $('#iSel').add(new Option(name, code));
$('#iSel').onchange = async () => {
  const code = $('#iSel').value; try { localStorage.setItem(LANG_KEY, code); } catch (e) {}
  await setLang(code); hud(); menuText(); $('#turnText').textContent = t('turnPhone');
};
function openMenu() { $('#lvlIn').value = S.level; menuText(); $('#iSel').value = document.documentElement.lang; $('#iUrl').hidden = true; tab('run'); $('#menu').hidden = false; }
function closeMenu() { $('#menu').hidden = true; calm(); }
$('#menuBtn').onclick = () => { if (!shut() || loading || busy() || fly) return; aim = aimId = null; openMenu(); };
$('#mKeep').onclick = closeMenu;
$('#mRestart').onclick = () => { closeMenu(); ask('restart'); };
$('#mBack').onclick = () => { closeMenu(); begin(run.best, 0); };
$('#mOver').onclick = () => { closeMenu(); ask('over'); };
$('#mPlay').onclick = () => { const n = picked(); closeMenu(); begin(n, 0); };
for (const b of document.querySelectorAll('#tabs button')) b.onclick = () => tab(b.dataset.tab);
const step = d => { $('#lvlIn').value = Math.min(run.best, Math.max(1, picked() + d)); pick(); };
$('#lvlDn').onclick = () => step(-1); $('#lvlUp').onclick = () => step(1);
$('#lvlIn').oninput = pick;
$('#lvlIn').onchange = () => { $('#lvlIn').value = picked(); pick(); };
$('#lvlIn').onkeydown = e => { if (e.key === 'Enter') { $('#lvlIn').blur(); $('#mPlay').click(); } };
addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (!$('#menu').hidden) closeMenu(); else if (!$('#drawer').hidden) closeDrawer(); else if (asking) keep(); });

/* ---------- deck ---------- */
// The Deck button opens a drawer of owned items. A shot item loads and flies in place of the packet (no shot
// spent, the packets stay); instants apply at once; Decrypt asks for a colour; Rollback undoes the last shot.
let picking = false;
const svg = id => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[id]}"/></svg>`;
function drawer() {
  const d = $('#drawer'); d.textContent = '';
  if (picking) {   // Decrypt: one packet per colour on the board
    const h = document.createElement('small'); h.textContent = t('pickColour'); d.append(h);
    for (const col of [...new Set(S.grid.values())].sort()) {
      const b = document.createElement('button'), c = document.createElement('canvas'); c.width = c.height = 36; bubble(18, 18, col, 1, 15, c.getContext('2d'));
      b.append(c); b.onclick = () => decrypt(col); d.append(b);
    }
    return;
  }
  for (const [id, n] of owned(deck)) {
    const b = document.createElement('button'), nm = document.createElement('span'), c = document.createElement('b');
    b.innerHTML = svg(id); nm.textContent = ITEM_NAMES[id](); c.textContent = `\u00d7${n}`; b.append(nm, c);
    b.disabled = id === 'rollback' ? !prev : item(id).kind === 'shot' && !!S.load;   // one loaded at a time
    b.onclick = () => use(id); d.append(b);
  }
}
function closeDrawer() { if ($('#drawer').hidden) return; $('#drawer').hidden = true; picking = false; calm(); }
$('#deckBtn').onclick = () => {
  if (!$('#drawer').hidden) return closeDrawer();
  if (!shut() || loading || busy() || fly || !owned(deck).length) return;
  aim = aimId = null; picking = false; drawer(); $('#drawer').hidden = false;
};
function use(id) {
  if (id === 'rollback') return rollback();
  if (id === 'decrypt') { picking = true; return drawer(); }
  const d = take(deck, id); if (!d || !useItem(S, id)) return;
  deck = d; prev = null; saveDeck(); save(); hud(); closeDrawer();
  if (id === 'icebreaker') { log(t('logBreaker')); flash('breaker'); } else if (item(id).kind === 'shot') log(t('logLoaded', { item: ITEM_NAMES[id]() }));
}
function decrypt(col) {
  const d = take(deck, 'decrypt'); if (!d || !useItem(S, 'decrypt', col)) return;
  deck = d; prev = null; if (iceOn() === 'scrambler') { hid[0] = false; clearHid = 3; }   // the next 3 new packets arrive unhidden
  saveDeck(); save(); hud(); closeDrawer();
}
function unloadItem() { const id = S.load; unload(S); deck = give(deck, id); saveDeck(); save(); hud(); }
function rollback() {
  const d = take(deck, 'rollback'); if (!d || !prev) return;
  S = fromSave(prev.s); S.load = null; deck = prev.id ? give(d, prev.id) : d; restore = prev.restore; prev = null;   // the fired item goes back to the deck
  hid = [false, iceOn() === 'scrambler' && scrambled()]; fx = []; asking = false; win = won(S) ? { at: -Infinity, done: true } : null; logTop = S.top; logPct = pct();
  if (S.top) { stripAt = null; strip = 0; }   // the ceiling may be out of view again
  refit = true; saveDeck(); save(); hud(); log(t('logRollback')); closeDrawer();
}

/* ---------- moves ---------- */
function shoot() {
  if (!ready() || aim === null) return;
  const pre = new Map(S.grid), col = S.cur, it = S.load, snap = toSave(S), rs = restore, m = fire(S, shotAngle()); aim = null; drawn = null;
  if (!m) return;
  prev = { s: snap, id: it, restore: rs };
  if (!it) hid = [hid[1], iceOn() === 'scrambler' && (clearHid > 0 ? (clearHid--, false) : scrambled())];   // the next one moves up as it was; a new one arrives (an item leaves the queue alone)
  if (iceOn() === 'jam' && restore > 0 && --restore === 0) log(t('logJammed'));
  if (S.breaker > 0 && --S.breaker === 0 && ice) { log(t('logIceBack', { ice: iceName(ice) })); flash('ice'); }
  save(); hud(); fly = { m, pre, col, it, i: 0, p: { ...m.pts[0] } };
  if (reduced) land();
}
function land() {
  const { m, pre, col } = fly; fly = null;
  if (!reduced) {
    const at = k => { const p = centre(...rc(k)); return { x: p.x, y: p.y - view * RH }; };   // screen units
    for (const k of m.popped) fx.push({ t: 'pop', ...at(k), col: pre.get(k) ?? col, k: 0 });
    for (const k of m.dropped) fx.push({ t: 'fall', ...at(k), col: pre.get(k), key: k, vx: (hash(k, 1) % 1000 / 1000 - .5) * .1, vy: -hash(k, 2) % 1000 / 1000 * .1, k: 0 });
    if (m.dropped.length >= 6) fx.push({ t: 'txt', s: `-${m.dropped.length}`, ...at(m.cell ? key(...m.cell) : m.dropped[0]), k: 0 });
  }
  logShot(m.dropped.length);
  if (won(S)) { win = { at: performance.now(), done: false }; asking = false; $('#sheet').hidden = true; } else sheet();
  reveal();
}

/* ---------- input ---------- */
const pos = e => { const b = cv.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top - PAD }; };
// the angle the shot takes: the aim, bent by jitter ICE exactly as the drawn line is
let drawn = null;   // the bent angle on screen this frame; the shot takes exactly that one
const bend = () => { const f = fxOf(), a = clampAim(aim ?? 0); return a === null || !f.ang ? aim : clampAim(Math.min(-.001, f.ang(a))); };
const shotAngle = () => fxOf().ang && drawn !== null ? drawn : bend();
const setAim = p => { aim = Math.atan2(p.y - SY() * sc, p.x - S.cols * sc); };
// Only the pointer that started the aim moves and fires it; any second pointer cancels the aim.
// A swap-strip touch never takes aimId, so its release never fires.
cv.addEventListener('pointerdown', e => {
  if (e.button !== 0 || e.timeStamp < calmAt || busy()) return;   // left button, touch or pen only
  if (!$('#drawer').hidden) return closeDrawer();   // a tap outside the drawer closes it
  if (!shut()) return;
  if (aimId !== null) { aim = aimId = null; return; }
  const p = pos(e);
  // the whole strip at the shooter's height swaps (or unloads a loaded item); a touch that starts there never aims or fires
  if (p.y > SY() * sc - Math.max(1.6 * sc, 22)) { if (S.load) unloadItem(); else if (S.cur !== null) trySwap(); return; }
  aimId = e.pointerId; cv.setPointerCapture(e.pointerId); setAim(p);
});
cv.addEventListener('pointermove', e => { if (e.pointerId === aimId) setAim(pos(e)); });
cv.addEventListener('pointerup', e => { if (e.pointerId === aimId) { aimId = null; shoot(); } });
cv.addEventListener('pointercancel', e => { if (e.pointerId === aimId) aim = aimId = null; });
let wheelT = 0;   // one swap per wheel gesture; trackpads send many events
addEventListener('wheel', e => { e.preventDefault(); const n = performance.now();
  if (n - wheelT > 150 && !loading && shut() && S && S.cur !== null && !busy()) trySwap(); wheelT = n; }, { passive: false });
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
  const w = warn();   // the loss line turns amber, then pulses red, as shots run out
  g.strokeStyle = WARN[w] || theme.a; g.globalAlpha = w === 'crit' && !reduced ? .45 + .4 * Math.sin(performance.now() / 160) : .5;
  g.lineWidth = 2; g.setLineDash([8, 6]);
  g.beginPath(); g.moveTo(0, ly); g.lineTo(W, ly); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
  fxOf().over?.(now, ly - 2);
  const f0 = fxOf(), a0 = clampAim(aim ?? 0), a = a0 === null || !f0.ang ? a0 : (drawn = bend());   // shoot() fires exactly this angle
  if (aimId !== null && a !== null && ready()) {
    const L = S.load, h = L && hits(S, L, a), tr = L ? h || { pts: trace(S.grid, S.cols, a, S.top).pts, cell: null } : trace(S.grid, S.cols, a, S.top), pts = fxOf().aim ? fxOf().aim(tr.pts) : tr.pts;
    // a jammed line (jam ICE, not restored) is steel grey, broken and flickering; restored it is the accent again
    const jammed = iceOn() === 'jam' && restore === 0, n = performance.now();
    g.strokeStyle = jammed ? JAMMED : theme.a; g.lineWidth = 2;
    if (jammed && !reduced) { const f = hash(n / 70 | 0, 9) % 100 / 100; g.globalAlpha = f < .15 ? .2 : .5 + .45 * f; g.setLineDash([3, 4 + f * 6]); g.lineDashOffset = -n / 40; }
    else { g.globalAlpha = .7; g.setLineDash([2, 6]); }
    g.beginPath(); (pts || []).forEach((p, i) => i ? g.lineTo(X(p.x), Y(p.y)) : g.moveTo(X(p.x), Y(p.y))); g.stroke(); g.setLineDash([]); g.lineDashOffset = 0;
    // the ring is accurate under jitter too (the shot takes the drawn angle); neutral when the packet is hidden
    if (pts?.length === tr.pts.length && !jammed) {
      const ring = (k, dash) => { const c = centre(...rc(k)); g.setLineDash(dash); g.beginPath(); g.arc(X(c.x), Y(c.y), sc * .9, 0, 7); g.stroke(); };
      if (h) {   // item preview: white rings on what it clears, dashed on what it recolours
        g.strokeStyle = '#fff'; g.lineWidth = Math.max(1.5, sc * .12);
        for (const k of h.clear) ring(k, []);
        for (const k of h.recolour.keys()) ring(k, [4, 3]);
      }
      if (tr.cell) {
        const c = centre(...tr.cell); g.setLineDash([]);
        if (L === 'rainbow' && !f0.mono) { const gr = g.createLinearGradient(X(c.x) - sc, 0, X(c.x) + sc, 0); HUES.forEach((_, i) => gr.addColorStop(i / 5, colour(i))); g.strokeStyle = gr; }
        else g.strokeStyle = L ? '#fff' : f0.mono || f0.hide?.('cur') ? '#a9aeb8' : colour(S.cur);
        ring(key(...tr.cell), []);
      }
      g.setLineDash([]);
    }
    g.globalAlpha = 1;
  }
  if (fly) {   // packet moves about 1.1 radius per frame along the traced path
    const f = fly, pts = f.m.pts; let move = 1.1;
    while (move > 0 && f.i < pts.length - 1) {
      const n = pts[f.i + 1], d = Math.hypot(n.x - f.p.x, n.y - f.p.y);
      if (d <= move) { f.p = { ...n }; f.i++; move -= d; } else { f.p.x += (n.x - f.p.x) / d * move; f.p.y += (n.y - f.p.y) / d * move; move = 0; }
    }
    if (f.it) itemBubble(X(f.p.x), Y(f.p.y), f.it); else bubble(X(f.p.x), Y(f.p.y), f.col);
    if (f.i >= pts.length - 1) land();
  }
  if (S.cur !== null && S.grid.size) {
    const y = SY() * sc;
    if (S.load) { itemBubble(X(S.cols), y, S.load); packet(X(S.cols + 3), y, S.cur, 'cur', .8, sc * .75); if (S.next !== null) packet(X(S.cols + 4.8), y, S.next, 'next', .6, sc * .55); }   // the packets queue behind it
    else { packet(X(S.cols), y, S.cur, 'cur'); if (S.next !== null) packet(X(S.cols + 3), y, S.next, 'next', .8, sc * .75); }
  }
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
// iOS can still zoom on a quick double tap despite touch-action: cancel the second touchend of a
// double tap (buttons keep their clicks; the board uses pointer events, which still arrive)
let lastTap = 0;
document.addEventListener('touchend', e => { if (e.timeStamp - lastTap < 350 && !e.target.closest('button')) e.preventDefault(); lastTap = e.timeStamp; }, { passive: false });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});   // offline play
{ const n = +PLAY.level, l = Number.isInteger(n) && n >= 1 ? [n, 0] : load(), [lv, fl] = Array.isArray(l) ? l : [l.level, l.fails];
  let o; try { o = JSON.parse(localStorage.getItem(RUN_KEY)); } catch (e) {}
  run = runFrom(o, lv, fl); saveRun(); Array.isArray(l) ? begin(...l) : start(l); } draw();
