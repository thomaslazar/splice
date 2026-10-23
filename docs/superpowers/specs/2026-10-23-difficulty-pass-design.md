# Splice difficulty pass: design

Date: 2026-10-23. Status: approved.

## Intent

Too many shots clear most of the screen. The owner: "sometimes that feels nice, but
generally it seems to happen too often". A measurement with the bot confirms it (levels
1 to 60, shots that remove more than half of the bubbles on a screen holding at least 12):

| Levels | Shots | Shots clearing > 50% of the screen | Per level |
|---|---|---|---|
| Designed 1-10 | 112 | 59 (53%) | 7.4 |
| Designed 11-25 | 291 | 115 (40%) | 8.9 |
| Designed 26-40 | 505 | 153 (30%) | 11.8 |
| Designed 41+ | 678 | 190 (28%) | 12.7 |
| Noise, all | 466 | 55 (12%) | 2.5 to 6 |

About half come from drops (a shape cut loose: every floating shape hangs from exactly
one stem, 352 stems in 49 designed levels), half from popping one huge same-colour group
(mirrored halves sharing a colour, single-colour bands, clumpy noise).

The pass adds a **hardness** curve that runs from today's levels (easy) to a hard end with
more stems, broken-up colours and ICE countermeasures that jam the player's information.
Big moments should stay, just rarer; the real feel is tuned by playing.

## Goals

1. Hardness `h` in 0..1 that climbs over each stretch of 20 levels and starts again
   (chapter-like rhythm; chapters themselves come later).
2. At `h = 0` levels look and play as today (same kinds of layouts and colouring rules).
3. At `h = 1`: shapes hang from up to 3 stems, mirrored halves and bands carry different
   colours, noise is scattered, and ICE jams the player.
4. ICE tied to the target host (tier and industry), one type per level, announced.
5. Shot limits stay fair: the bot still measures every attempt, plus a factor per ICE
   severity.
6. A sim report that counts big clears by hardness, to check the effect.

## Non-goals

- Rule-changing countermeasures (bubbles regrowing, ceiling drops, timers): they break
  the bot's measured shot limit.
- Inverted controls (owner: "I always hate that when games do that").
- Chapters, items, shop, rival hacker (separate topics).
- More than one ICE type per level. Owner: worth revisiting once special items exist, if
  they make levels too easy.
- Changing the existing global difficulty `d` (columns, colour count, level length).

## Anti-goals

- Levels that feel unfair: ICE must never lie about where a shot goes, and the shot limit
  must account for it.
- Hard levels with no big moments at all.
- A hard level that looks like noise: designed shapes keep their shapes.

## Hardness

- `hardness(level) = ((level - 1) % 20) / 19` (*my call*: a plain ramp; levels 1, 21, 41
  are easy, 20, 40, 60 hard). Pure, in `src/levels.js`, tested.
- Global difficulty `d = min(1, level / 40)` keeps doing what it does (columns, colours,
  length, stakes tiers). Hardness only drives the features below.
- Every 5th level is still long and high stakes, unchanged.

## Generation changes (src/levels.js)

All seeded and deterministic from the level. Changing generation reshuffles every
level's layout; saves store their board, so a level in progress is unaffected (*my
call*: acceptable, the game is a prototype).

1. **More stems.** Each floating structure in a designed section gets
   `1 + extra` stems, `extra` drawn per structure: 0 at `h = 0`; at `h = 1` usually 2
   (*my call*: `extra = floor(h * 2 + rnd())`, capped at 2). Extra stems start from other
   bubbles along the structure's top edge, spread out (left, middle, right), so cutting
   one leaves the shape hanging from the others. Stems keep their own colour groups;
   mirrored sections keep mirrored stems.
2. **Asymmetric mirrors.** In a mirrored section, with probability `h`, each shape's
   right half becomes its own group (separate from the left half), so `colourize` can
   colour the halves differently. The shape stays symmetric; only colours differ.
3. **Split bands.** With probability `h`, a band group (a shape band of 6 or more cells)
   is cut along its length into 2 or 3 segments (`3` with probability `h`), each its own
   group. Owner's example: three stacked red rows become left red, middle blue, right
   yellow across all three rows: the cut is by horizontal position, so stacked bands of
   the same shape are cut at the same places.
4. **Scattered noise.** In noise levels the chance to copy an already coloured
   neighbour falls from 0.45 at `h = 0` to 0.15 at `h = 1` (linear).
5. Touching groups still get different colours where possible (existing rule), which is
   what makes 2 and 3 visible.

## ICE

One ICE type per level, chosen from the host and hardness, seeded from the level (same on
retry and restart). Pure choice in `src/hosts.js` (`iceFor(level) => null | type`), the
effects in `src/ui.js`.

### Types (all jam information or controls; none changes where a shot goes)

