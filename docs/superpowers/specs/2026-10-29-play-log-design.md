# Play log design

## Intent

The shot limits feel uneven. Some levels end with 30 or more shots left, others are so tight the
owner retries them several times, yet never fails often enough (4 times) for the retry easing to
add shots. Items go unused: the owner hoards them because there is no clear moment where one is
worth it. And the swap strip had misfires that a recent change should have fixed, with no way to
know if it did.

A few friends playtest too. The owner wants real data from all of them, detailed enough for close
analysis, to tune shot limits, retry easing, ICE and item levels, and to find the "sweet spot"
where an item makes sense. The owner hands the files to Claude to analyse.

## Goals

- An opt-in play log that records every attempt, and every shot within it, on the player's phone.
- Sharing it as a file through the phone's share sheet, so a friend can send it as a DM in any
  chat.
- After a share goes through, the game asks whether to clear the log.
- A report tool, `tools/plays.mjs`, that reads one or more log files and prints the same summary
  each time, like `tools/sim.mjs`.

## Non-goals

- A level progress indicator (how far into a level you are, to judge whether Overclock is
  worth it). The owner wants it, but as a separate roadmap item.
- Any change to balance. The log only collects data; tuning comes after.
- Reading the log in the game. No stats screen.

## Anti-goals

- Sending anything without a tap. No network calls, no GitHub, no accounts, no server.
- Costing anything while off. With tracking off, nothing is recorded, nothing is stored, no work
  is done per shot.
- Getting in the way of play. The log never blocks, slows or breaks a shot; a full or broken log
  is dropped or trimmed, never an error the player sees.
- Personal data. No names; the sender is known from the chat.

## Decided by the owner

- Opt-in: off by default, a switch in the menu.
- Comprehensive: per attempt and per shot, not one summary line per level.
- Delivery: the phone's share sheet (a DM in some chat), not GitHub.
- Players: the owner and a few friends.
- Clearing: ask after a share. (The owner allowed a setting as well; see Builder's calls.)
- Analysis: Claude reads the files, helped by the report tool.

## What is recorded

### Per attempt

An attempt starts at `begin()` (next level, retry, restart, menu jump, first load) and ends with a
win, a loss, or leaving the level (another `begin()`, Start over, Reset progress). A reload mid
level continues the same attempt. Fields:

- `level`, `fails` (the fail count this attempt started with), `kind` (designed or noise),
  `cols`, colour count, `hardness`, `ice` (type or null), item level or not (`itemPlan`), and the
  number of item bubbles at the start.
- `limit` (`S.maxShots`), and the bot's need if it is at hand.
- `items`: the deck at the start (counts), and `frags` held.
- `end`: `won`, `lost` (with `shots` or `line` as the cause), or `left`.
- `left`: shots left at the end.
- `time`: active seconds, counted only while the page is visible.
- `paid`: frags and loot paid, if any.
- `at`: start time (ISO date and time).

### Per shot

One entry per fired shot (packet or item), in order:

- shot number, shots left before it, packet colour or item id.
- swaps since the last shot, each with its source (`tap`, `wheel`), and milliseconds from the last
  swap to the release.
- whether the aim started in the swap strip, aims cancelled below the line since the last shot,
  and aim time in milliseconds (press to release).
- angle, landing cell, popped, dropped, item bubbles set off.
- bubbles left on the board, and progress (`pct()`).
- in the same list, instant item uses (Overclock, Decrypt, ICE breaker, Rollback) as entries
  with their id and the shot number they came before.

Short keys and arrays keep it small (about 100 bytes per shot).

### File

`splice-plays-YYYY-MM-DD.json`:

- `v` (format version), the game build (`CACHE` name or a build stamp), `id` (a random
  anonymous id per install, stored under a `splice-` key, so two files from one phone can be told
  apart).
- the device: screen size in CSS pixels, pixel ratio, touch or mouse, reduced motion, language.
- `attempts`: the records, oldest first.

## Menu

A "Play log" block on the Run tab, above Reset progress:

- **Track plays** switch (off by default).
- Record count ("12 levels logged").
- **Share log**: `navigator.share` with the file. When the share resolves, the sheet asks "Clear
  the play log?" with Clear and Keep. A cancelled share asks nothing. Without file sharing, the
  file downloads instead, and the game asks the same question.
- **Clear log**: asks first on the sheet, like the other questions.

All text in `lang/`. Reset progress clears the log as well and keeps the switch as it is.

## Report tool

`node tools/plays.mjs <file> [file ...]` prints, per file and combined:

- Shots left on a win, per hardness band and per ICE, against the limit (share of the limit).
- Tries per level: how many attempts until the win, and how many levels took 2 or 3 tries (the
  gap below the retry easing at 4).
- Items: held against used, per attempt, and the state at each use (shots left, progress).
  Losses and close wins (few shots left) where items were held but not used.
- Swap signs: swaps within a short time before a release, quick double swaps, aims started in the
  strip, cancelled aims.
- Time per level.

Claude digs further by hand from the raw files.

## Builder's calls

- Storage: its own key, `splice-plays` (log) and `splice-plays-id` (install id), plus the switch
  in `splice-plays-on` or inside the log. Every key starts with `splice-`.
- Cap: once the log passes about 1 MB, the oldest attempts drop.
- No clear-after-share setting. The question after each share does the job with one tap; add a
  setting if it gets annoying.
- The recording logic is pure (`src/plays.js`, tested); `ui.js` calls it at the hook points
  (`begin`, `shoot`, `land`, `trySwap`, item uses, pointer handlers, visibility).
- Writes happen with the shot's existing save, not on every pointer move. The open attempt lives in
  the log itself (`splice-plays`), written after each shot, so a reload finds it.
- Open attempts: a reload whose save has the same level and fails continues the open attempt;
  anything else closes it as `left`, as does the next `begin()`. A closed tab that never comes back
  leaves the attempt open. A share includes it with `end: null`, and the report counts open attempts
  apart from the rest.
- Switching tracking on mid level starts recording at the next level start. Switching it off drops
  the open attempt and keeps the closed ones.
- Share: the file is built synchronously in the tap handler. A resolved `navigator.share` counts as
  shared (the game cannot know whether the message was sent); an `AbortError` is a cancel.
  `navigator.canShare({ files })` decides between sharing and the download fallback.
- Build stamp: a `BUILD` constant in `src/` (`'dev'` in the repo), replaced with the short commit
  hash by the Pages workflow at deploy, so a file names the exact build.
- Bot need: `startState` keeps the raw need in `S.need`, saved; `fromSave` gives older saves `null`,
  so no save version bump.
- Swaps under `lock` ICE (ignored by the game) are logged as attempted swaps with a `locked` mark.
  Black and other ICE change nothing in the logging.
- Reset progress keeps the install id. Start over ends the open attempt as `left`.
