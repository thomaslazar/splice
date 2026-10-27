# Splice: agent notes

Splice is an ad-free, cyberpunk bubble shooter for phones (vanilla HTML, CSS and ES modules,
no build step, no dependencies). Aim at the bottom, fire a packet into the hanging cluster;
three or more of one colour pop, and anything cut off from the ceiling falls. Levels are
generated endlessly. It is a personal hobby project and a sibling of Kiln (`../kiln`).

Read before changing behaviour:
- `docs/superpowers/specs/2026-10-21-core-loop-design.md`: the design and the numbers from the
  playtested prototype. Where this file and the spec disagree, the spec wins.
- `docs/superpowers/specs/2026-10-22-visual-pass-design.md`: the HUD, hosts, run log, win
  sequence and font.
- `docs/superpowers/specs/2026-10-23-difficulty-pass-design.md`: hardness, generation changes
  and ICE.
- `CONTRIBUTING.md`: code, copy and commit conventions. Follow them.

## Commands

- Run: serve the folder (`python3 -m http.server 8080`) and open http://localhost:8080/.
  `file://` does not work (ES modules, `fetch` for `lang/`). Avoid port 8000 on the owner's
  phone: Kiln's service worker controls that origin and mixes its files in.
  The service worker is network first (revalidates, 3 s timeout, cache only as offline
  fallback). `CACHE` is `splice-5`. Rename it when `sw.js` changes how it caches or the `SHELL`
  list changes, so `activate` drops the old cache. The fonts are in `SHELL`.
- Test: `node --test` (not `node --test tests/`, which fails on newer Node).
- Balance: `node tools/sim.mjs [levels] [runs]`, e.g. `node tools/sim.mjs 3,25,50 3` or
  `node tools/sim.mjs 1-60 4`. Without arguments it plays levels 1, 3, 5, 10 ... 60 once.
  Run `r` plays with `fails = r`. Per level it shows the limit, the shots the bot needed and
  the margin; the bot always wins, since the limit comes from it.
  `node tools/sim.mjs [levels] --clears` (default levels 1-80) plays each level once with
  `fails = 0` and reports big clears per kind and hardness band (`hband`: four quarters of
  `hardness`): levels, wins, shots, big clears, per level and per shot. A big clear is one
  shot removing at least half of the bubbles on screen while 12 or more are shown. Judge it
  per shot, not per level: hard bands are mostly long levels with about 1.9x the shots. First
  run after the balance pass (levels 1-80), designed per shot 28.9 / 25.1 / 20.9 / 18.3% from
  easiest to hardest band, noise 10.5 / 10.3 / 6.0 / 4.7%; the bot won all 80. A level the 400-shot cap stops is
  reported on stderr.

## Files

