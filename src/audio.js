// Plays a song from music.js with Web Audio. Every sound is synthesised here: no audio files.
// Browsers only start audio from a user gesture, so nothing plays until unlock() runs in one.
// The scheduler looks ahead (LOOK seconds, every TICK ms) and places notes on the audio clock.
import { mulberry32 } from './core.js';
import { STEPS, BARS } from './music.js';

const LOOK = .12, TICK = 25, VOL = .7;
let ctx = null, on = true, hidden = false, song = null, want = null, wantAt = 0, state = 'idle', step = 0, at = 0, timer = 0, mood = 0;
let N = {};   // the node graph, built once
const hz = m => 440 * 2 ** ((m - 69) / 12), rnd = mulberry32(0x5911ce);   // seeded, like everything in src/
let toneV = 18000;   // where the section filter is headed: ramps chain from it (repeated setTargetAtTime can run away)
function toneTo(t, v, sec) { const p = N.tone.frequency; p.cancelScheduledValues(t); p.setValueAtTime(toneV, t); p.linearRampToValueAtTime(v, t + sec); toneV = v; }
const cutHz = c => 160 * 2 ** (Math.max(0, Math.min(1, c)) * 6.6);

/* ---------- graph ---------- */
function build() {
  const nav = globalThis.navigator;
  if (nav?.audioSession) try { nav.audioSession.type = 'ambient'; } catch (e) {}   // iOS: respect the silent switch, mix with other audio
  ctx = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
  const g = (v = 1) => { const n = ctx.createGain(); n.gain.value = v; return n; };
  const f = (type, freq, Q = .7) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = freq; n.Q.value = Q; return n; };
  N.master = g(0); N.comp = ctx.createDynamicsCompressor(); N.comp.threshold.value = -14; N.comp.ratio.value = 4;
  N.master.connect(N.comp).connect(ctx.destination);
  N.tone = f('lowpass', 18000, .5); N.tone.connect(N.master);   // the synths' section filter, moods and stings (drums bypass it)
  N.drums = g(.9); N.drums.connect(N.master);
  N.duck = g(1); N.duck.connect(N.tone);   // the synths, ducked on every kick
  N.bass = g(.55); N.bass.connect(N.duck);
  N.crush = ctx.createWaveShaper(); N.arpF = f('lowpass', 6000); N.arp = g(.3);
  N.crush.connect(N.arpF).connect(N.arp).connect(N.duck);
  N.delay = ctx.createDelay(2); N.fb = g(0); N.dret = g(.3); N.arp.connect(N.delay); N.delay.connect(N.fb).connect(N.delay); N.delay.connect(N.dret).connect(N.tone);
  N.padF = f('lowpass', 900, 1.2); N.pad = g(.16); N.padF.connect(N.pad).connect(N.duck);
  N.lfo = ctx.createOscillator(); N.lfoG = g(260); N.lfo.frequency.value = .07; N.lfo.connect(N.lfoG).connect(N.padF.frequency); N.lfo.start();
  N.wob = ctx.createOscillator(); N.wobG = g(0); N.wob.frequency.value = 5.3; N.wob.connect(N.wobG); N.wob.start();
  N.verb = ctx.createConvolver(); N.vret = g(.3); N.verb.buffer = impulse(2.4); N.verb.connect(N.vret).connect(N.tone);
  N.pad.connect(N.verb);
  N.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = N.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
  ctx.onstatechange = () => { if (ctx.state === 'running') at = Math.max(at, ctx.currentTime + .05); };
}
function impulse(sec) {   // a decaying stereo noise tail for the reverb
  const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (rnd() * 2 - 1) * (1 - i / n) ** 3; }
  return b;
}
function crushCurve(bits) {
  const c = new Float32Array(1024), q = 2 ** (bits - 1);
  for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; c[i] = bits ? Math.round(x * q) / q : x; }
  return c;
}

