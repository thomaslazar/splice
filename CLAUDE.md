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

- Run: serve the folder (`python3 -m http.server 8080`) and open http://localhost:8080/.
  `file://` does not work (ES modules, `fetch` for `lang/`). Avoid port 8000 on the owner's
  phone: Kiln's service worker controls that origin and mixes its files in.
  The service worker is network first (revalidates, 3 s timeout, cache only as offline
  fallback). If `sw.js` changes how it caches, rename `CACHE` so `activate` drops the old cache.
- Test: `node --test` (not `node --test tests/`, which fails on newer Node).
- Balance: `node tools/sim.mjs [levels] [runs] [--unlimited]`, e.g. `node tools/sim.mjs 3,25,50 3`
  or `node tools/sim.mjs 1-60 4`. Without arguments it plays levels 1, 3, 5, 10 ... 60 once.
  Run `r` plays with `fails = r` (no easing below 4). It reports win rate and median shots
  left per kind and per difficulty band (1-10, 11-25, 26-40, 41+). `--unlimited` removes
  the shot limit, to measure the shots a level really needs.
- Fit: `node tools/fit.mjs [levels] [runs]` (default `1-240 4`, about 12 minutes) plays the
  sample without a limit, fits `SHOT_K` and prints it with per-band results.

## Files

- `index.html`: markup (HUD, canvas, result sheet). `style.css`: all styles.
- `src/core.js`: rules, pure (no DOM, no storage). Tested in `tests/core.test.mjs`.
- `src/levels.js`: level generation, colouring, shot limit, pure. Tested in `tests/levels.test.mjs`.
- `src/ui.js`: language, rendering, input, animation, sheets, saving.
- `lang/`: all visible text. `languages.json` maps codes to own-language names (only `en`
  now); `<code>.json` holds flat `"key": "text"` pairs with `{placeholders}`.
  `tests/lang.test.mjs` checks the lang files.
- `tools/sim.mjs`: greedy bot over the core API. `tools/fit.mjs`: fits `SHOT_K` with it.
- `manifest.webmanifest`, `sw.js`, `icons/`: PWA. `icons/icon.svg` is the source; the PNGs
  are renders of it (192, 512, maskable 512 at 80% scale, 180 for Apple), made with
  `qlmanage -t -s 512` and `sips -z`.
- `.github/workflows/pages.yml`: runs `node --test` on pull requests and pushes; on push to
  `master` it deploys the site files to https://thomaslazar.github.io/splice/. New site files
  must be added to its copy step and, if needed offline, to `SHELL` in `sw.js`.
- `LICENSE.md`: PolyForm Noncommercial 1.0.0, as Kiln.
- `spike/`: the throwaway prototype the design numbers came from. Not part of the game.
- `docs/superpowers/`: the spec and the plan for the core loop.

## Core (`src/core.js`)

Sections are marked `/* ---------- name ---------- */`. A level's board is a `Map` from
`key(r, c)` (`r * 16 + c`) to a colour `0..5`. Positions are in bubble radii: `centre(r, c)`,
row height `RH` = sqrt(3). Rows are offset: `cellsIn(cols, r)` is `cols` on even rows and
one fewer on odd rows.

- **random**: `mulberry32`, `hash`. No `Math.random` anywhere in `src/`.
- **geometry**: `nbrs(cols, r, c)`, `connected(grid, cols)` (flood fill from row 0).
- **shots**: `viewTop`/`shooterPos` (`viewTop` is the ideal top row: lowest bubble row minus
  `winRows - 5`, so the lowest bubble starts 4 rows above the shooter). The real view is
  `S.top`: set by `startState`. After a `fire` it becomes `min(S.top, viewTop)` only when the
  lowest bubble is in the top `SCROLL_AT` (2) visible rows or above them, so the level slides down
  in steps once the screen is nearly cleared (or once `SCROLL_FEW` (8) or fewer bubbles are on
  screen), and never retracts when bubbles land lower. The shooter sits at
  `S.top + winRows - 1`; `shooterPos(grid, cols, top)` and `trace(grid, cols, ang, top)` default
  `top` to `viewTop`, `fire`/`deal` pass `S.top`. Loss line: `lossRow(S)` = `S.top + winRows - 2`,
  the row above the shooter; `lost(S)` is no shots left or any bubble at or below it.
  `clampAim` (null if aiming down, else keeps `MIN_ANGLE` off the horizon); `trace` steps 0.25
  radii with wall bounces and returns `{pts, cell}` (`HIT` is 0.82 of a bubble diameter);
  `snap` picks the nearest free cell that touches the ceiling or a bubble.
- **deal**: `startState(level, fails)` builds the state `S` (`grid, shots, score, cur, next,
  hist, draws, ...`). `deal(S)` draws a colour still on the board, seeded from
  `(level, fails, draws)`. A visible colour weighs `1 + VIS_W * its share of the visible
  bubbles` (`VIS_W` = 3), so a colour that dominates the screen comes most often; colours only
  off-screen weigh `OFFSCREEN_W` (0.3). The same colour three times in a row is avoided, and a
  repeat is rerolled once, except for the only colour on screen.
