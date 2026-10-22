# Splice core loop: design

Date: 2026-10-21. Status: approved for a first build; visual design to be revisited.

## Intent

Splice is an ad-free, dark cyberpunk bubble shooter for phones, a sibling of Kiln
(`../kiln`). The first build is the core loop only: generated levels, aiming, popping,
dropping, a shot limit, win, loss and retry. It should already feel good to play.

What makes it feel good (the owner's words, summarised): earning a big drop. You work out
where a structure's weak point is, clear a path to it, pop it, and a large chunk falls. A
level that hands those drops over for free is boring. Some levels are the opposite: a
grind through dense noise where the challenge is the shot budget.

A throwaway prototype (`spike/index.html`, not committed) was built and playtested on a
phone. The owner's verdict: "feels good for now". This document records what the
prototype settled. Where the prototype's numbers are guesses, this says so.

## Goals

1. The core loop above, playable on a phone, installable later as a PWA like Kiln.
2. Endless seeded levels in two types, designed and noise, that get longer and harder.
3. Fair colour dealing: losing comes from aim and planning, not from the dice.
4. Nobody gets stuck: repeated fails add shots.
5. A balance bot (`tools/sim.mjs`) that plays the real core and sets the shot limits.

## Non-goals (for this build)

- Special bubbles (hardened, firewall, bombs), level goals other than "clear the board",
  chapters, score sharing, menus beyond what the loop needs, sound.
- Light mode. Splice is dark only.
- Translations beyond English. The `lang/` structure is in place from the start (see
  Architecture) so they can follow, as in Kiln.

## Anti-goals

- Levels that are solved in two pops.
- Colour dealing that hands out long runs of one colour, or colours that make the level
  trivial.
- A tap meant to swap colours that fires a shot instead.
- Visual effects that make the board hard to read.

## Board and geometry

- Hex grid in offset rows: even rows have `COLS` cells, odd rows `COLS - 1`, shifted half
  a bubble right.
- Column count varies per level for variety, from the level's seed: 8, 10 or 12.
  Easier and shorter levels lean to 8 and 10, harder and longer ones to 10 and 12 (more,
  smaller bubbles). The board always fills the screen width, so bubble size follows.
  The column count belongs to the level and stays the same on retry and restart. *My
  call* on the exact set and weights; tune by playtest.
- A level is taller than the screen (see Levels). Rows are numbered from the level's
  ceiling (row 0) downwards. Layout generation never depends on screen size; only the
  view does.
- Neighbours: the six hex neighbours, computed from row parity.

## Scrolling view

- The core defines the visible window in rows, so play is identical on every phone: the
  shooter sits 4 rows below the lowest bubble, and the window is `round(1.7 × COLS)` rows
  tall (17 at 10 columns). Taller phones show extra space or decoration, never more of the
  level. *My call*.
- At the start of an attempt the view puts the lowest bubble at that fixed row, 4 rows
  above the shooter. The view then stays put while the player clears. Only once
  the screen is cleared down to its top two rows (or entirely), or 8 or fewer bubbles are
  left on screen, does the level slide down
  smoothly, bringing the lowest bubble back to 4 rows above the shooter. It never
  scrolls above the ceiling.
- The view only follows clearing: its top row can move toward the ceiling, never away
  from it. Bubbles the player sticks below
  the lowest row stay where they land and come closer to the shooter; the board does not
  retract to make room. The view's top row is part of the saved state.
- When the ceiling (row 0) is on screen, a bright line marks it.
- Aiming and firing wait until the scroll has settled.
- There is no ceiling drop. A dashed loss line marks the row directly above the shooter
  row; see Win and loss. Apart from that, the shot limit carries the pressure.

## Aiming and shots

- Drag above the shooter to aim, release to fire. Aim angle is clamped to at least about
  7 degrees from horizontal.
- The aim line shows the full path through every wall bounce to the landing cell, and
  rings that cell in the current colour. The owner wants this; it does not make the game
  too easy.
- Shot physics runs in fixed steps (quarter bubble radius per step) in level
  coordinates, so the same angle always gives the same result in the UI, the tests and
  the bot.
- Side walls reflect. A shot stops at the ceiling or when within `0.82 × 2R` of a bubble
  centre (a forgiving hit radius, so shots slip through gaps the player expects). It then
  snaps to the nearest free cell that touches a bubble or the ceiling.
- Shots may fly past the top of the visible window and land on bubbles the player cannot
  see. The aim line runs off the top of the screen; the view never glances up. If such
  a shot cuts a stem and a whole structure crashes down, that is a lucky, satisfying
  moment, by design.

## Queue and swapping

- The current packet sits at the shooter, the next one beside it, smaller.
- Swap: a tap anywhere in a full-width strip at the shooter's height (at least 44 px
  tall). A touch that starts in the strip never aims or fires, even if the finger drifts
  out of it.
