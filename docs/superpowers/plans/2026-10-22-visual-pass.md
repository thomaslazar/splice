# Splice Visual Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A cyberdeck HUD around the board (header, corner brackets, packets bar, run log), a generated host per level drawn in a strip that opens near the end, a quiet "Root access" win where the host glitches into the accent colour, and a self-hosted techy font.

**Architecture:** Host generation is pure data in a new `src/hosts.js` (tested). Host drawing is canvas code in a new `src/hostdraw.js`. `src/core.js` gains two state fields for the HUD (`maxShots`, `startLow`) but no rule changes. `src/ui.js` builds the HUD, the log and the win sequence.

**Tech Stack:** Vanilla HTML, CSS, ES modules, canvas 2D; `node:test`. No dependencies, no build step.

**Spec:** `docs/superpowers/specs/2026-10-22-visual-pass-design.md`. Read it before any task. Project notes: `CLAUDE.md`. Reference mockups: `.superpowers/brainstorm/7420-1792659078/content/ui-chrome.html` (left panel, layout A) and `visual-direction-v3.html` (host shapes in the bottom gallery; ignore its tilt and fire).

## Global Constraints

- No frameworks, no dependencies, no build step. Run tests with `node --test` from the repo root.
- `src/core.js`, `src/levels.js`, `src/bot.js`, `src/hosts.js`: pure (no DOM, no storage, no `Math.random`); everything seeded.
- No rule, dealing, shot-limit or generation changes.
- Visible UI text lives in `lang/en.json` and is read with `t('key', {...})`. Exception (ruling): generated host names and system labels come from `src/hosts.js` data; they are proper names in the fiction, not UI copy.
- `tests/lang.test.mjs` requires `src/ui.js` to use exactly the keys in `lang/en.json`: remove keys that become unused.
- Never real company names, real agency names or real acronyms in `src/hosts.js`.
- Every `localStorage` key and cache name starts with `splice-`.
- Dark only. Reduced motion: no glitch, no blink, no easing; instant states.
- Compact, terse JS matching the existing files. No em-dashes in copy or docs.
- Commits: Conventional Commits, imperative, lowercase, no period, about 72 chars; never `Co-Authored-By:` or "Generated with" lines. Stage by path, never `git add -A`.

## Review Focus

1. A save written before this change (no `maxShots`, no `startLow`) still loads and the HUD shows sane values (test in Task 2).
2. The host strip opening mid-level must not move bubbles under the player's aim mid-shot: it opens only while no packet is in flight and aiming waits until the resize settled (manual check in Task 6).
3. The win sequence never runs twice and never blocks the game: after it, the sheet's "Next level" works; a reload on a won board shows the sheet at once (manual check in Task 6).
4. Host names never collide with real brands or agencies (review of the lists in Task 1; test rejects a small deny list).
5. On a 390x844 viewport with the strip collapsed, the board is not smaller than before this change (manual check in Task 4: compare `sc` before and after).

---

### Task 1: Host generator (`src/hosts.js`)

**Files:**
- Create: `src/hosts.js`, `tests/hosts.test.mjs`

