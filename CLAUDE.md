# Splice: agent notes

Splice is an ad-free, cyberpunk bubble shooter for phones (vanilla HTML, CSS and ES modules,
no build step, no dependencies). Aim at the bottom, fire a packet into the hanging cluster;
three or more of one colour pop, and anything cut off from the ceiling falls. Levels are
generated endlessly. It is a personal hobby project and a sibling of Kiln (`../kiln`).

Read before changing behaviour:
- `docs/superpowers/specs/2026-10-21-core-loop-design.md`: the design and the numbers from the
  playtested prototype. Where this file and the spec disagree, the spec wins.
- `CONTRIBUTING.md`: code, copy and commit conventions. Follow them.

## Commands

- Run: serve the folder (`python3 -m http.server`) and open http://localhost:8000/.
  `file://` does not work (ES modules, `fetch` for `lang/`).
- Test: `node --test` (not `node --test tests/`, which fails on newer Node).
- Balance: `node tools/sim.mjs [levels] [runs] [--unlimited]`, e.g. `node tools/sim.mjs 3,25,50 3`.
  Without arguments it plays levels 1, 3, 5, 10 ... 60 once. `--unlimited` removes the shot
  limit, to measure the shots a level really needs.

## Files

- `index.html`: markup (HUD, canvas, result sheet). `style.css`: all styles.
- `src/core.js`: rules, pure (no DOM, no storage). Tested in `tests/core.test.mjs`.
- `src/levels.js`: level generation, colouring, shot limit, pure. Tested in `tests/levels.test.mjs`.
- `src/ui.js`: language, rendering, input, animation, sheets, saving.
- `lang/`: all visible text. `languages.json` maps codes to own-language names (only `en`
  now); `<code>.json` holds flat `"key": "text"` pairs with `{placeholders}`.
  `tests/lang.test.mjs` checks the lang files.
- `tools/sim.mjs`: greedy bot over the core API.
- `spike/`: the throwaway prototype the design numbers came from. Not part of the game.
- `docs/superpowers/`: the spec and the plan for the core loop.

## Core (`src/core.js`)

Sections are marked `/* ---------- name ---------- */`. A level's board is a `Map` from
`key(r, c)` (`r * 16 + c`) to a colour `0..5`. Positions are in bubble radii: `centre(r, c)`,
row height `RH` = sqrt(3). Rows are offset: `cellsIn(cols, r)` is `cols` on even rows and
one fewer on odd rows.

- **random**: `mulberry32`, `hash`. No `Math.random` anywhere in `src/`.
- **geometry**: `nbrs(cols, r, c)`, `connected(grid, cols)` (flood fill from row 0).
- **shots**: `viewTop`/`shooterPos` (the view keeps the lowest bubble `winRows - 5` rows
  above the shooter row), `clampAim` (null if aiming down, else keeps `MIN_ANGLE` off the
  horizon), `trace(grid, cols, ang)` steps 0.25 radii with wall bounces and returns
  `{pts, cell}` (`HIT` is 0.82 of a bubble diameter), `snap` picks the nearest free cell
  that touches the ceiling or a bubble.
- **deal**: `startState(level, fails)` builds the state `S` (`grid, shots, score, cur, next,
  hist, draws, ...`). `deal(S)` draws a colour still on the board, seeded from
  `(level, fails, draws)`. Colours not visible at the current view are 0.3 times as likely
  (`OFFSCREEN_W`); the same colour three times in a row is avoided.
- **moves**: `swap`, `won`, `lost`, `fire(S, ang)` (returns `{pts, cell, popped, dropped,
  points}` or null; score is `10 * popped + 10 * dropped^2`; after a shot, `cur` and `next`
  are re-dealt if their colour left the board).
- **saves**: `toSave`, `fromSave`, `validSave` (version `v: 1`).

`core.js` and `levels.js` import each other. Uses of the imported names stay inside
function bodies, so keep it that way.

## Levels (`src/levels.js`)

- `difficulty(level)` ramps to 1 at level 40. `isLong(level)`: every 5th level is longer.
  `winRows(cols)` is the visible height in rows.
- `makeLayout(level)` (cached) depends on the level only. Kind is `designed` or `noise`
  (noise 25% of levels from level 3, never mixed). Columns are 8, 10 or 12, 3 to 6 colours.
  Designed levels stack screens of seeded shapes (lines, rhombus, ring, triangle, chevron,
  bar, shelf), optionally mirrored, each shape or band one group. `addStems` joins loose
  parts to the ceiling. Noise is full rows, every bubble its own group.
- `colourize(layout, level, fails)`: colours groups so touching groups differ where
  possible. Retry (`fails`) keeps the layout and reshuffles the colours.