- On desktop, the scroll wheel swaps (one swap per wheel gesture, 150 ms quiet gap).

## Matching and dropping

- After a packet lands, its connected group of the same colour pops if it has three or
  more bubbles.
- Then every bubble no longer connected to the ceiling falls (flood fill from row 0).
- Score: 10 per popped bubble plus 10 × n² for n dropped bubbles, so big drops pay most.
  *Prototype guess*; tune later.
- A drop of 6 or more shows a small floating `-n` near the impact.

## Colour dealing

- Colours come from those still on the board.
- A colour the shooter can reach (a bubble on screen that touches the open space below
  the cluster) gets weight 1 + 3 × its share of the reachable bubbles; colours on screen but
  blocked get 0.9, colours only off-screen 0.3. The reachable colour should be likely, not
  certain: with one reachable and three blocked colours it comes about 60% of the time. If nothing is reachable, bubbles on screen count instead.
  (Owner's playtests: a one-colour line on screen went 5 packets without its colour, and a
  full yellow row blocking a red-filled screen went 10 packets without yellow.)
- The no-three-in-a-row rule and the repeat reroll do not apply to the only reachable colour.
  The owner wants the whole board in play but not to make it too easy.
- Never the same colour three times in a row, unless it is the only colour left.
- If a draw repeats the previous colour, draw once more (cuts repeats to about 11%).
- After a pop, if the current or next packet's colour is gone from the board, it is
  redrawn.
- Dealing uses a seeded PRNG from `(level, fails)`.

## Levels

### Types

- **Designed**: levels 1 and 2 always; after that 75%. Built from stacked sections.
- **Noise**: 25% from level 3. Full rows of colours with some clumping (each bubble has a
  45% chance to copy an already coloured neighbour). The challenge is the grind against
  the shot budget. Never mixed into designed levels.

### Length and difficulty

- `d = min(1, level / 40)`.
- Colours: `min(6, 3 + floor(d × 3.5))`, so 3 early and up to 6.
- Designed: `4 + round(d × 4)` screens (sections); every 5th level is a long one with 2
  to 4 more. Section height is `round(1.6 × COLS)` rows (16 at 10 columns, about one
  screen).
- Noise: 2 screens of full rows, plus up to 6 rows with difficulty.

### Designed sections

Each section is generated on its own from the level's seeded PRNG:

- 2 to 5 shapes (more with difficulty), drawn later-wins so they merge and overlap.
- 65% of sections are mirrored left to right.
- 50% of sections push their shapes down 2 to 4 rows so they hang from stems.
- Shape catalogue: side-by-side hanging lines (each its own band), rhombus, circle or
  ring, downward triangle, chevron, diagonal bar, horizontal shelf.
- Each shape is split into colour bands: solid, rows, columns, or either diagonal. Solid
  chunks are allowed and welcome as an occasional treat.
- A section with too few bubbles (under `25 + 30d`) is regenerated, up to 20 tries.
- Stems (the anchors): every bubble group not connected to the ceiling gets a thin stem
  walking upward from its top until it meets a bubble or the ceiling. In mirrored
  sections the stem is mirrored too. Stems are their own colour group.