**Interfaces:**
- Consumes: `mulberry32`, `hash` from `src/core.js`; `difficulty`, `isLong` from `src/levels.js` (circular imports are fine inside function bodies; keep top-level code free of calls into them).
- Produces (exported from `src/hosts.js`):
  - `THEMES`: the 6 themes moved from `src/ui.js`, each `{ a, bg, hue }` where `hue` is the index into the bubble hues `[magenta 0, cyan 1, acid 2, amber 3, violet 4, red 5]` it resembles: green #39ff88 → 2, red #ff2a4a → 5, cyan #20e8ff → 1, violet #b36bff → 4, amber #ffb020 → 3, pink #ff3df0 → 0. Keep the existing `a` and `bg` values and order.
  - `themeFor(level) => theme` = `THEMES[hash(level, 3) % 6]` (the existing rule).
  - `SHAPES = ['cubes', 'pyramid', 'spire', 'sphere', 'fortress', 'lattice']`.
  - `tierFor(level) => 'small' | 'corporate' | 'high'`: long levels (`isLong`) are `'high'`; else `difficulty < 0.35` → `'small'`, `< 0.75` → `'corporate'`, else `'high'` with probability 0.3 (seeded from the level) else `'corporate'`.
  - `hostFor(level) => { owner, gov, industry, system, tier, label, shape, hue, params }`:
    - `owner`: the display name, e.g. `'Kessler-Hayashi Genomics'` or `'Ministry of Records'`.
    - `gov`: true for government targets (about 1 in 6 levels).
    - `industry`: industry key (corporations) or `'gov'`.
    - `system`: lower-case system name from the spec tables, e.g. `'r&d node'`.
    - `label`: `` `${owner} // ${system}`.toUpperCase() ``.
    - `shape`: one of `SHAPES`, from the spec's system → shape table (government systems placed by the builder in the same spirit, all listed in one table in code).
    - `hue`: a bubble hue index `0..5`, never `themeFor(level).hue`.
    - `params`: small seeded numbers for drawing variety, `{ size: 0.85..1.15, steps: 3..6, towers: 2..4, nodes: 7..12, tilt: -0.2..0.2 }`.
  - Data: the industry table (name words, systems with weights) and tiers exactly as in the spec; surnames (~40, many cultures), coined names (~30), initials pattern (3 capital letters, seeded), government name patterns and jurisdictions (fictional), government systems per tier.
  - Recurring corporations: per tier and per 30-level stretch (`Math.floor((level - 1) / 30)`), build a seeded pool of 24 corporations (name + industry valid for that tier); a level picks its corporation from the pool. Government targets are generated per level, no pool.
  - No repeat: if `owner` and `system` equal those of level − 1 (computed by an internal `rawHost(level - 1)` without this check, to avoid recursion), reroll the system once from the same owner's list; if that still matches, take the next system in the list.

- [ ] **Step 1: Write the failing tests** in `tests/hosts.test.mjs`

```js
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
```

The surveillance grid appears in both the security (corporate) and defense (high) lists in the spec; it is not in `TOP` above on purpose. Grid control is a corporate energy system; reactor control is the energy system kept for high stakes.

- [ ] **Step 2: Run `node --test`.** Expected: FAIL, cannot find `../src/hosts.js`.

- [ ] **Step 3: Implement `src/hosts.js`** with the interfaces above. Mark sections `/* ---------- name ---------- */` (themes, names, industries, government, hosts).

- [ ] **Step 4: Run `node --test`.** Expected: all pass.

- [ ] **Step 5: Print 40 hosts** (`node -e "import('./src/hosts.js').then(m=>{for(let l=1;l<=40;l++)console.log(l,m.hostFor(l).tier,m.hostFor(l).label)})"`) and paste them into the report. Check they read like plausible fiction.

- [ ] **Step 6: Commit**

```bash
git add src/hosts.js tests/hosts.test.mjs
git commit -m "feat: generate a host system for every level"
```

---

### Task 2: HUD state fields (`maxShots`, `startLow`)

**Files:**
- Modify: `src/core.js` (`startState`, saves)
- Test: `tests/core.test.mjs`

