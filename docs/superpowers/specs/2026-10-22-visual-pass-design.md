# Splice visual pass: design

Date: 2026-10-22. Status: approved.

## Intent

The core loop plays well, but the screen feels empty: a board, a line of text and a
shooter. The owner wants "fluff around the edges", some UI that makes it feel like a
run against a system, in the spirit of breaking into hosts in Shadowrun's Matrix or
Neuromancer. Every level is a break-in into a different, named system.

Explored and dropped (do not build): a tilted "pinball table" perspective, a C64-style
fire band as a firewall, and depth rails along the sides. The owner looked at mockups of
all three and rejected them. The board stays flat and top-down.

Reference mockup (layout A, "cyberdeck HUD"):
`.superpowers/brainstorm/7420-1792659078/content/ui-chrome.html`, left panel. It is a
static sketch; this document wins where they differ.

## Goals

1. A HUD frame around the board that carries real information: the system being broken
   into, level, score, shots, and a short run log.
2. A generated host per level: owner, kind and shape, named in the header and drawn above
   the ceiling once the ceiling is on screen.
3. A quiet "we're in" win: "Root access", then the host glitches into the level's accent
   colour.

## Non-goals

- Tilt or perspective, fire effects, depth or progress rails.
- Sound, chapters, special bubbles, translations beyond English, a menu or Info screen.
- Changes to rules, dealing, shot limits or level generation.

## Anti-goals

- Decoration that makes the board harder to read, or makes bubbles noticeably smaller.
- Log lines that are random filler: every line comes from something that happened.
- Anything that slows level start or frame rate noticeably on an iPhone 12 mini.

## Layout (top to bottom)

1. **Header** (DOM), full width of the board:
   - Left: small dim label "Jacked in" over the host label, e.g. "MITSUDA TRUST // VAULT"
     (owner in capitals, then the kind).
   - Right: small dim "Lvl 12" over the score.
   - Restart moves into the header as a small text button (same confirm sheet as now).
2. **Host strip**: a band about two bubble rows tall directly above the board, collapsed
   (zero height) for most of the level. Owner's choice: it opens only when the host is
   near, so the board keeps its full size until then and shrinks slightly only at the end.
   It opens when the view's top row reaches the ceiling (`S.top === 0`), easing open over
   about 0.4 s (instant with reduced motion) while the board scales down to make room
   (`fit()` reruns). The host's shape is drawn in it, just above the top row, fading in as
   the strip opens. The bright ceiling line stays. It stays open for the rest of the
   attempt and starts collapsed on every level start (open at once when a level starts or
   loads with `S.top === 0`).
3. **Board** with corner brackets: four L-shaped brackets in the accent colour at the
   corners of the play area (board plus shooter zone), as in the mockup.
4. **Shooter zone**: as now (current and next packet, swap strip, loss line).
5. **Packets bar** (DOM or canvas): label "Packets", the number, and a bar of up to 20
   segments. With more than 20 shots each segment stands for `ceil(maxShots / 20)` shots;
   lit segments = `ceil(shots / perSegment)`.
6. **Run log**: two lines in a small monospace font, newest on top, the older line dimmer,
   with a blinking cursor at the end of the newest line (static with reduced motion).
7. The "Prototype, work in progress" line stays at the very bottom.

The board keeps its current size on a 390x844 screen while the strip is collapsed; the
frame and log take the spare vertical space that is empty today. When space runs short
the board gives way (as `fit()` already limits by height): with the strip open it is
slightly smaller, by design.

## Run log events

Lines are short, lower case after the `>`, and come only from these events (exact copy
goes in `lang/en.json`; wording below is the intended copy):

| Event | Line |
|---|---|
| Level start | `> connecting to {host}` |
| Drop of 6 or more | `> ice layer breached ({n} nodes)` |
| Pop or drop when the view scrolls down | `> deeper: {pct}% of the way in` |
| Ceiling comes on screen | `> host in range` |
| Shots fall to 25% of the limit or less (once) | `> trace rising` |
| Shots fall to 3 or less (once) | `> trace critical` |
| Loss line reached or out of shots | `> connection lost` |
| Win | `> root access: {host}` |

`{pct}` is how much of the level's rows are already cleared (rows between the starting
lowest row and the current lowest row, over the level's total rows), rounded to 5%.
Nothing else writes to the log. *My call* on the exact events and thresholds.

## Hosts

Generated from the level number only (seeded with `hash(level, 11)`), so a host stays the
same on retry and restart. Pure code in a new `src/hosts.js` (no DOM), unit tested.

