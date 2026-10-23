# Splice Difficulty Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A hardness curve over each 20-level stretch that adds stems, breaks up colours and turns on ICE countermeasures tied to the target host, with fair bot-measured shot limits and a sim report of big clears.

**Architecture:** `hardness(level)` and the generation changes live in `src/levels.js`. ICE choice is pure data in `src/hosts.js`. The ICE shot-limit factor goes into `limitFor` in `src/bot.js`. The seven ICE effects, the header tag and the log lines live in `src/ui.js`. `tools/sim.mjs` reports big clears.

**Tech Stack:** Vanilla JS ES modules, canvas 2D, `node:test`. No dependencies, no build step.

**Spec:** `docs/superpowers/specs/2026-10-23-difficulty-pass-design.md`. Read it before any task. Notes: `CLAUDE.md`.

## Global Constraints

- No frameworks, no dependencies, no build step. Tests: `node --test` from the repo root.
- `src/core.js`, `src/levels.js`, `src/bot.js`, `src/hosts.js`: pure (no DOM, no storage, no `Math.random`), seeded, deterministic.
- No rule changes: ICE never changes where a shot goes, what pops or drops, or the dealing.
- Hardness: `hardness(level) = ((level - 1) % 20) / 19`. Global `difficulty(level)` unchanged in what it drives.
- ICE types and severities exactly: static mild, jitter mild, scrambler medium, lock medium, jam medium, monochrome harsh, black harsh. `ICE_K = { mild: 1.1, medium: 1.25, harsh: 1.5 }`.
- One ICE type per level, chosen from the level only (same on retry and restart). None for `h < 0.5`; chance `(h - 0.5) * 1.4` above; black only at `h >= 0.8` on high-stakes hosts; severity capped by tier (small mild, corporate medium, high harsh).
- Visible UI text only in `lang/en.json` via `t('key', …)` with literal keys (the lang test scans for `t('key'`). Remove keys that become unused.
- Reduced motion: no drifting, no jitter, no blinking; static fallbacks as the spec says.
- Every `localStorage` key and cache name starts with `splice-`. New site files go into `SHELL` in `sw.js` (and `CACHE` becomes `splice-3` if `SHELL` changes).
- Compact, terse JS matching the files. No em-dashes in copy or docs.
- Commits: Conventional Commits, imperative, lowercase, no period, about 72 chars; never `Co-Authored-By:` or "Generated with"; stage by path, never `git add -A`. The owner approved commits on this branch.

## Review Focus

1. ICE must never hide information the shot limit assumes is visible without the factor applying: every level with ICE gets `ICE_K` in its limit (test in Task 3).
2. At `h = 0` levels must still play like today: same kinds of layouts and no ICE (tests in Tasks 1 and 2).
3. Scrambler: a blind packet fired after a swap must land and pop exactly as an unhidden one would; only the drawing differs (manual check in Task 5).
4. Jam: the restore counter counts shots, not frames, and never goes negative; after a reload the line is jammed again (manual check in Task 4).
5. Monochrome must keep symbols readable at all six colours (manual check in Task 6).

---

### Task 1: Hardness and generation changes

**Files:** Modify `src/levels.js`. Test: `tests/levels.test.mjs`.

**Interfaces:** Produces `hardness(level) => number` exported from `src/levels.js`.

Generation changes (spec "Generation changes", in `generate`, `addStems`, `colourize`):
1. More stems: each floating structure gets `1 + extra` stems with `extra = Math.min(2, Math.floor(h * 2 + rnd()))`; extra stems start from other bubbles on the structure's top edge, spread left, middle, right; mirrored sections mirror them.
2. Asymmetric mirrors: in mirrored sections, with probability `h` per shape, cells right of the axis get their own group id (axis cells stay left).
3. Split bands: with probability `h`, a shape band group of 6 or more cells is cut by horizontal position into 2 segments, or 3 with probability `h`; the cut positions are per shape, so stacked bands of one shape share them.
4. Noise clumping: `0.45 - 0.30 * h` instead of `0.45`.

- [ ] **Step 1: Write the failing tests** (append to `tests/levels.test.mjs`)