### Colouring and retry

- Every layout cell belongs to a group (a shape band, or a stem). Groups are coloured as
  a whole. Touching groups get different colours where possible.
- In noise levels every bubble is its own group.
- Retry keeps the layout and groups and shuffles the colours, seeded by `fails`. A line
  that was green may be red next time, but it is still one colour.

## Shot limit and easing

- Every level has a shot limit, shown on screen. Running out with bubbles left is a loss.
- The limit is measured, not guessed: when an attempt starts, the balance bot plays that
  exact attempt (same layout, colours and dealing) with no limit, and the limit is its shot
  count times 1.4 plus 3 (tunable). It is deterministic, so a retry with the same `fails`
  and a restart get the same limit. (Revised after playtesting: a layout formula left some
  levels nearly impossible and others with twice the shots needed, because the colour
  shuffle alone moves a level's need by 20 to 40%.)
- Easing (fails only, never restarts): from the 4th failed attempt each retry gets more shots, +10% of the original
  per fail, up to +40%.

## Win and loss

- Win: board empty. Sheet: "Root access". Tap to go to the next level.
- Loss: out of shots, or a bubble lands on or below the loss line (the row directly above
  the shooter row or lower), so the player has closed off their own shooter. Sheet:
  "Flatline". Tap to retry (fails + 1).
- Restart: a small control in the HUD restarts the level at any time. It does not count
  as a fail, so it cannot be used to farm the easing. A restart replays the level exactly
  as this attempt started (same colours and dealing, since `fails` is unchanged).
- Progress is saved after every shot (level, fails, board, queue, shots, score), as in
  Kiln, so closing the app never loses a level in progress.

## Look

- Dark only, gritty: near-black background, faint scanlines, neon outlines with glow.
- Each level has an accent colour from its seed (neon green, red, cyan, violet, amber or
  pink) for UI and the aim line, with a matching background tint. *My call*: per level,
  as in the prototype; per chapter can come with chapters later.
- Six bubble colours with fixed hues (magenta, cyan, acid green, amber, violet, red),
  each with its own symbol (ring, triangle, square, diamond, plus, cross).
- Falling bubbles get a short glitch jitter. Popped bubbles grow and fade.
- Reduced motion: no glitch, no fall or pop animation, no smooth scroll.
- Font: self-hosted OFL font with a techy feel (Chakra Petch suggested), shipped with
  its licence.

## Architecture

As in `CLAUDE.md` and Kiln:

- Vanilla HTML, CSS and ES modules; no build step, no dependencies.
- `src/core.js` pure: grid, neighbours, shot trace and snap, match and drop, dealing,
  generation, difficulty, shot limit. Unit tested with `node --test`.
- `src/ui.js`: canvas board and aim, DOM for HUD and sheets, input, scrolling, saving.
- Everything seeded; no `Math.random` in `src/` (the prototype's fall jitter uses it,
  replace it with a seeded or index-based value).
- `tools/sim.mjs`: bot over the core API. It tries a fan of angles (and the swap),
  scores each landing by popped plus dropped bubbles, and reports win rate, shots used and
  shots left per level type and length.
- `lang/en.json` for every visible text.
- PWA and GitHub Pages deploy follow once the loop is playable.

## Left to the builder

- Module split inside `core.js` and the exact data layout (flat array or map).
- The bot's strategy, as long as it plays only through the core API.
- The shot limit formula's shape and constants, calibrated with the bot.
- Exact animation timings and effect details within the look above.

## Calls made without the owner

- Column set 8, 10, 12 and its weighting by difficulty and length.
- Visible window fixed in rows by the core (`round(1.7 × COLS)`), shooter 4 rows below
  the lowest bubble; tall phones get spare space, not more level.
- Section height scales with columns (`round(1.6 × COLS)`).
- Restart replays the attempt exactly (same colours and dealing).
- No generator check that rejects levels with free big drops; the sim reports drop sizes
  so this can be watched.
- Score formula, glitch and pop effects, and the 0.82 hit radius come from the prototype.