- Shot limit: `shotLimit(layout)` = `ceil(a * groups + b * cells / nColours + c)` with
  `SHOT_K = { designed: {a: 1.05, b: 0, c: 1}, noise: {a: 0, b: 0.8, c: 32} }`.
  `shotsFor(base, fails)` adds 10% per fail from the 4th, capped at +40%.
- Calibration (sim): the bot wins about 95% of sampled designed levels and 96% of noise
  levels, with median shots left about 39% and 21%. The spec's 5 to 15% target was not
  reachable: the shots one level needs vary by up to 25% across colourings, and no layout
  feature predicts that. Extra features overfit on held-out levels. If levels feel too easy,
  tighten `SHOT_K` and rerun the sim.

## UI (`src/ui.js`)

- Language: top-level `await` loads `lang/languages.json`, then `setLang(code)` merges
  `en.json` with the chosen file into `T`. Choice: `localStorage['splice-lang']`, else the
  first `navigator.languages` match, else English. `t('key', {n})` fills placeholders.
  Never put visible text in code; add a key to every `lang/*.json` instead.
- Look: `THEMES` (accent and background, picked by level), six `HUES` with a symbol each
  (`sym`), so colour is never the only cue. `bubble()` draws one packet.
- View and scrolling: `fit()` sizes the canvas to the screen; `S` is in bubble radii and
  `sc` is px per radius. `view` is the top row shown and eases toward `viewTop` (instantly
  with reduced motion). The ceiling line is drawn only when row 0 is on screen.
- Input: pointer drag aims (`setAim`), release fires (`shoot`). A touch that starts in the
  strip at the shooter's height swaps `cur` and `next` and never aims or fires. The mouse
  wheel also swaps (one swap per gesture). Input is ignored while a packet flies, the view
  is scrolling or a sheet is open (`ready()`).
- Animation: the packet follows the traced `pts`; `land()` then adds pop, fall (glitch
  jitter seeded from the key) and `-n` effects. With reduced motion, results show at once.
- Sheets: one result sheet for win ("Root access") and loss ("Flatline"). Next level and
  Try again start a new state; Restart in the HUD restarts the level and does not count as
  a fail.
- Saving: `S` is saved whole to `localStorage['splice-v1']` after every shot and swap;
  `load()` falls back to level 1 if the save is missing or fails `validSave`.

## Not built yet

No PWA or deploy, no self-hosted font (it still uses the system monospace), English only,
no sound.

## Theme

The cluster is a block of ICE (intrusion countermeasures) or corrupted data. Each shot is
a packet. Matching colours breaks the encryption; everything cut off from the ceiling drops
like an orphaned process.

- Dark only, gritty: neon on near-black, grime, scanlines, glow, and a short glitch on
  bubbles that detach. No light mode. Effects stay subtle; the board must read clearly.
- The look varies like Kiln's chapters: each generates its own palette from a seed, one
  leaning neon green, another red, another cyan or violet. The bubble colours within a
  palette stay clearly apart.
- Copy can use the theme lightly: "Root access" on a cleared level, "Flatline" on a loss.
  Everything else stays short and plain, in sentence case.
- Every colour also carries a symbol, so the game works for colour-blind players and in
  bright light. Never two look-alike colours or symbols on the same board.
- Font: a self-hosted OFL font with a techy feel (for example Chakra Petch or Rajdhani),
  shipped with its license like Kiln's `fonts/`.

## Design goals (keep these)

1. No ads, no accounts, no network calls to anyone else: every file, including the font,
   comes from the game's own site.
2. Endless levels, one after another.
3. Fairness: losing should come from the player's aim, never from the colour dice. The
   next packet only ever has a colour that is still on the board; when one colour is left,
   every packet is that colour.
4. Nobody gets stuck on one level. Like Kiln eases its targets, repeated fails add
   shots: from the 4th failed attempt each retry gets more shots (for example +10% of
   the original per fail, capped). The layout never changes on retry.
5. Short, plain UI copy in sentence case.
6. Relaxed, not punishing. A human loses sometimes; a balance bot wins nearly always.

## Later ideas (parked)

- Hardened bubbles that need two hits.
- Firewall rows that only drop once everything above them is cleared.
- Data cores embedded in the cluster as an alternative level goal, like Kiln's gems.
- Chapters with their own palette, as in Kiln.

## Working rules

- Always ask before committing. Conventional Commits. Never add `Co-Authored-By:` or
  "Generated with" lines to commits or PR bodies.
- No em-dashes in UI copy or docs. Use typographic apostrophes (’) in visible text.
- Rerun `node --test` and the sim after rule or balance changes.