- `index.html`: markup (HUD, host strip, board, packets bar, log, sheets, scanline overlay). `style.css`: all styles.
- `src/core.js`: rules, pure (no DOM, no storage). Tested in `tests/core.test.mjs`.
- `src/levels.js`: level generation, colouring, fail easing, pure. Tested in `tests/levels.test.mjs`.
- `src/ui.js`: language, rendering, input, animation, sheets, saving.
- `src/hosts.js`: `hostFor(level)` (the host system for a level), `themeFor(level)` (accent and
  background), `tierFor(level)`, `iceFor(level)` (the level's ICE, or null), pure. Tested in `tests/hosts.test.mjs`.
- `src/hostdraw.js`: `drawHost(g, host, x, y, size, colour, glitch, t, apart)`, the six host shapes on a 2D
  context, DOM-free. Tested in `tests/hostdraw.test.mjs` (a stub context).
- `lang/`: all visible text. `languages.json` maps codes to own-language names (only `en`
  now); `<code>.json` holds flat `"key": "text"` pairs with `{placeholders}`.
  `tests/lang.test.mjs` checks the lang files.
- `src/run.js`: run rules, pure: `runFrom` (saved run or fallback), `enter` (best level and its earned fails), `clampLevel`. Tested in
  `tests/run.test.mjs`.
- `src/items.js`: item table, `PRICES`, `unlocked`, `lootFor`, deck helpers (`deckFrom`, `buy`, `take`, `give`,
  `owned`), item bubbles (`ITEM_BASE`, `itemPlan`, `placeItems`), `resolve`, `hits`, `useItem`, `unload`, `payout`; pure. `src/icons.js`: `ICONS`, one drawing per item.
- `src/bot.js`: greedy bot over the core API, pure; sets each attempt's shot limit. Tested in
  `tests/bot.test.mjs`. `tools/sim.mjs`: balance report with it.
- `fonts/`: Chakra Petch (latin 400 and 600, woff2), self-hosted, with `OFL.txt`. `style.css`
  declares it; `index.html` preloads the 600 weight.
- `manifest.webmanifest`, `sw.js`, `icons/`: PWA. `icons/icon.svg` is the source; the PNGs
  are renders of it (192, 512, maskable 512 at 80% scale, 180 for Apple), made with
  `qlmanage -t -s 512` and `sips -z`.
- `.github/workflows/pages.yml`: runs `node --test` on pull requests and pushes; on push to
  `master` it deploys the site files to https://thomaslazar.github.io/splice/. New site files
  must be added to its copy step (`cp -r` of `index.html style.css manifest.webmanifest sw.js src
  icons lang fonts`) and, if needed offline, to `SHELL` in `sw.js`.
- `LICENSE.md`: PolyForm Noncommercial 1.0.0, as Kiln.
- `spike/`: the throwaway prototype the design numbers came from. Not part of the game.
- `docs/superpowers/`: the specs and plans (core loop, visual pass, difficulty pass).

## Core (`src/core.js`)

Sections are marked `/* ---------- name ---------- */`. A level's board is a `Map` from
`key(r, c)` (`r * 16 + c`) to a colour `0..5`, or from `ITEM_BASE` (6) up an item bubble (`SHOTS[v - ITEM_BASE]`). Positions are in bubble radii: `centre(r, c)`,
row height `RH` = sqrt(3). Rows are offset: `cellsIn(cols, r)` is `cols` on even rows and
one fewer on odd rows.

- **random**: `mulberry32`, `hash`. No `Math.random` anywhere in `src/`.
- **geometry**: `nbrs(cols, r, c)`, `connected(grid, cols)` (flood fill from row 0).
- **shots**: `viewTop`/`shooterPos` (`viewTop` is the ideal top row: lowest bubble row minus
  `winRows - 5`, so the lowest bubble starts 4 rows above the shooter). The real view is
  `S.top`: set by `startState`. After a `fire` it becomes `min(S.top, viewTop)` only when the
  lowest bubble is in the top `SCROLL_AT` (2) visible rows or above them, so the level slides down
  in steps once the screen is nearly cleared (or once `SCROLL_FEW` (10) or fewer bubbles are on
  screen), and never retracts when bubbles land lower. The shooter sits at
  `S.top + winRows - 1`; `shooterPos(grid, cols, top)` and `trace(grid, cols, ang, top)` default
  `top` to `viewTop`, `fire`/`deal` pass `S.top`. Loss line: `lossRow(S)` = `S.top + winRows - 2`,
  the row above the shooter; `lost(S)` is no shots left or any bubble at or below it.
  `clampAim` (null if aiming down, else keeps `MIN_ANGLE` off the horizon); `trace` steps 0.25
  radii with wall bounces and returns `{pts, cell}` (`HIT` is 0.82 of a bubble diameter);
  `snap` picks the nearest free cell that touches the ceiling or a bubble.
- **deal**: `startState(level, fails)` builds the state `S` (`grid, shots, score, cur, next,
  hist, draws, frags, load, breaker, ...`: `frags` pending frags from dropped bubbles, `load` the loaded shot
  item or null, `breaker` shots left of the ICE breaker). `deal(S)` draws a colour still on the board, seeded from
  `(level, fails, draws)`. A reachable colour (a bubble on screen touching the open space that
  connects to the row above the loss line, found by flood fill in `reachable(S)`) weighs
  `1 + VIS_W * (half its share of the reachable bubbles + half its share of reachable bubbles that
  already have a same-colour neighbour)` (`VIS_W` = 3, `PAIR_MIX` = .5), so colours that can complete a
  match come more often; a colour on screen but blocked
  weighs `BLOCKED_W` (0.9), one only off-screen `OFFSCREEN_W` (0.3). On a board like the owner's
  playtest (one reachable colour, three blocked ones) the reachable colour comes about 60% of the time. If nothing is reachable, visible bubbles count instead. The
  same colour three times in a row is avoided, and a repeat is rerolled once, except for the
  only reachable colour.
- **moves**: `swap`, `won`, `lost`, `fire(S, ang)` (returns `{pts, cell, popped, dropped,
  points}` or null; score is `10 * popped + 10 * dropped^2`; after a shot, `cur` and `next`
  are re-dealt if their colour left the board). `settle(S, popped, extra, advance)` is the shared tail of every
  shot: removes popped bubbles, drops what lost the ceiling (dropped ones add to `S.frags`), scores, scrolls and
  re-deals missing colours; `advance` (normal shots only) also moves next to cur and spends a shot. `flood(S, start, col)`
  is the same-colour group. `fire` has an item branch: with `S.load` set it flies the item through `hits()` instead of
  the packet (no shot spent, packets stay); it returns null when the item would change nothing, and the item stays
  loaded. `isColour(v)` is 0..5.
  `fire` runs `resolve(S, {ang, id?})` from `src/items.js` (a pure play on a copy of the grid: landing, pops, touched item bubbles
  and their chains, each once) and also returns `recolour` and `fired` (the item bubbles that went off). A normal shot
  that lands next to an item bubble sets it off.
- **saves**: `toSave`, `fromSave`, `validSave` (version `v: 2`). Saves include `top`; an older save (v 1, or without `top`) fails
  validation and restarts its level. `S.maxShots` (the starting shot limit) and `S.startLow`
  (the lowest bubble row at the start) feed the packets bar and the log; an older save without
  them gets defaults in `fromSave`.

`core.js` and `levels.js` import each other. Uses of the imported names stay inside
function bodies, so keep it that way.

## Levels (`src/levels.js`)

- `difficulty(level)` ramps to 1 at level 40. `isLong(level)`: every 5th level is longer.
  `hardness(level)` = `(runPos(level) - 1) / 29` over runs of `RUN` = 30 levels (`runPos` 1..30):
  a sawtooth, 0 at levels 1, 31, 61 ... and 1 at 30, 60, 90 ... Unlike `difficulty` it never
  saturates; it drives how fragmented a level is, and the run position decides ICE.
  `winRows(cols)` is the visible height in rows.
- `makeLayout(level)` (cached, last 4 levels) depends on the level only. Kind is `designed` or `noise`
  (noise 25% of levels from level 3, never mixed). Columns are 8, 10 or 12, 3 to 6 colours.
  Designed levels stack screens of seeded shapes (hanging lines, rhombus, circle or ring,
  downward triangle, chevron, diagonal bar, shelf), optionally mirrored, each shape or band one group.
  Hardness breaks groups up, using the board's share `h = boardHardness(level)` (hardness,
  three quarters on levels with ICE so ICE does not stack on the hardest boards; all draws seeded): per shape, with
  probability `0.7 h` (`SPLIT`) the right half of a mirrored shape becomes its own group (axis cells stay
  left), and each shape is cut at x positions into 2 segments (3 with probability `0.7 h`); a
  group of 6 or more bubbles takes the cuts with probability `0.7 h`. `addStems` joins loose
  parts to the ceiling with 1 + `min(2, floor(2h + rnd))` stems per structure, the extra ones
  at the left and right ends of its top edge (about 2 or more columns from the main stem);
  mirrored layouts get mirrored stems. Noise is full rows, every bubble its own group.