```js
import { hardness } from '../src/levels.js';
import { key, nbrs, cellsIn } from '../src/core.js';

test('hardness ramps over 20 levels and starts again', () => {
  assert.equal(hardness(1), 0); assert.equal(hardness(20), 1); assert.equal(hardness(21), 0);
  assert.ok(Math.abs(hardness(10) - 9 / 19) < 1e-9);
});
const easy = [1, 21, 41, 61, 81, 101, 121, 141, 161, 181], hard = easy.map(l => l + 19);
const designed = ls => ls.filter(l => makeLayout(l).kind === 'designed');
const stems = L => new Set([...L.cells.values()].filter(g => g >= 1e6)).size;
const avg = (ls, f) => ls.reduce((a, l) => a + f(l), 0) / ls.length;
test('hard levels hang their shapes from more stems', () => {
  const e = avg(designed(easy), l => stems(makeLayout(l)) / makeLayout(l).screens), h = avg(designed(hard), l => stems(makeLayout(l)) / makeLayout(l).screens);
  assert.ok(h > 1.8 * e, `stems per screen ${e} -> ${h}`);
});
const sameNeighbour = (L, col) => { let s = 0, n = 0;
  for (const [k, c] of col) for (const [r, cc] of nbrs(L.cols, k >> 4, k & 15)) { const o = col.get(key(r, cc)); if (o !== undefined) { n++; if (o === c) s++; } }
  return s / n; };
test('hard levels break up colours', () => {
  const share = ls => avg(ls, l => { const L = makeLayout(l); return sameNeighbour(L, colourize(L, l, 0)); });
  assert.ok(share(hard) < share(easy) - 0.05, `same-colour neighbours ${share(easy)} -> ${share(hard)}`);
  const groups = ls => avg(designed(ls), l => new Set(makeLayout(l).cells.values()).size / makeLayout(l).cells.size);
  assert.ok(groups(hard) > 1.3 * groups(easy), 'more, smaller colour groups');
});
```

Keep every existing levels test passing (connectivity, determinism, retry recolouring, kinds and columns).

- [ ] **Step 2: Run `node --test`.** Expected: the new tests FAIL.
- [ ] **Step 3: Implement.** Export `hardness`; thread `h` into generation.
- [ ] **Step 4: Run `node --test`.** Expected: all pass. Run `node tools/sim.mjs 1,10,20,21,40 1`: the bot wins every level; paste the output in the report.
- [ ] **Step 5: Commit** `feat: add hardness with more stems and broken-up colours`

---

### Task 2: ICE choice

**Files:** Modify `src/hosts.js`. Test: `tests/hosts.test.mjs`.

**Interfaces:**
- Consumes: `hardness` (Task 1), `hostFor`.
- Produces from `src/hosts.js`: `ICE = { static: 'mild', jitter: 'mild', scrambler: 'medium', lock: 'medium', jam: 'medium', monochrome: 'harsh', black: 'harsh' }`, `ICE_K = { mild: 1.1, medium: 1.25, harsh: 1.5 }`, `iceFor(level) => null | type` per the spec's tables ("Who runs what"; government flavour follows the tier as in "Smaller calls"), seeded from `hash(level, 13)`.

- [ ] **Step 1: Write the failing tests** (append to `tests/hosts.test.mjs`)

```js
import { iceFor, ICE } from '../src/hosts.js';
import { hardness } from '../src/levels.js';

const SEV = { mild: 1, medium: 2, harsh: 3 }, CAP = { small: 1, corporate: 2, high: 3 };
test('ice follows hardness, tier and the black ice rule', () => {
  const seen = new Set();
  for (let lv = 1; lv <= 4000; lv++) { const ice = iceFor(lv), h = hardness(lv), host = hostFor(lv);
    assert.equal(iceFor(lv), ice);
    if (h < 0.5) assert.equal(ice, null, `level ${lv}`);
    if (!ice) continue; seen.add(ice);
    assert.ok(SEV[ICE[ice]] <= CAP[host.tier], `${ice} on ${host.tier}`);
    if (ice === 'black') assert.ok(h >= 0.8 && host.tier === 'high');
  }
  assert.deepEqual([...seen].sort(), Object.keys(ICE).sort());
});
test('about 70% of the hardest levels have ice', () => {
  const top = Array.from({ length: 200 }, (_, i) => 20 * (i + 1)), n = top.filter(l => iceFor(l)).length;
  assert.ok(n > 0.55 * 200 && n < 0.85 * 200, `${n}/200`);
});
```

- [ ] **Step 2: Run `node --test`.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run `node --test`.** Expected: all pass.
- [ ] **Step 5: Commit** `feat: pick ice countermeasures from the target host`

---

### Task 3: Shot limit with the ICE factor

**Files:** Modify `src/bot.js`, `src/core.js`. Test: `tests/bot.test.mjs`.

**Interfaces:** `limitFor(used, ice = null)` = `Math.ceil(used * HUMAN_K * (ice ? ICE_K[ICE[ice]] : 1) + HUMAN_C)`; `startState` passes `iceFor(level)`.

- [ ] **Step 1: Write the failing test** (append to `tests/bot.test.mjs`)

```js
import { iceFor, ICE, ICE_K } from '../src/hosts.js';
test('levels with ice get the ice factor in their limit', () => {
  assert.equal(limitFor(10, 'black'), Math.ceil(10 * HUMAN_K * 1.5 + HUMAN_C));
  assert.equal(limitFor(10, 'static'), Math.ceil(10 * HUMAN_K * 1.1 + HUMAN_C));
  const lv = [...Array(200).keys()].map(i => i + 1).find(l => iceFor(l));
  const S = startState(lv, 0), probe = startState(lv, 0);
  assert.equal(S.shots, shotsFor(limitFor(solve(probe).used, iceFor(lv)), 0));
});
```

