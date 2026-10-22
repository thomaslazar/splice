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
- Balance: `node tools/sim.mjs [levels] [runs]`, e.g. `node tools/sim.mjs 3,25,50 3` or
  `node tools/sim.mjs 1-60 4`. Without arguments it plays levels 1, 3, 5, 10 ... 60 once.
  Run `r` plays with `fails = r`. Per level it shows the limit, the shots the bot needed and
  the margin; the bot always wins, since the limit comes from it.

## Files

- `index.html`: markup (HUD, canvas, result sheet). `style.css`: all styles.
- `src/core.js`: rules, pure (no DOM, no storage). Tested in `tests/core.test.mjs`.
- `src/levels.js`: level generation, colouring, fail easing, pure. Tested in `tests/levels.test.mjs`.
- `src/ui.js`: language, rendering, input, animation, sheets, saving.
- `src/hostdraw.js`: `drawHost(g, host, x, y, size, colour, glitch, t)`, the six host shapes on a 2D
  context, DOM-free. Tested in `tests/hostdraw.test.mjs` (a stub context).
- `lang/`: all visible text. `languages.json` maps codes to own-language names (only `en`
  now); `<code>.json` holds flat `"key": "text"` pairs with `{placeholders}`.
  `tests/lang.test.mjs` checks the lang files.
- `src/bot.js`: greedy bot over the core API, pure; sets each attempt's shot limit. Tested in
  `tests/bot.test.mjs`. `tools/sim.mjs`: balance report with it.
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
  `(level, fails, draws)`. A reachable colour (a bubble on screen touching the open space that
  connects to the row above the loss line, found by flood fill in `reachable(S)`) weighs
  `1 + VIS_W * its share of the reachable bubbles` (`VIS_W` = 3); a colour on screen but blocked
  weighs `BLOCKED_W` (0.9), one only off-screen `OFFSCREEN_W` (0.3). On a board like the owner's
  playtest (one reachable colour, three blocked ones) the reachable colour comes about 60% of the time. If nothing is reachable, visible bubbles count instead. The
  same colour three times in a row is avoided, and a repeat is rerolled once, except for the
  only reachable colour.
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
- Shot limit (`src/bot.js`, called from `startState`): the bot plays a copy of the exact
  attempt (layout, colours, dealing) with no limit; the limit is `limitFor(used)` =
  `ceil(used * HUMAN_K + HUMAN_C)` (1.4 and 3), then `shotsFor(base, fails)` adds 10% per fail
  from the 4th, capped at +40%. The bot tries 120 angles with and without a swap and scores
  `popped + 2 * dropped`, minus a penalty near the loss line; it aims perfectly and sees
  off-screen bubbles, hence the human factor. Results are cached per `(level, fails)` (restart
  replays). It costs about 0.15 s early and up to about 1 s on the largest levels (Mac, node).
  This replaced a layout formula: the colour shuffle alone moved a level's need by 20 to 40%,
  so formula limits were too tight on some levels and far too loose on others. Tune
  `HUMAN_K`/`HUMAN_C` by playtest.

## UI (`src/ui.js`)

- Language: top-level `await` loads `lang/languages.json`, then `setLang(code)` merges
  `en.json` with the chosen file into `T`. Choice: `localStorage['splice-lang']`, else the
  first `navigator.languages` match, else English. `t('key', {n})` fills placeholders.
  Never put visible text in code; add a key to every `lang/*.json` instead.
- Look: `themeFor(level)` from `src/hosts.js` (accent and background), six `HUES` with a symbol each
  (`sym`), so colour is never the only cue. `bubble()` draws one packet.
- HUD (DOM): header ("Jacked in" over `hostFor(level).label`, wrapping to two lines at most;
  level over score; Restart), corner brackets (`#frame::after`), packets bar (up to 20 segments,
  each `ceil(maxShots / 20)` shots), two reserved log lines, and a full-screen scanline overlay
  (`#scan`, `pointer-events: none`). `fit()` subtracts all of it from the height.
- View and scrolling: `fit()` sizes the canvas to the screen; `S` is in bubble radii and
  `sc` is px per radius. `view` is the top row shown and eases toward `S.top` (instantly
  with reduced motion). The ceiling line is drawn only when row 0 is on screen; a dashed loss line sits between `lossRow` and the row above.
- Input: pointer drag aims (`setAim`), release fires (`shoot`). Only the pointer that started
  the aim (`aimId`) moves and fires it; a second pointer during an aim cancels it without a
  shot. Every level start (`begin(level, fails)`: next level, retry, confirmed restart, first load)
  shows a full-screen loading card ("Level n" / "Preparing new attack vector" with a blinking
  cursor) for at least `LOAD_MIN` (500 ms) while `startState` runs the bot. Board touches are ignored for `GRACE` (400 ms) after any sheet closes or a level starts, so a
  lingering tap on a sheet button never fires. A touch that starts in the strip at the shooter's height swaps `cur` and `next` and
  never aims or fires. The mouse wheel also swaps (one swap per gesture). Swapping works
  any time no sheet is open, also while a packet flies. Aiming and firing wait until the
  packet has landed, the view has settled and no sheet is open (`ready()`).
- Host strip (`#strip`, a canvas above the frame): zero height until `S.top === 0`, then opens
  over `STRIP_MS` (400 ms, instant with reduced motion) to `STRIP` (two rows), refitting every
  frame; it opens only when no packet flies, and `ready()` waits until it is fully open. Open at
  once when a level starts or loads at the ceiling.
- Win sequence (`win`): after the winning shot lands, the root access log line, `QUIET` (600 ms),
  `GLITCH` (500 ms, the host flickers into the accent colour; reduced motion switches at once),
  then the sheet. Swaps, wheel and Restart are ignored meanwhile (`busy()`). A reload on a won
  board shows the sheet at once with the host in the accent colour.
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

- Splice shares its origin (thomaslazar.github.io) with Kiln: every `localStorage` key and
  cache name must start with `splice-` (now `splice-v1`, `splice-lang`, `splice-1`), and
  `sw.js` only deletes `splice-` caches.
- Always ask before committing. Conventional Commits. Never add `Co-Authored-By:` or
  "Generated with" lines to commits or PR bodies.
- No em-dashes in UI copy or docs. Use typographic apostrophes (’) in visible text.
- Rerun `node --test` and the sim after rule or balance changes.