| Type | Severity | Effect |
|---|---|---|
| static | mild | 3 glitch blocks (about 2 x 2 bubbles each) drift slowly over the board area (never over the shooter zone) and hide what is behind them. Shots pass through. |
| jitter | mild | The aim line shivers (a few degrees, changing smoothly); the shot still goes exactly where you aim. |
| scrambler | medium | The next packet shows a glitchy "?". After a shot, the next packet moves up and is revealed as usual. A swap brings the hidden packet to the shooter still hidden: it is fired blind and its colour shows once in flight. |
| lock | medium | Swapping is disabled (tap strip and wheel do nothing; a small lock mark on the next packet). |
| jam | medium | "Lighter ICE": the aim line stops at the first wall bounce (or the first stop if no bounce). A drop of 6 or more restores the full line for the next 3 shots. |
| monochrome | harsh | Bubbles and packets lose their colours (one neutral tone); only the symbols tell them apart. |
| black | harsh | No aim line at all. Nothing restores it. |

### Who runs what

- Severity cap by host tier: small-time (and municipal) mild only; corporate up to medium;
  high stakes up to harsh.
- Flavour by industry (weights within the cap; *my call* on exact weights):

| Owner | ICE it prefers |
|---|---|
| security | lock, static |
| media, telecom | static, jitter |
| finance, insurance | scrambler, jitter |
| ai | jitter, monochrome |
| defense, aerospace, intelligence and defence government | black, lock |
| biotech, pharma, energy, logistics | static, scrambler, jam |
| other government | static, lock |

  An owner whose preferred types are all above its cap takes any type within the cap.
- Chance of ICE at all: 0 for `h < 0.5`, then `(h - 0.5) * 1.4` (about 70% at `h = 1`).
- Black ICE only at `h >= 0.8` and only on high-stakes hosts.

### Telling the player

- Level start: the run log writes `> ice detected: {ice}` after the connect line.
- A small tag in the header shows the active ICE name while it is active (e.g. "Black ICE").
- Jam: `> targeting restored ({n})` when a big drop restores the line, `> targeting jammed`
  when it runs out.
- Reduced motion: static blocks do not drift (fixed positions), jitter is off (the line is
  drawn steady but shortened to the first bounce instead, so the level is still harder).

### Shot limit

`limit = ceil(used * HUMAN_K * ICE_K[severity] + HUMAN_C)` with `ICE_K = { none: 1, mild: 1.1,
medium: 1.25, harsh: 1.5 }` (*my call*; tune by playing). The bot ignores ICE (it plays
with full information), which is why the factor exists.

## Measurement

`tools/sim.mjs` gains a report of big clears (shots removing more than half of a screen
of 12 or more bubbles) per level, by hardness band (0-0.25, 0.25-0.5, 0.5-0.75,
0.75-1) and kind. Target (*my call*, owner tunes by playing): at `h < 0.25` about today's
numbers; at `h >= 0.75` noticeably fewer big clears per designed level, but not zero.
This is a report, not a gate (*my call*, the owner tunes by playing): the build checks
only the direction (the hardest band has clearly fewer big clears per level than the
easiest), records the numbers, and does not run a tuning loop. The bot must still win
every sampled level without a limit. Note for the owner: extra stems make a structure need
several cuts, but the last cut still drops it whole; most of the reduction is expected
from the colour changes.

## State and saves

- No new save fields: hardness and ICE follow from the level. The jam's restore counter
  lives in the UI and resets to jammed on reload (*my call*).

## Architecture

- `src/levels.js`: `hardness(level)`, generation changes 1 to 4. Tests: hardness ramp and
  wrap; stems per structure grow with hardness (count stems per structure at `h = 0` vs
  `h = 1` over a sample); mirrored halves and band segments become separate groups with the
  stated probabilities (sampled); noise clumping falls with hardness (measure average
  same-colour neighbour share).
- `src/hosts.js`: `ICE` table (type, severity), `iceFor(level)`. Tests: none below
  `h = 0.5`; severity never above the tier cap; black only at `h >= 0.8` on high stakes;
  every type reachable; deterministic.
- `src/bot.js` / `src/core.js`: the shot limit multiplies by `ICE_K` of the level's ICE.
- `src/ui.js`: the seven effects, the header tag, log lines; all visible text in
  `lang/en.json`.
- `tools/sim.mjs`: the big-clear report.
- `CLAUDE.md`: hardness, generation changes, ICE.

## Smaller calls (builder check)

- Cells on a mirror's axis belong to the left half.
- An extra stem that runs into another floating shape is fine; the existing stem loop
  re-anchors anything still loose.
- Government ICE flavour follows the tier: high stakes use "intelligence and defence",
  corporate "other government", small-time municipal (mild only).

## Left to the builder

- Exact stem placement along the top edge, segment cut positions, static block sizes and
  speeds, jitter amplitude, the neutral colour for monochrome, header tag styling.