- **moves**: `swap`, `won`, `lost`, `fire(S, ang)` (returns `{pts, cell, popped, dropped,
  points}` or null; score is `10 * popped + 10 * dropped^2`; after a shot, `cur` and `next`
  are re-dealt if their colour left the board).
- **saves**: `toSave`, `fromSave`, `validSave` (version `v: 1`). Saves include `top`; an old save without it fails
  validation and restarts its level.

`core.js` and `levels.js` import each other. Uses of the imported names stay inside
function bodies, so keep it that way.

## Levels (`src/levels.js`)

- `difficulty(level)` ramps to 1 at level 40. `isLong(level)`: every 5th level is longer.
  `winRows(cols)` is the visible height in rows.
- `makeLayout(level)` (cached, last 4 levels) depends on the level only. Kind is `designed` or `noise`
  (noise 25% of levels from level 3, never mixed). Columns are 8, 10 or 12, 3 to 6 colours.
  Designed levels stack screens of seeded shapes (hanging lines, rhombus, circle or ring,
  downward triangle, chevron, diagonal bar, shelf), optionally mirrored, each shape or band one group. `addStems` joins loose
  parts to the ceiling. Noise is full rows, every bubble its own group.
- `colourize(layout, level, fails)`: colours groups so touching groups differ where
  possible. Retry (`fails`) keeps the layout and reshuffles the colours.
- Shot limit: `shotLimit(layout)` = `ceil(k * bubbles^cells * colours^colours * cols^cols)`
  (at least 1) with `SHOT_K` per kind holding `k` and the exponents. More colours need far
  more shots per bubble (the bot needs about 0.055 at 3 colours, 0.10 designed and 0.17
  noise at 6), so the colour exponent is large (0.86 designed, 1.87 noise); wider boards
  need fewer. Difficulty stops rising at level 40, so the features and limits stay in the
  same range beyond it. `shotsFor(base, fails)`
  adds 10% per fail from the 4th, capped at +40%.
- Calibration (`tools/fit.mjs`, levels 1-240, 4 colourings each, alternate levels of each
  kind held out): `k` is scaled until the bot wins at least 95% in every difficulty band of
  the training half. Sim with the shipped constants, fails 0 to 3 (no easing):
  designed 1-10 100% / 34% median shots left, 11-25 94% / 38%, 26-40 98% / 34%;
  unseen levels 241-320: designed 96% / 35%, noise 100% / 31%; noise 1-40 100% / 22 to 50%
  (only six noise levels exist below 41). The spec's 5 to 15% shots left is not reachable
  at 95% wins: the shots one level needs vary by about 20% (log sd 0.2) across colourings
  alone, so a 95% win rate needs a limit about 1.4 times the typical need. Noise wins 100%
  because its few early levels set the scale; tighten the noise `k` if noise feels easy.
  Rerun `node tools/fit.mjs` after any change to generation, rules or the bot.

## UI (`src/ui.js`)

- Language: top-level `await` loads `lang/languages.json`, then `setLang(code)` merges
  `en.json` with the chosen file into `T`. Choice: `localStorage['splice-lang']`, else the
  first `navigator.languages` match, else English. `t('key', {n})` fills placeholders.
  Never put visible text in code; add a key to every `lang/*.json` instead.
- Look: `THEMES` (accent and background, picked by level), six `HUES` with a symbol each
  (`sym`), so colour is never the only cue. `bubble()` draws one packet.
- View and scrolling: `fit()` sizes the canvas to the screen; `S` is in bubble radii and
  `sc` is px per radius. `view` is the top row shown and eases toward `S.top` (instantly
  with reduced motion). The ceiling line is drawn only when row 0 is on screen; a dashed loss line sits between `lossRow` and the row above.
- Input: pointer drag aims (`setAim`), release fires (`shoot`). Only the pointer that started
  the aim (`aimId`) moves and fires it; a second pointer during an aim cancels it without a
  shot. A touch that starts in the strip at the shooter's height swaps `cur` and `next` and
  never aims or fires. The mouse wheel also swaps (one swap per gesture). Swapping works
  any time no sheet is open, also while a packet flies. Aiming and firing wait until the
  packet has landed, the view has settled and no sheet is open (`ready()`).
- Animation: the packet follows the traced `pts`; `land()` then adds pop, fall (glitch
  jitter seeded from the key) and a `-n` text (only for drops of 6 or more). With reduced motion, results show at once.
- Sheets: one sheet for win ("Root access"), loss ("Flatline") and the restart question.
  Next level and Try again start a new state. Restart in the HUD asks first (`asking`);
  only its confirm button restarts the level, which does not count as a fail. Keep
  playing, a tap outside the card or Escape closes it.
- Saving: `S` is saved whole to `localStorage['splice-v1']` after every shot and swap;
  if the save fails `validSave` but holds an integer `level` >= 1, `load()` starts that
  level fresh (keeping a valid `fails`); a missing or unreadable save starts level 1.

## Not built yet

The deployed build is a prototype (a "Prototype, work in progress" line under the board).
No self-hosted font (it still uses the system monospace), English only,
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