/* ---------- voices ---------- */
function env(t, peak, a, d, curve = 'exp') {
  const n = ctx.createGain(), p = n.gain; p.setValueAtTime(0, t); p.linearRampToValueAtTime(peak, t + a);
  if (curve === 'exp') p.exponentialRampToValueAtTime(.0001, t + a + d); else p.linearRampToValueAtTime(0, t + a + d);
  return n;
}
function osc(type, freq, t, end, out, detune = 0) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detune;
  o.connect(out); o.start(t); o.stop(end); return o;
}
function noise(t, len, out) {
  const s = ctx.createBufferSource(); s.buffer = N.noise; s.connect(out); s.start(t, rnd() * .8, len); return s;
}
function kick(t, v) {
  const e = env(t, v, .002, .42); e.connect(N.drums);
  const o = osc('sine', 150, t, t + .45, e); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(44, t + .09);
  const c = env(t, v * .35, .001, .012), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
  noise(t, .02, hp); hp.connect(c).connect(N.drums);
  if (v > .6) { const d = N.duck.gain; d.cancelScheduledValues(t); d.setValueAtTime(.3, t); d.linearRampToValueAtTime(1, t + .2); }
}
function hat(t, v, len = .035) {
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7800;
  const e = env(t, v * .55, .001, len); noise(t, len + .02, hp); hp.connect(e).connect(N.drums);
}
function clap(t, v) {
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = .9;
  const e = ctx.createGain(), p = e.gain; p.setValueAtTime(0, t);
  for (const k of [0, .011, .022]) { p.setValueAtTime(v * 1.1, t + k); p.exponentialRampToValueAtTime(.05, t + k + .009); }
  p.setValueAtTime(v * .8, t + .033); p.exponentialRampToValueAtTime(.0001, t + .22);
  noise(t, .25, bp); bp.connect(e); e.connect(N.drums); e.connect(N.verb);
}
function bass(t, m, len) {
  const S = song.mix, f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = S.res;
  const lo = cutHz(S.bassCut - S.dark + mood * .06); f.frequency.setValueAtTime(lo * 4.5, t); f.frequency.exponentialRampToValueAtTime(lo, t + .14);
  const e = env(t, .5, .004, len); f.connect(e).connect(N.bass);
  osc('sawtooth', hz(m), t, t + len + .02, f); osc('sine', hz(m - 12), t, t + len + .02, e);
}
function arp(t, m, v) {
  const e = env(t, v * .5, .003, .2); e.connect(N.crush);
  const o = osc(song.mix.arpWave, hz(m), t, t + .25, e); if (song.mix.wobble) N.wobG.connect(o.detune);
}
function pad(t, ms, len) {
  for (const m of ms) for (const dt of [-8, 8]) {
    const e = ctx.createGain(), p = e.gain; p.setValueAtTime(0, t); p.linearRampToValueAtTime(.16, t + .5); p.setValueAtTime(.16, t + len); p.linearRampToValueAtTime(0, t + len + .8);
    e.connect(N.padF); const o = osc('sawtooth', hz(m), t, t + len + .85, e, dt); if (song.mix.wobble) N.wobG.connect(o.detune);
  }
}
function blip(t, v) {   // a short falling glitch tone
  const e = env(t, v * .2, .001, .05); e.connect(N.drums);
  const o = osc('square', 2400 + rnd() * 2400, t, t + .07, e); o.frequency.exponentialRampToValueAtTime(300, t + .05);
}
function grit(t) {   // static ICE: a burst of band-limited noise
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 800 + rnd() * 4000; bp.Q.value = 3;
  const e = env(t, .18, .002, .05 + rnd() * .1, 'lin'); noise(t, .2, bp); bp.connect(e).connect(N.drums);
}
function alarm(t, m) {
  const e = env(t, .06, .005, .1, 'lin'); e.connect(N.duck); osc('square', hz(m), t, t + .12, e);
}