- [ ] **Step 2: Run `node --test`.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run `node --test`.** Expected: all pass (the existing limit test still holds for levels without ICE).
- [ ] **Step 5: Commit** `feat: give levels with ice a larger shot limit`

---

### Task 4: ICE framework, jam and black ICE

**Files:** Modify `src/ui.js`, `style.css`, `index.html`, `lang/en.json`.

**Interfaces:** Consumes `iceFor` (Task 2).

Exact texts in `lang/en.json`:

```json
"logIce": "> ice detected: {ice}",
"logRestored": "> targeting restored ({n})",
"logJammed": "> targeting jammed",
"iceStatic": "Static ICE",
"iceJitter": "Jitter ICE",
"iceScrambler": "Scrambler ICE",
"iceLock": "Lock ICE",
"iceJam": "Jam ICE",
"iceMonochrome": "Monochrome ICE",
"iceBlack": "Black ICE"
```

Build: a name lookup with literal `t()` calls for all seven; the log line after the connect line at level start and load; a small tag in the header showing the ICE name; the aim line drawing honours the active ICE. Jam: the aim line stops at the first wall bounce (or its end if none); a landed shot with a drop of 6 or more sets `restore = 3` and logs `logRestored` with n; each later fired shot decrements it; at 0 log `logJammed`; full line while `restore > 0`; reload starts jammed. Black: no aim line at all. Tasks 5 and 6 add the other effects, so leave a single place where the effect for the current ICE is applied.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Run `node --test`.** Expected: all pass.
- [ ] **Step 3: Manual check** (serve with `python3 -m http.server 8095`, Playwright at 390x844; find levels with each ICE via `iceFor` in the page and set up a save at that level, or start them by editing the save's level): the log and tag show the ICE; black shows no aim line; jam shows the line to the first bounce, a 6+ drop restores it for 3 shots with both log lines, a reload is jammed (Review Focus 4). Stop the server.
- [ ] **Step 4: Commit** `feat: announce ice and jam the aim line`

---

### Task 5: Scrambler and lock

**Files:** Modify `src/ui.js`, `style.css`.

- Scrambler: the next packet is drawn as a glitchy "?" (no colour, no symbol). After a shot the packet that moves up is shown normally. After a swap the current packet stays hidden until fired, and is drawn in its colour once in flight. Firing, landing and dealing are unchanged (Review Focus 3).
- Lock: swapping is disabled (tap strip and wheel do nothing); a small lock mark on the next packet.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Run `node --test`.** Expected: all pass.
- [ ] **Step 3: Manual check** at 390x844: scrambler hides the next packet, a swap shows "?" at the shooter, the fired packet appears in colour in flight and lands/pops like any packet; lock ignores taps in the strip and the wheel. Stop the server.
- [ ] **Step 4: Commit** `feat: add scrambler and lock ice`

---

### Task 6: Static, jitter and monochrome

**Files:** Modify `src/ui.js`, `style.css`.

- Static: 3 glitch blocks, about 2 x 2 bubbles each, drift slowly over the board area (never the shooter zone); motion and shapes seeded from the level and time, no `Math.random`. Reduced motion: fixed positions.
- Jitter: the drawn aim line rotates a few degrees, changing smoothly over time; the shot uses the true angle. Reduced motion: no jitter, the line is cut at the first bounce instead.
- Monochrome: bubbles and packets drawn in one neutral tone with their symbols; symbols must stay readable (Review Focus 5).

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Run `node --test`.** Expected: all pass.
- [ ] **Step 3: Manual check** at 390x844 with screenshots of each in the report. Stop the server.
- [ ] **Step 4: Commit** `feat: add static, jitter and monochrome ice`

---

### Task 7: Big-clear report

**Files:** Modify `tools/sim.mjs`.

Add a `--clears` option: per level, count shots that remove more than half of the bubbles on screen when the screen holds 12 or more; report big clears per level by kind and hardness band (`0-0.25`, `0.25-0.5`, `0.5-0.75`, `0.75-1`). The method is the scratch script from the design session (`/private/tmp/claude-501/-Users-ibn-Development-Splice/1919787c-b17b-4594-a233-029a9719b3a4/scratchpad/clears.mjs`; read it, port it).

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Run** `node tools/sim.mjs 1-80 1 --clears`. Expected: the bot wins every level; the hardest band has clearly fewer big clears per designed level than the easiest. Paste the output into the report and the commit body.
- [ ] **Step 3: Commit** `feat: report big clears by hardness in the sim`

---

### Task 8: Notes

**Files:** Modify `CLAUDE.md`.

- [ ] **Step 1:** Describe hardness, the generation changes, ICE (types, severities, who runs what, factors, UI behaviour) and the sim option, checked against the code.
- [ ] **Step 2: Run `node --test`.**
- [ ] **Step 3: Commit** `docs: describe hardness and ice in agent notes`
