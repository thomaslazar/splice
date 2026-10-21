# Splice: handover notes

Splice is an ad-free, cyberpunk bubble shooter for phones. Aim at the bottom, fire a packet
up into the hanging cluster at the top; three or more of one colour pop, and anything that
loses its connection to the ceiling falls. Clear the level to move on. It is a personal
hobby project and a sibling of Kiln (`../kiln`), built for fun, with endless generated
levels that never strand the player through bad luck.

Nothing is built yet. This file is the starting brief; replace it with real agent notes
(like `../kiln/CLAUDE.md`) once the code exists. The core loop design, with the numbers
from the playtested prototype, is in
`docs/superpowers/specs/2026-10-21-core-loop-design.md`; where they disagree, the design
wins.

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

## Core loop

- Board: hex grid in offset rows (`COLS` bubbles on even rows, one fewer on odd). The
  column count (8, 10 or 12) varies per level for variety.
- Levels are many screens tall; the view keeps the lowest bubble just above the shooter
  and scrolls down as room clears. Shots can land off-screen, unseen.
- Aim: drag to aim, release to fire. The aim line shows the full path, through every
  wall bounce, to the cell where the packet will land. Shots bounce off the side walls and stick to the ceiling or the first bubble hit,
  snapping to the nearest free cell.
- Collision radius a little smaller than the drawn bubble, so shots slip through gaps the
  player expects them to.
- Queue: current and next packet visible; tap the strip at the shooter's height (or use
  the scroll wheel) to swap them.
- Match: a connected group of three or more of the same colour, including the new packet,
  pops. Then every bubble no longer connected to the ceiling falls (flood fill from the top
  row). Dropped bubbles score more than popped ones.
- Shots: each level has a limited number of shots, shown on screen. Running out with
  bubbles left is a loss.
- No ceiling drop: the shot limit is the pressure.
- Restart any time; it does not count as a fail.
- Win: board empty.
- Levels: the seed from the level number defines the layout: which cells hold a bubble
  and how they group into shapes. Size and number of colours grow with difficulty. The
  shot limit follows from the layout, so every level is winnable with good aim (check
  with the bot).
- Layouts are designs, not just rows: some levels are geometric (for example hanging
  lines side by side, each one colour, next to a square in another colour), others mix
  varied forms and colours. Each shape is one group and is coloured as a whole.
- Other levels are noise: full rows of random colours to grind through, shorter but
  dense. Noise and designed parts are never mixed in one level.
- Retry: the layout and its groups stay the same; only the colours are shuffled between
  groups. A line that was green may be red next time, but it is still one colour. In
  noise levels each bubble is its own group, so the colours reshuffle freely.

## Architecture (learned from Kiln, start this way)

- Vanilla HTML, CSS and ES modules. No frameworks, no dependencies, no build step.
- `src/core.js`: all rules, pure (no DOM, no storage): grid and neighbours, shot path and
  snapping, match and drop, colour dealing, level generation, difficulty. Unit tested with
  `node --test`.
- `src/ui.js`: rendering (canvas is fine for the board and aiming; DOM for sheets and
  menus), input, animation, saving to `localStorage`.
- Everything random is seeded (`mulberry32` and `hash`, as in Kiln), so a level is
  reproducible from `(level, fails, salt)`. No `Math.random` in `src/`.
- Shot physics in fixed steps, so the same aim always gives the same result in the core,
  the UI and the bot.
- `tools/sim.mjs`: a bot that plays the core (for example the shot that pops or drops
  most) and reports win rate and shots per level. Rerun after any balance change.
- All visible text in `lang/<code>.json`, read with `t('key', {placeholders})`, as in Kiln.
- PWA (manifest, icons, network-first service worker) and GitHub Pages deploy with a
  `node --test` check, copied from Kiln once the game is playable.
- Respect reduced motion: no glitch or fall animations, results show at once.

## Scope for now

Only the core loop: generated levels, aiming, popping, dropping, shot limit, win and loss,
retry. No special bubbles, goals or chapters yet.

## Later ideas (parked)

- Hardened bubbles that need two hits.
- Firewall rows that only drop once everything above them is cleared.
- Data cores embedded in the cluster as an alternative level goal, like Kiln's gems.
- Chapters with their own palette, as in Kiln.

## Conventions

- See `../kiln/CONTRIBUTING.md`; copy it over and adapt it when the repo starts.
- No em-dashes in UI copy or docs. Use typographic apostrophes (’) in visible text.
- Always ask before committing. Conventional Commits; never add `Co-Authored-By:` or
  "Generated with" lines.