- `colourize(layout, level, fails)`: colours groups so touching groups differ where
  possible. Retry (`fails`) keeps the layout and reshuffles the colours. Noise is clumpy: a
  bubble copies a coloured neighbour's colour with probability `0.45 - 0.20 * boardHardness`, else
  draws a random colour, so easy noise levels have big same-colour clumps and hard ones are
  nearly uniform.
- Shot limit (`src/bot.js`, called from `startState`): the bot plays copies of the exact
  attempt (layout, colours) with no limit, three times with different colour luck
  (`solve(S, salt)`; `deal()` mixes `S.salt` into its seed), and `needFor(S)` takes the middle
  result, so one lucky or unlucky run does not set the limit (owner, issue #2). The limit is
  `limitFor(need, ice)` = `ceil(need * HUMAN_K * k + HUMAN_C)` (1.4 and 3; `k` is
  `ICE_TYPE_K[ice] ?? ICE_K[ICE[ice]]` for a level with
  ICE, else 1; the constant 3 is not scaled), then `shotsFor(base, fails)` adds 10% per fail
  from the 4th, capped at +40%. The bot tries 120 angles with and without a swap and scores
  `popped + 2 * dropped`, minus a penalty near the loss line; it aims perfectly and sees
  off-screen bubbles, hence the human factor. Results are cached per `(level, fails)` (restart
  replays; ICE depends on the level only, so the key is enough). It costs about 0.15 s early and up to about 1 s on the largest levels (Mac, node).
  This replaced a layout formula: the colour shuffle alone moved a level's need by 20 to 40%,
  so formula limits were too tight on some levels and far too loose on others. Tune
  `HUMAN_K`/`HUMAN_C` by playtest.

## Hosts (`src/hosts.js`)

Each level breaks into a fictional host, `hostFor(level)`: `{owner, gov, industry, system, tier,
label, shape, hue, params}`. `label` is `OWNER // SYSTEM` in capitals. Pure and deterministic
(seeded from the level), settled in level order and cached.

- Tier (`tierFor`): `small` (small-time), `corporate` or `high` (high stakes), a seeded roll
  weighted by `d = difficulty`: small `0.15 + 0.85 * (1 - d)`, high `0.3 * d`, corporate the
  rest, so small-time stays possible at every difficulty. Long levels (`isLong`)
  are always high. A tier has its own industries and the systems it may hit.
- Corporations recur: each tier has a pool of 24 per 30-level stretch (`pool`), so a name comes
  back within a stretch. Name patterns differ per tier (pair of surnames, coined, surname,
  initials). The drawn pattern gets 8 tries to fit a label within 40 before any pattern may
  be used, so long pairs do not all turn into initials.
- Government: about 1 level in 6 (`r() < 1/6`) targets a fictional body, with its own system
  list per tier and a made-up jurisdiction.
- Variety: a system is rerolled up to three times away from the last three levels'; the same
  owner and system never appear on two levels in a row.
- No real names. `tests/hosts.test.mjs` holds a deny list of real brands and agencies; the
  initials use no vowels, B or G, and skip a hand list (`REAL`). Add to it if one slips through.
- Labels stay within 52 characters (95% within 40); the header wraps to two lines at most.
- Shape (`SHAPES`): from the system, one of six drawn by `hostdraw.js`. `hue` is a bubble hue
  that is never the accent's hue.

## ICE (`src/hosts.js`, `src/bot.js`, `src/ui.js`)

A level from hardness 0.5 up may carry one ICE (intrusion countermeasure) that makes aiming
or reading the board harder. Every ICE check in the UI goes through `iceOn()` (none while the ICE breaker
runs), never `ice` directly, except the breaker's own end message and drawer button. `iceFor(level)` returns its type or null; pure, seeded
(`hash(level, 13)`, two draws always taken so the chance and the pick never shift each
other). It is not saved: it is recomputed from the level.

- Schedule (owner: ICE is part of the run's climb, not a dice roll): by run position, none at
  1-11, every other level 12-20 (even positions, mild only), every level 21-26 (up to medium) and
  27-30 (up to harsh), always capped by the host's tier: 15 of every 30 levels. Black only at
  27-30 on high stakes. In the mild and harsh stretches all allowed types are equally likely (at
  27-30 a high-stakes host always gets a harsh type); the industry flavour picks in between. A
  level with ICE gets a board at three quarters of its hardness (`boardHardness`). Jitter weighs a third of any other type everywhere (owner: it annoys). Shares over
  1-2000: static 40%, jitter 15%, scrambler 14%, lock 13%, monochrome 6%, black 6%, jam 6%.
- Local playtest: `?ice=<type>` forces that ICE on every level (effects only; the limit stays the
  level's own) and `?level=N` starts level N fresh, e.g. `http://localhost:8080/?ice=black&level=12`.
- Types and severity (`ICE`): mild `static`, `jitter`; medium `scrambler`, `lock`, `jam`;
  harsh `monochrome`, `black`. Shot-limit factor per severity (`ICE_K`): mild 1.1, medium
  1.25, harsh 1.5, applied by `limitFor` in `src/bot.js`; scrambler overrides it with 1.1 (`ICE_TYPE_K`: shooting a
  wrong colour away is cheap, so it gets less room) (the bot itself plays without ICE:
  it aims perfectly and ignores every effect, so the factor only pays the human for it).
- Who runs what: the host's tier caps severity (`CAP`: small mild, corporate up to medium,
  high up to harsh). `black` also needs hardness 0.8 or more and a `high` host. A host picks
  from its industry's liked types (`LIKES`: security `scrambler`, `lock`, `static`; media and
  telecom `static`, `jitter`; finance and insurance `scrambler`, `jitter`; ai `jitter`,
  `monochrome`; defense `black`, `monochrome`, `lock`; aerospace `black`, `lock`; biotech and
  pharma `static`, `scrambler`, `jam`; energy and logistics `jam`, `scrambler`, `static`),
  government hosts from `GOV_LIKES` by tier (small none, corporate `scrambler`, `static`,
  `lock`, high `monochrome`, `black`, `lock`), filtered by the cap and the `black` rule. If
  nothing is left it takes any allowed type. The first liked type is weighted 2, the others 1
  (tune by playing). Over levels 1-2000 each type is 5% to 45% of the levels with ICE
  (`tests/hosts.test.mjs`).
- UI (`ui.js`, `FX` table, `fxOf()` returns the active type's hooks; only drawing and
  swapping change, firing, landing and dealing are the same as without ICE):
  - `jam`: the aim line stops at the first wall bounce or after `JAM_LEN` (8 radii, about four
    bubbles), whichever is shorter (`short`), so it also bites on levels without bounces, and the
    landing ring is hidden while jammed. Dropping `JAM_DROP` (10) or more bubbles (not on a winning or losing
    shot) restores the full line for the next 3 shots (`restore`), logged as `targeting
    restored (n)`, flashed mid-screen ("Targeting restored: 3 shots", accent colour) and, when
    the count runs out, `targeting jammed`. A reload starts jammed. The jammed line is steel grey
    (`JAMMED`), broken and flickering (steady with reduced motion); restored it is the accent again.
  - `jitter`: the aim angle wobbles a few degrees (two slow sines, `bend`); the line, the landing
    ring and the shot all use the angle on screen at release (`drawn`), so the line never lies
    and the challenge is timing (owner, issue #4). With reduced motion it is steady and the line
    is cut at the first bounce.
  - `static`: 3 blocks of grey noise about 2 x 2 bubbles drift over the board above the loss
    line, never the shooter zone (`glitchBlocks`, drawn by `over`). They hide the board but
    not the flying packet or the pop and fall effects (those draw after them). Reduced
    motion: fixed blocks.
  - `scrambler`: each new packet arrives hidden with chance `SCRAMBLE` (0.4, seeded from
    `S.draws`); a hidden packet stays a grey "?" in the next slot and at the shooter and shows only
    in flight, so two blind packets in a row happen (owner, issue #3). `hid = [cur, next]`, a swap
    swaps them, the landing ring turns grey for a hidden one; a reload shows the shooter packet.
  - `lock`: swapping (strip touch and wheel) is ignored and a small padlock marks the next
    packet.
  - `monochrome`: bubbles draw in one neutral tone with brighter, thicker symbols, and the
    target ring is neutral. The host strip keeps its colours.
  - `black`: no aim line and no landing ring at all.
- Announcements: the header shows a bordered tag (`#ice`) after "Jacked in" with the ICE name
  (`iceStatic` and so on in `lang/`), and the log gets `ice detected: {ice}` right after
  `connecting to {host}` at level start. A fresh start (`begin()`: next level, retry, restart,
  menu jump, `?ice=`) also flashes `{ice} deployed` mid-screen in the accent colour (`#alert`,
  `flash('ice')`, about 2.8 s) after the loading card; a reload of a saved board does not.

## UI (`src/ui.js`)

- Language: top-level `await` loads `lang/languages.json`, then `setLang(code)` merges
  `en.json` with the chosen file into `T`. Choice: `localStorage['splice-lang']`, else the
  first `navigator.languages` match, else English. `t('key', {n})` fills placeholders.
  Never put visible text in code; add a key to every `lang/*.json` instead.
- Look: `themeFor(level)` from `src/hosts.js` (accent and background), six `HUES` with a symbol each
  (`sym`), so colour is never the only cue. `bubble()` draws one packet. Text uses Chakra Petch
  with a monospace fallback (the log stays monospace).
- HUD (DOM): header ("Jacked in" over `hostFor(level).label`, wrapping to two lines at most;
  level over pending frags `ƒ n` (dim `ƒ –` when the level will not pay), not the score; menu button), corner brackets (`#frame::after`), packets bar (up to 20 segments,
  each `ceil(maxShots / 20)` shots; lit ones are the shots left, `S.maxShots` is set by
  `startState`), two reserved log lines, and a full-screen scanline overlay
  (`#scan`, `pointer-events: none`). `fit()` subtracts all of it from the height.
- View and scrolling: `fit()` sizes the canvas to the screen; `S` is in bubble radii and
  `sc` is px per radius. `view` is the top row shown and eases toward `S.top` (instantly
  with reduced motion). The ceiling line is drawn only when row 0 is on screen; a dashed loss line sits between `lossRow` and the row above.
- Input: pointer drag aims (`setAim`), release fires (`shoot`). Only the pointer that started
  the aim (`aimId`) moves and fires it; a second pointer during an aim cancels it without a
  shot. Every level start (`begin(level, fails)`: next level, retry, confirmed restart, first load)
  shows a full-screen loading card ("Level n" / "Preparing new attack vector" with a blinking
  cursor) for at least `LOAD_MIN` (500 ms) while `startState` runs the bot. Board touches are ignored for `GRACE` (400 ms) after any sheet closes or a level starts, so a
  lingering tap on a sheet button never fires. Dragging below the dashed loss line cancels the aim (release there fires nothing; moving back up resumes). A touch that starts in the strip at the shooter's height swaps `cur` and `next` and
  never aims or fires. The mouse wheel also swaps (one swap per gesture). Swapping works
  any time no sheet is open, also while a packet flies. Aiming and firing wait until the
  packet has landed, the view has settled and no sheet is open (`ready()`).
- Run log (in memory only, two lines, newest on top, all text in `lang/`): `connecting to
  {host}` at level start (then `ice detected: {ice}` on a level with ICE); after each landed shot, in this order: `ice layer breached (n
  nodes)` for 6 or more dropped, `deeper: p% of the way in` when the view scrolled and the
  progress changed (`pct()`: lowest bubble against `S.startLow`, steps of 5), then once per
  level `host in range` (`S.top === 0`), `trace rising` (shots at or under 25% of `maxShots`) and
  `trace critical` (3 or fewer); then `connection lost` or `root access: {host}`. A flag that
  already holds at level start is set silently.
- Host strip (`#strip`, a canvas above the frame): zero height until `S.top === 0`, then opens
  over `STRIP_MS` (400 ms, instant with reduced motion) to `STRIP` (two rows), refitting every
  frame; it opens only when no packet flies, and `ready()` waits until it is fully open. Open at
  once when a level starts or loads at the ceiling.
- Running out of shots: at 25% or fewer the packets bar, its number and the loss line turn amber;
  at 3 or fewer they turn red and pulse (colours only with reduced motion). Same thresholds as the
  trace log lines; fixed colours in every theme. The two trace events also flash once, big, in the
  middle of the screen (`#alert`, "Trace rising" amber / "Trace critical" red, about 2.8 s, never
  blocks taps; static with reduced motion).
- No zoom and no landscape: the viewport sets `maximum-scale=1, user-scalable=no`, `gesturestart` and
  `gesturechange` are blocked (iOS ignores the meta), the second touchend of a quick double tap is
  cancelled outside buttons (iOS double-tap zoom), and phones held sideways (landscape, height
  500 px or less) get a full-screen "Turn your phone upright to play." card, as in Kiln.
- Win sequence (`win`): after the winning shot lands, the root access log line, `QUIET` (600 ms),
  `GLITCH` (1200 ms: the host bursts apart sideways in horizontal slices, quick at first then
  slowing, flickering into the accent colour, and stays in pieces; a reload on a won board shows
  the pieces in the accent; reduced motion switches colour at once),
  then the sheet. Swaps, wheel and the menu button are ignored meanwhile (`busy()`). A reload on a won
  board shows the sheet at once with the host in the accent colour.
- Animation: the packet follows the traced `pts`; `land()` then adds pop, fall (glitch
  jitter seeded from the key) and a `-n` text (only for drops of 6 or more). With reduced motion, results show at once.
- Menu (`#menu`, opened by the header button, which replaces Restart; ignored while a packet flies, loading or `busy()`): full-screen
  panel with tabs Run, Shop (buying, with demo popups) and Info; `menuText()` fills every text. Run: current and best level,
  Restart level and Start over (each asks first on the sheet, `asking` = `'restart'` or `'over'`; only the confirm button acts,
  restart is not a fail), Back to best level (when below it), a level stepper (`clampLevel`, 1..best) with the host's label and
  Play, then Reset progress (red, asks first, `asking` = `'reset'`: deletes `splice-v1`, `splice-run` and `splice-deck`, keeps `splice-lang`, restarts at level 1 with an empty deck; Start over keeps the deck). Info: name, blurb, how to play, Share (`navigator.share`, else copy the link and flash a "Link copied" note
  in `#alert`, else show the URL to copy by hand), GitHub link, licence, font credit and a language `<select>` from `LANGS`
  (change writes `splice-lang`, calls `setLang`, redraws, stays on Info). Keep playing, Escape closes.
- Sheets: one sheet for win ("Root access"), loss ("Flatline", with a rescue button when out of shots and an Overclock is held) and the three questions (restart, start over, reset).
  Next level and Try again start a new state. Keep playing, a tap outside the card or Escape closes it.
- Saving: `S` is saved whole to `localStorage['splice-v1']` after every shot and swap;
  if the save fails `validSave` but holds an integer `level` >= 1, `load()` starts that
  level fresh (keeping a valid `fails`); a missing or unreadable save starts level 1.
  The run (`localStorage['splice-run']`: `{best, fails, paid}`) is the best level reached and the fails earned on it, and `paid` is the level already paid, so it pays only once; set by
  `enter` in `begin`; replaying a lower level keeps it. A missing or invalid run falls back to `runFrom(o, level, fails)`,
  and best is never below the current level.

## Items (`src/items.js`, `src/ui.js`)

- Deck (`splice-deck`: `{frags, items}`, `deckFrom` repairs corrupt data): frags are the currency, items are
  counts. A first win of the best level pays frags and loot at the winning shot (`payout`); a level pays once
  (`run.paid`, in `splice-run`), so replays and reloads of a won board pay nothing. `pays()` drives header, loot and sheet.
- Shop tab buys items for frags (demo popup `#demo`); items unlock at levels 31, 61, 91 (flash). The drawer
  (`#deckBtn`, `#drawer`) loads an item as the packet, unloads it, fires instants, or does Rollback; it always opens, and its last button opens the Shop tab. The header frags (`shown`) count up one by one as dropped colour bubbles leave the screen.
- Item shots use no shot (builder's call, the spec is silent; easy to change in `fire`); Overclock adds 5. `S.frags`, `S.load` and `S.breaker` are in the save.
- A loaded item goes back to the deck when the level is left (`begin()`, and `load()` for a save that fails validation), except on Reset progress. An item with no effect at the aim cannot be fired (`hits` null, no preview). ICE breaker is only usable on a level with active ICE and not while it already runs (`useItem` refuses). Decrypt only offers and accepts colours (`isColour`). A tap outside the drawer, or the menu button, closes it.
- Rollback is disabled once a level is won or lost (builder's call: it is not a Flatline rescue, and it stops a double payout). Flatline rescue: a loss by shots offers Overclock (+5) on the sheet (`#sheetO`).
- Item bubbles on the board (grid values from `ITEM_BASE`, never dealt, never a colour). `itemPlan(level)`: none below level 3,
  else 25% of levels have them, a fifth of those `full` (3 per screen; code caps at 3, not 4), the rest `normal` (0 to 2 per screen). `placeItems`
  runs after colouring from the level only (same on every try). Screens: designed levels use row bands
  `[s*sec, (s+1)*sec)` with `sec = round(1.6 * cols)`; noise splits its occupied rows into `layout.screens` bands. An item bubble goes off
  when a landed packet or a shot touches it; its effect is the item's, centred on it. Chains: breadth first, each item bubble
  once, so two that reach each other cannot loop. Colour pops never set off item bubbles (only a landing next to one, or a shot or chain reaching it). A deck Wildcard always fires; any other deck item whose effect changes
  nothing cannot fire. They never count as colours (the winning test, `deal`), but count for the loss line and fall like any bubble.
- Bot (`src/bot.js`): plays item bubbles through `resolve`, only when the landing cell touches one; it never uses deck items.
- UI: `bubble()` hands grid values from `ITEM_BASE` to `itemBubble` (white in every theme, also monochrome; static blocks cover
  them). The normal-shot aim preview outlines `clear` and `popped` of `resolve` when the landing cell touches an item bubble,
  under the same rules as the landing ring (none with black ICE or a jammed line). A set-off flashes each fired bubble white
  (radius 1.3), then the clears pop; a falling item bubble just falls. Reduced motion: at once.
- Reset progress (Run tab) wipes level, frags and items.

## Not built yet

The deployed build is a prototype (a "Prototype, work in progress" line under the board).
English only, no sound.

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
- Font: Chakra Petch, self-hosted in `fonts/` with its OFL license, like Kiln.

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
  cache name must start with `splice-` (now `splice-v1`, `splice-lang`, `splice-run`, `splice-deck`, `splice-5`), and
  `sw.js` only deletes `splice-` caches.
- Always ask before committing. Conventional Commits. Never add `Co-Authored-By:` or
  "Generated with" lines to commits or PR bodies.
- No em-dashes in UI copy or docs. Use typographic apostrophes (’) in visible text.
- Rerun `node --test` and the sim after rule or balance changes.