Hosts come from a small mix-and-match system, so the endless levels keep meeting new
targets that still make sense: a corporation has an industry, the industry decides which
systems it plausibly runs, and the system decides the shape.

- **Corporation name**, from one of four patterns (seeded):
  - two surnames: "Kessler-Hayashi", "Okonkwo-Reyes", "Lindqvist-Tanaka";
  - one coined name: "Mitsuda", "Vektor", "Halcyon", "Novacrest";
  - a surname plus a word: "Sato Dynamics", "Adeyemi Capital";
  - initials: "KRN", "TLX".
  The builder writes the lists: about 40 surnames from many cultures, about 30 coined
  names, the industry words below. No real company names; check the coined ones against
  well-known brands.
- **Industry** (the word after the name, also picks the systems):

| Industry | Name words | Systems it runs (weight) |
|---|---|---|
| finance | Trust, Capital, Bank, Holdings | vault 4, ledger 4, trading floor 3, payroll 2, archive 1 |
| insurance | Mutual, Assurance | claims db 4, actuarial core 3, archive 2, payroll 2 |
| biotech | Biotech, Genomics | r&d node 4, clinical db 3, sample vault 2, archive 1 |
| pharma | Pharma, Labs | r&d node 3, clinical db 4, supply chain 2, patent archive 2 |
| aerospace | Orbital, Aerospace | flight control 4, telemetry 3, r&d node 2, launch command 2 |
| defense | Defense, Arms, Dynamics | command 4, weapons r&d 3, surveillance grid 3, armory 2 |
| security | Security, Shield | gate 4, surveillance grid 4, access control 3, archive 1 |
| media | Media, Broadcast, Studios | broadcast 4, content vault 3, ad engine 3, archive 1 |
| telecom | Telecom, Networks | switching core 4, subscriber db 3, relay grid 3 |
| logistics | Logistics, Freight | supply chain 4, shipping manifest 4, fleet control 3 |
| energy | Energy, Power | reactor control 4, grid control 4, telemetry 2 |
| ai | AI, Systems, Cognition | core 4, training cluster 3, r&d node 2 |

- **Stakes** follow difficulty, so the target fits how hard the level is (owner's idea:
  lighter levels are small-time industrial data theft, the hardest are defense contractors
  and AI research). Three tiers:
  - **small-time**: logistics, media, insurance, telecom; low systems (payroll, shipping
    manifest, archive, ad engine, claims db, subscriber db); names from the coined or
    "surname plus word" patterns (small firms).
  - **corporate**: finance, biotech, pharma, energy, security, telecom; any of their systems
    except the top ones.
  - **high stakes**: defense, ai, aerospace, plus security and energy with only their top
    systems (command, weapons r&d, launch command, core, training cluster, reactor control,
    surveillance grid); names from the two-surname or initials patterns (megacorps).
  - Tier choice (*my call*, tunable; revised after review so small-time stays at every
    difficulty): every 5th (long) level is high stakes; otherwise, with
    `d = difficulty(level)`, a seeded roll picks small-time with weight `0.15 + 0.85 * (1 - d)`,
    high stakes with `0.3 * d` and corporate with the rest. When chapters come, the tier can follow the position
    in the chapter instead, with the chapter's last level always high stakes.