**Interfaces:**
- Produces: `S.maxShots` (the attempt's starting shots, after easing) and `S.startLow` (lowest occupied row at the start). `startState` sets both. `toSave` stores both. `validSave` accepts saves with or without them (when present: integers, `maxShots >= 1`, `startLow >= 0`). `fromSave` fills missing ones: `maxShots = Math.max(o.shots, 1)`, `startLow` = lowest occupied row of the saved grid (0 if empty).

- [ ] **Step 1: Write the failing tests** (append to `tests/core.test.mjs`)

```js
test('the state keeps its starting shots and lowest row', () => {
  const S = startState(3, 0);
  assert.equal(S.maxShots, S.shots);
  assert.equal(S.startLow, Math.max(...[...S.grid.keys()].map(k => k >> 4)));
  const o = JSON.parse(JSON.stringify(toSave(S)));
  assert.equal(fromSave(o).maxShots, S.maxShots); assert.equal(fromSave(o).startLow, S.startLow);
});
test('older saves without the new fields still load', () => {
  const S = startState(3, 0), o = JSON.parse(JSON.stringify(toSave(S)));
  delete o.maxShots; delete o.startLow; o.shots = 5;
  assert.ok(validSave(o));
  const L = fromSave(o); assert.equal(L.maxShots, 5); assert.equal(L.startLow, S.startLow);
  assert.ok(!validSave({ ...toSave(S), maxShots: 0 }));
});
```

- [ ] **Step 2: Run `node --test`.** Expected: the two new tests FAIL.
- [ ] **Step 3: Implement.** Set the fields after `S.shots` is final in `startState`.
- [ ] **Step 4: Run `node --test`.** Expected: all pass.
- [ ] **Step 5: Commit** `feat: keep the starting shots and lowest row in the state`

---

### Task 3: Self-hosted font

**Files:**
- Create: `fonts/chakra-petch-latin-400.woff2`, `fonts/chakra-petch-latin-600.woff2`, `fonts/OFL.txt`
- Modify: `style.css` (`@font-face` at the top, `font-family` on `html, body` and buttons), `src/ui.js` (canvas text font), `sw.js` (`SHELL` gains both fonts, `CACHE = 'splice-2'`), `.github/workflows/pages.yml` (copy step gains `fonts`)

- [ ] **Step 1: Get the files.** Chakra Petch is OFL, in the google/fonts repository (`ofl/chakrapetch/`: `ChakraPetch-Regular.ttf`, `ChakraPetch-SemiBold.ttf`, `OFL.txt`). Download with `curl` into a scratch folder. Convert to latin-subset woff2 if `pyftsubset` (fonttools) is available (`--unicodes=U+0000-00FF,U+2019,U+2026 --flavor=woff2`); if not, ship the ttf files as `.ttf` and adjust names and `format()` accordingly; say which in the report.
- [ ] **Step 2: Wire it.** `font-family: 'Chakra Petch', ui-monospace, Menlo, monospace;` with `font-display: swap`. Canvas text in `src/ui.js` uses the same stack.
- [ ] **Step 3: Check offline list and deploy copy.** `SHELL` has the font paths; the workflow copies `fonts`.
- [ ] **Step 4: Run `node --test`; manual check** at `python3 -m http.server 8080`: text renders in Chakra Petch (Playwright: `document.fonts.check('12px "Chakra Petch"')` is true after load), no console errors.
- [ ] **Step 5: Commit** `feat: self-host the chakra petch font`

---

### Task 4: HUD frame (header, brackets, packets bar, scanlines)

**Files:**
- Modify: `index.html`, `style.css`, `src/ui.js`, `lang/en.json`

**Interfaces:**
- Consumes: `hostFor`, `themeFor`, `THEMES` (Task 1; remove the local `THEMES` and theme rule from `src/ui.js`); `S.maxShots` (Task 2).

Layout per spec "Layout" items 1, 3, 4, 5, 7 (the strip is Task 6, the log Task 5):

- Header (DOM): left a dim `t('jackedIn')` over `hostFor(S.level).label`; right a dim `t('lvl', {n})` over the score number. Restart is a small text button in the header (same confirm flow as now).
- Corner brackets: four L-shapes in `--acc` around board plus shooter zone (canvas or CSS; builder's choice).
- Packets bar: `t('packets')`, the number of shots left, up to 20 segments; `perSegment = Math.ceil(S.maxShots / 20)`, segments shown `Math.ceil(S.maxShots / perSegment)`, lit `Math.ceil(S.shots / perSegment)`.
- Scanlines: a fixed full-screen CSS overlay (`pointer-events: none`), replacing the canvas scanlines.
- Texts (exact) added to `lang/en.json`: `"jackedIn": "Jacked in"`, `"lvl": "Lvl {n}"`, `"packets": "Packets"`. Remove keys no longer used (`shots`, `score` if unused); `level` stays for the loading card.
- `fit()` subtracts the new header, bar and log heights (the log is Task 5; reserve its two lines now).

- [ ] **Step 1: Before changing anything,** at 390x844 in Playwright record the board scale (canvas CSS width / (2 × cols)) for levels 1 and 12. Note them in the report.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Run `node --test`.** Expected: all pass (lang test included).
- [ ] **Step 4: Manual check** at 390x844 (Playwright): header shows the host label and level, Restart asks first, the bar matches shots after a few shots, scanlines cover the screen and do not block taps, board scale at levels 1 and 12 is not smaller than Step 1 (Review Focus 5), no console errors. Screenshot in the report.
- [ ] **Step 5: Commit** `feat: frame the board with a cyberdeck hud`

---

### Task 5: Run log

**Files:**
- Modify: `index.html`, `style.css`, `src/ui.js`, `lang/en.json`

Texts (exact) in `lang/en.json`:

```json
"logConnect": "> connecting to {host}",
"logBreach": "> ice layer breached ({n} nodes)",
"logDeeper": "> deeper: {pct}% of the way in",
"logHost": "> host in range",
"logTrace": "> trace rising",
"logCritical": "> trace critical",
"logLost": "> connection lost",
"logRoot": "> root access: {host}"
```

`{host}` is `hostFor(level).owner` (not the full label, to keep lines short).

Behaviour (spec "Run log events" and "Log behaviour"):
- Two visible lines, newest on top, older dimmer, blinking cursor after the newest (static with reduced motion). Kept in memory only.
- `log(text)` pushes a line. Events, checked after each landed shot in this order: breach (drop ≥ 6), deeper (view top moved and rounded pct changed; pct = `round5(100 * (S.startLow - low) / (S.startLow + 1))` where `low` is the current lowest row, clamped 0..100), host in range (`S.top === 0`, once), trace rising (`S.shots <= 0.25 * S.maxShots`, once), trace critical (`S.shots <= 3`, once), then lost or root access if the level ended.
- Level start and load: the log clears and writes `logConnect`. Once-flags are set without writing when their condition already holds.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Run `node --test`.** Expected: all pass.
- [ ] **Step 3: Manual check** (Playwright, driving shots with the bot's `bestShot` from `src/bot.js` through the exported core API in the page, as earlier sessions did): connect line on start; breach after a big drop; deeper after a scroll; trace lines when shots run low (set `S` shots by playing a level down); connection lost on a loss. Report the log lines seen.
- [ ] **Step 4: Commit** `feat: add a run log driven by game events`

---

### Task 6: Host strip, host drawing and the win sequence

**Files:**
- Create: `src/hostdraw.js`
- Modify: `src/ui.js`, `index.html`, `style.css`

**Interfaces:**
- Consumes: `hostFor` (Task 1).
- Produces: `src/hostdraw.js` exports `drawHost(g, host, x, y, size, colour, glitch = 0, t = 0)`: draws `host.shape` with `host.params` as thin neon outlines with glow, base at `(x, y)`, about `size` px tall; `glitch` 0..1 offsets horizontal slices by up to about 14 px and flickers. Port the six shapes from the mockup gallery (`visual-direction-v3.html`, `HOSTS` and `drawHost` in its script), using `params` for variety.

Behaviour (spec "Host strip", "Win sequence", "Win sequence and reloads"):
- Strip collapsed (zero height) until `S.top === 0`; then opens over about 0.4 s (instant with reduced motion) to about two bubble rows, the board refits (`fit()`), the host fades in, drawn in `colour(host.hue)`. It opens only when no packet is in flight; `ready()` is false until the refit settled (Review Focus 2). Starts open when a level starts or loads with `S.top === 0`.
- Win: after the winning shot lands, write `logRoot`; wait about 0.6 s; glitch about 0.5 s ending in the accent colour; then open the win sheet. During the sequence `ready()` is false and swaps, wheel and Restart are ignored. Reduced motion: no glitch, colour switches at the glitch point.
- Reload on a won board: sheet at once, host already in the accent colour. Loss: unchanged sheet, after `logLost`.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Run `node --test`.** Expected: all pass.
- [ ] **Step 3: Manual check** (Playwright at 390x844): play a short level to the end with the bot; the strip opens when the ceiling arrives, no shot is fired or lost during the refit; the host appears; on the win the log line, pause, glitch and sheet appear in that order; "Next level" works; reload on the won board shows the sheet at once (Review Focus 2 and 3). Screenshots of strip open and of the glitch end state in the report.
- [ ] **Step 4: Commit** `feat: reveal the host near the end and glitch it on root access`

---

### Task 7: Notes

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update `CLAUDE.md`:** Files (`src/hosts.js`, `src/hostdraw.js`, `fonts/`), a Hosts section (tiers, pools, government, no real names), UI (header, strip, packets bar, log events, win sequence), PWA (`CACHE` is `splice-2`, fonts in `SHELL` and the Pages copy step), and drop "no self-hosted font" from Not built yet.
- [ ] **Step 2: Run `node --test`.** Expected: all pass.
- [ ] **Step 3: Commit** `docs: describe the hud, hosts and font in agent notes`
