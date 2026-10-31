// Generated music: one dark techno track per level, seeded from the level. Pure: no DOM, no audio.
// songFor(level, ice) returns the notes and the mix; src/audio.js plays them.
import { mulberry32, hash } from './core.js';
import { hostFor, iceFor, secFor, themeFor, THEMES } from './hosts.js';   // circular through core: used only inside function bodies
import { hardness } from './levels.js';

export const STEPS = 16, BARS = 8;   // 16ths per bar, bars per section
export const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], harmonic: [0, 2, 3, 5, 7, 8, 11] };
const MOOD = { small: ['dorian', 'minor'], corporate: ['minor', 'minor', 'harmonic'], high: ['phrygian', 'harmonic', 'minor'], gov: ['phrygian', 'minor'] };
const ROOT_PC = [9, 5, 2, 4, 7, 0];   // per theme (acid A, red F, cyan D, violet E, amber G, magenta C), so a palette has a key
// chord roots per bar, as scale degrees (0 the tonic); mostly the tonic, as techno sits on one chord
const PROGS = [[0, 0, 5, 6], [0, 5, 3, 6], [0, 0, 1, 0], [0, 3, 5, 4], [0, 0, 0, 5], [0, 6, 5, 6]];
// sections: which layers play and the filter (0 closed .. 1 open; [a, b] sweeps over the section).
// The first pass plays them all, then it loops from `LOOP`.
export const SECTIONS = {
  intro: { kick: 1, hat: 1, pad: 1, cut: .35 },
  build: { kick: 1, hat: 1, bass: 1, pad: 1, cut: [.4, .65] },
  main: { kick: 1, hat: 1, open: 1, clap: 1, bass: 1, arp: 1, pad: 1, cut: .8, fill: 1 },
  drive: { kick: 1, hat: 1, open: 1, clap: 1, bass: 1, arp: 2, pad: 1, perc: 1, cut: .95, fill: 1 },
  break: { hat: 1, arp: 2, pad: 1, perc: 1, cut: [.25, 1] },
};
export const ARRANGE = ['intro', 'build', 'main', 'drive', 'break', 'main', 'drive'], LOOP = 2;

// k hits spread evenly over n steps (Bjorklund by the floor formula), rotated by rot
export const euclid = (k, n, rot = 0) => Array.from({ length: n }, (_, i) => ((i + rot) * k) % n < k);
export const midi = (root, scale, deg) => root + 12 * Math.floor(deg / 7) + scale[((deg % 7) + 7) % 7];
const pick = (r, a) => a[Math.floor(r() * a.length)];

export function songFor(level, ice = iceFor(level)) {
  const r = mulberry32(hash(level, 31)), host = hostFor(level), sec = secFor(level), h = hardness(level);
  const scaleName = pick(r, MOOD[host.gov ? 'gov' : host.tier]), scale = SCALES[scaleName];
  const root = 36 + ROOT_PC[THEMES.indexOf(themeFor(level))], prog = pick(r, PROGS);
  const bpm = [122, 126, 130, 134][sec] + Math.floor(r() * 4);
  const v = (i, hi = 1, lo = .55) => i % 4 === 2 ? hi : lo;   // offbeat accent

  const kick = Array.from({ length: STEPS }, (_, i) => i % 4 ? 0 : 1);
  if (h > .5 && r() < .6) kick[r() < .5 ? 14 : 7] = .45;   // a ghost kick on harder levels
  const hat = euclid(8 + Math.floor(r() * 5 + 3 * h), STEPS, Math.floor(r() * 4)).map((on, i) => on ? v(i, 1, .5) : 0);
  const open = Array.from({ length: STEPS }, (_, i) => i % 4 === 2 && r() < .85 ? 1 : 0);
  const clap = Array.from({ length: STEPS }, (_, i) => i === 4 || i === 12 ? 1 : 0);
  if (r() < .4) clap[15] = .35;

  // bass: semitones above the bar's chord root, null for a rest
  const bassStyle = pick(r, ['offbeat', 'rolling', 'gallop']);
  const hits = { offbeat: i => i % 4 === 2, rolling: i => i % 4 !== 0, gallop: i => i % 4 >= 2 }[bassStyle];
  const bass = Array.from({ length: STEPS }, (_, i) => !hits(i) ? null : r() < .78 ? 0 : pick(r, [12, 7, scale[1], 12]));
  if (ice === 'jam') for (let i = 12; i < 16; i++) bass[i] = bass[12] ?? 0;   // jammed: the last beat stutters on one note

  // arp: indexes into the bar's chord tones (two octaves), in a seeded order and a gate pattern
  const span = 3 + Math.floor(r() * 4), mode = pick(r, ['up', 'down', 'updown', 'random', 'pinky']);
  const order = (n, m) => Array.from({ length: STEPS }, (_, i) => {
    if (m === 'up') return i % n; if (m === 'down') return n - 1 - i % n;
    if (m === 'updown') { const p = 2 * n - 2 || 1, x = i % p; return x < n ? x : p - x; }
    if (m === 'pinky') return i % 2 ? (i >> 1) % (n - 1) : n - 1;   // a top note against a moving line
    return Math.floor(r() * n);
  });
  let arps = [order(span, mode), order(span, mode === 'random' ? 'random' : pick(r, ['up', 'down', 'updown', 'pinky']))];
  if (ice === 'scrambler') arps = [0, 1, 2, 3].map(() => order(span + 1, 'random'));   // a new order every bar
  if (ice === 'lock' || ice === 'seal') arps = [Array(STEPS).fill(0)];   // locked on one note
  let gate = euclid(10 + Math.floor(r() * 7), STEPS, Math.floor(r() * 3));
  if (ice === 'blink') gate = gate.map((g, i) => g && i < 10);   // the line drops out for the end of every bar
  if (ice === 'seal') gate = gate.map((g, i) => g && i % 2 === 0);
  const perc = euclid(2 + Math.floor(r() * 3), STEPS, 1 + Math.floor(r() * 5)).map((on, i) => on && i % 4 ? 1 : 0);

  const mix = {
    bassCut: .25 + .2 * r() - (host.tier === 'high' ? .08 : 0), res: 4 + Math.floor(r() * 8),
    arpWave: ice === 'monochrome' ? 'triangle' : pick(r, ['sawtooth', 'square']),
    delay: ice === 'jam' ? 0 : ice === 'lag' ? .62 : .32, delaySteps: ice === 'lag' ? 3 : pick(r, [3, 3, 6]),
    crush: ice === 'static' ? 5 : 0, wobble: ice === 'jitter' ? 28 : 0, noise: ice === 'static',
    dark: ice === 'black' || ice === 'monochrome' ? .2 : host.tier === 'high' ? .08 : 0,
    padTones: ice === 'monochrome' ? 1 : 3,
  };
  const sections = ARRANGE.map(n => ({ name: n, ...SECTIONS[n], arp: ice === 'black' ? 0 : SECTIONS[n].arp || 0 }));
  return { id: `${level}:${ice ?? ''}`, level, ice, bpm, root, scale: scaleName, prog: prog.map(d => midi(root, scale, d) - root),
    chords: prog.map(d => [0, 2, 4, 7, 9, 11, 14].map(k => midi(root, scale, d + k))),   // chord tones over two octaves, from the bass octave
    kick, hat, open, clap, bass, bassStyle, arps, gate, span, perc, mix, sections, loop: LOOP };
}