/* ---------- scheduler ---------- */
const sectionAt = bar => { const n = Math.floor(bar / BARS), S = song.sections; return S[n < S.length ? n : song.loop + (n - S.length) % (S.length - song.loop)]; };
function play(t) {
  const sp = 60 / song.bpm / 4, s = step % STEPS, bar = Math.floor(step / STEPS), inBar = bar % BARS, X = sectionAt(bar);
  const chord = song.chords[bar % song.chords.length], fill = X.fill && inBar === BARS - 1 && s >= 12;
  if (state === 'win') return winStep(t, sp);
  if (s === 0) {
    const c = Array.isArray(X.cut) ? X.cut[0] + (X.cut[1] - X.cut[0]) * inBar / (BARS - 1) : X.cut;
    const v = cutHz(c - song.mix.dark + mood * .1); if (Math.abs(v - toneV) > 1) toneTo(t, v, Array.isArray(X.cut) ? STEPS * sp : .4);
    if (X.pad) pad(t, chord.slice(0, song.mix.padTones).map(m => m + 24), STEPS * sp);
  }
  if (X.kick && song.kick[s] && !fill) kick(t, song.kick[s]);
  if (fill && s % 2 === 0) clap(t, .5 + (s - 12) * .1);
  if (X.hat && (song.hat[s] || mood && s % 2 || mood > 1)) hat(t, song.hat[s] || .4);
  if (X.open && song.open[s]) hat(t, .7, .16);
  if (X.clap && song.clap[s]) clap(t, song.clap[s]);
  if (X.bass && song.bass[s] !== null) bass(t, chord[0] + song.bass[s], sp * .8);
  if (X.arp && song.gate[s]) { const A = song.arps[(X.arp - 1 + (song.ice === 'scrambler' ? bar : 0)) % song.arps.length];
    arp(t, chord[A[s] % chord.length] + 24 + (X.arp > 1 && s % 8 === 7 ? 12 : 0), s % 4 === 0 ? 1 : .7); }
  if ((X.perc || mood) && song.perc[s] && !(bar % 2 && s > 8)) blip(t, 1);
  if (song.mix.noise && X.kick && rnd() < .06) grit(t);
  if (mood > 1 && s % 4 === 0) alarm(t, chord[0] + 36 + (s % 8 ? 1 : 0));
}
let won = 0;
function winStep(t, sp) {   // a rising run over the chord, then the pad holds and everything fades
  const i = step - won, chord = song.chords[0];
  if (i < 16) arp(t, chord[i % chord.length] + 24 + 12 * Math.floor(i / chord.length), 1);
  if (i === 0) { pad(t, chord.slice(0, 3).map(m => m + 24), 3); toneTo(t, 14000, .6); }
  if (i === 16) fade(t, 2.4);
}
function fade(t, sec) {   // stop placing notes; a waiting song starts once the fade is over
  const g = N.master.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + sec);
  song = null; state = 'idle'; wantAt = t + sec;
}
function pump() {
  if (!ctx || ctx.state !== 'running') return;
  if (!song && want && ctx.currentTime >= wantAt) start();
  while (song && at < ctx.currentTime + LOOK) { const sp = 60 / song.bpm / 4; play(at); at += sp; step++; }
}
function start() {
  song = want; want = null; state = 'play'; step = 0; at = ctx.currentTime + .06;
  N.crush.curve = crushCurve(song.mix.crush); N.fb.gain.value = song.mix.delay; N.delay.delayTime.value = song.mix.delaySteps * 60 / song.bpm / 4;
  N.wobG.gain.value = song.mix.wobble; N.arpF.frequency.value = song.mix.arpWave === 'square' ? 3800 : 5200;
  const g = N.master.gain; g.cancelScheduledValues(at); g.setValueAtTime(0, at); g.linearRampToValueAtTime(on ? VOL : 0, at + 1.5);
}
function wake() {
  if (!ctx) return;
  const run = on && !hidden;
  if (run && ctx.state !== 'running') ctx.resume(); else if (!run && ctx.state === 'running') ctx.suspend();
  clearInterval(timer); timer = run ? setInterval(pump, TICK) : 0;
}

/* ---------- api ---------- */
// Call from a pointerdown or keydown handler; safe to call often.
export function unlock() { if (!ctx) try { build(); } catch (e) { return; } wake(); }
// Start a song; the same song keeps playing unless it ended (a loss or a win), then it starts over.
export function playSong(s) {
  if (song && song.id === s.id && state === 'play') return;
  want = s; if (song && ctx) fade(ctx.currentTime, .5);
}
// 0 calm, 1 trace rising, 2 trace critical
export function setMood(m) { mood = m; }
export function winSong() { if (!song || state !== 'play' || !ctx) return; state = 'win'; won = step; }
export function loseSong() {   // a power-down: the filter closes, a falling tone, then silence
  if (!song || state !== 'play' || !ctx) return;
  const t = ctx.currentTime;
  toneTo(t, 90, 1.2);
  const e = env(t, .35, .01, 1.4, 'lin'); e.connect(N.master); const o = osc('sawtooth', 220, t, t + 1.5, e); o.frequency.exponentialRampToValueAtTime(28, t + 1.4);
  fade(t + .2, 1.4);
}
export function stopSong() { want = null; if (song && ctx) fade(ctx.currentTime, .4); }
export function setOn(v) { on = !!v; if (ctx && song) { const g = N.master.gain; g.cancelScheduledValues(ctx.currentTime); g.setTargetAtTime(on ? VOL : 0, ctx.currentTime, .1); } wake(); }
export function setHidden(v) { hidden = !!v; wake(); }
export function position() {   // what sounds now: the scheduler runs up to LOOK seconds ahead
  if (!song || !ctx) return { state: want ? 'starting' : state };
  const n = Math.max(0, step - Math.round(Math.max(0, at - ctx.currentTime) * song.bpm / 15));
  return { id: song.id, step: n, section: sectionAt(Math.floor(n / STEPS)), state };
}