- **Government targets** (owner's request): fictional agencies alongside the
  corporations, about 1 level in 6. Never real agency names or acronyms. Names from
  patterns like "Ministry of Records", "Bureau of Public Order", "Office of Civic
  Infrastructure", "Directorate 9", or a made-up acronym, optionally with a fictional
  jurisdiction ("Neo-Lagos Municipal", "Federated Coast"). Their own tiers and systems:
  - **small-time** (municipal): city records, permit office, traffic control, parking db
  - **corporate** (national): tax records, census db, customs, police records, benefits db
  - **high stakes** (intelligence and defence): signals intelligence, black archive,
    border command, satellite uplink, defence command
  - Shapes: records, dbs and archives are cubes or step pyramids; traffic control, border
    command and defence command are spires; signals intelligence and satellite uplink are
    spheres; permit office and customs are fortresses. The builder places each system in
    one of the six shapes in the same spirit.
- **System → shape** (six shapes, as in the mockup gallery):
  - cubes: vault, ledger, sample vault, content vault, claims db, subscriber db, armory
  - step pyramid: r&d node, weapons r&d, clinical db, patent archive, archive, actuarial core
  - spire: command, launch command, flight control, reactor control, trading floor
  - sphere of rings: broadcast, telemetry, ad engine, relay grid
  - fortress: gate, access control, payroll, shipping manifest, supply chain
  - lattice: core, training cluster, switching core, surveillance grid, grid control, fleet control
- **Recurring corporations**: levels draw the corporation from a seeded pool of 24 per tier
  for each stretch of 30 levels, so a name comes back now and then with a different
  system ("Halcyon Media" again, this time its ad engine). Hosts never repeat the exact
  same corporation and system on consecutive levels.
- **Label**: `CORPORATION // SYSTEM` in capitals, e.g. "KESSLER-HAYASHI GENOMICS // R&D NODE".
- **Colour**: the host is drawn in one of the bubble hues that is not the level's accent
  colour (seeded), so the win's glitch into the accent colour is visible.
- **Drawing**: thin neon outlines with glow, the six shapes as in the mockup gallery
  (`.superpowers/brainstorm/7420-1792659078/content/visual-direction-v3.html`, bottom row).
  Small variations per level (size, step count, number of towers) from the same seed.

## Win sequence

1. The last bubble clears. The log writes `> root access: {host}`.
2. For about 0.6 s nothing else happens: the host sits there (the quiet "we're in").
3. The host glitches for about 0.5 s (horizontal slice offsets, flicker) and ends in the
   accent colour.
4. Then the existing win sheet opens ("Root access", "Next level").

If the host strip is not on screen when the board clears (it always is: an empty board
puts the ceiling on screen), the sequence still runs. Reduced motion: no glitch; the host
switches colour at step 3 and the sheet follows.

Loss keeps the current "Flatline" sheet; the log writes `> connection lost` first.

## Look details

- Scanlines move from the canvas to the whole screen (a CSS overlay), faint as now.
- Font: self-hosted OFL font with a techy feel (Chakra Petch or similar), in `fonts/`
  with its licence, `@font-face` in `style.css`, added to `SHELL` in `sw.js` and to the
  Pages copy step. *My call*: do it in this pass, since the header and log are the main
  text on screen. Fall back to the current monospace.
- All new visible text in `lang/en.json`; sentence case for labels, the host label in
  capitals as part of the look.

## State, log and sequence details

- **Starting values** (*my call*): `S` gains `maxShots` (the attempt's starting shot count)
  and `startLow` (the lowest occupied row at the start). `startState` sets them; `toSave`
  stores them; `validSave` accepts saves without them (older saves) and `fromSave` then
  fills `maxShots = shots` and `startLow` from the current board. No save version bump.
  "No rule changes in `src/core.js`" means rules, dealing and limits; these state fields
  are allowed.
- **Log behaviour** (*my call*): every event that fires is written, in the order it
  happened, so one shot can push both visible lines. The log is not saved: after a load it
  starts with `> connecting to {host}`, and the "once" events (trace rising, trace
  critical, host in range) are marked as already fired if their condition already holds,
  without writing. "Deeper" is written only when the view actually scrolled and the
  rounded percentage changed.
- **Win sequence and reloads** (*my call*): the sequence runs only in play, after the
  winning shot lands. A reload on a won board shows the sheet directly, with the host
  already in the accent colour. During the sequence aiming, firing, swapping and Restart
  are ignored. The existing tap grace period stays as is.
- **Accent and host hue** (*my call*): `THEMES` moves from `src/ui.js` into
  `src/hosts.js` (pure data), each theme with the index of the bubble hue it resembles
  (green→acid, red→red, cyan→cyan, violet→violet, amber→amber, pink→magenta).
  `hostFor(level)` picks the host hue among the other five.
- **Font** (*my call*): Chakra Petch (OFL) from the Google Fonts repository, latin subset
  as woff2, with `OFL.txt`. Adding files to `SHELL` changes caching, so `CACHE` becomes
  `splice-2`.

## Architecture

- `src/hosts.js`: `hostFor(level) => {corp, industry, system, label, shape, hue, params}`,
  the name lists, the industry table and the system-to-shape table. Pure, tested in
  `tests/hosts.test.mjs`: deterministic; label format; a system always comes from its
  owner's list and its tier; government owners appear and never use real agency names; long levels are high stakes; hue never the accent's; every industry, system and shape reachable over
  a few thousand levels; no corporation and system pair on two levels in a row; a
  corporation recurs within a 30-level stretch.
- `src/ui.js`: header, strip, brackets, packets bar, log and the win sequence. Log events
  are detected in the UI from what `fire` returns and from state changes; no rule changes
  in `src/core.js`.
- `lang/en.json`: new keys; `tests/lang.test.mjs` keeps passing.

## Left to the builder

- Exact spacing, sizes and whether the bar and log are DOM or canvas.
- Shape drawing details within the description above.
- Corporation name lists.
- How the host fades in.
