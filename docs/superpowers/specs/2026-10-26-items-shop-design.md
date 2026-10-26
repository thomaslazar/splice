# Items and shop design

## Intent

Some moments in Splice feel like they need an edge the player does not have: a solid block that
would take five or more packets, a level two bubbles from done with two packets left, a scrambler
level where the needed colours refuse to come. Items give that edge. They are code the player
collects, buys and fires: strong ("let's not be so stingy"), and special because they are a choice,
not because they are weak.

Items come three ways: bought in the shop with frags (currency earned by dropping bubbles), won as
loot from hard levels, and found as item bubbles hanging in some levels' clusters. The menu already
has a disabled Shop tab waiting for this.

## Goals

- Thirteen items, unlocked in steps as the player goes deeper.
- A deck (inventory) at the bottom left of the play screen; tap to load or use an item.
- Frags: earned from dropped bubbles, paid on a level's first win, spent in the Shop tab.
- Loot: some levels carry a guaranteed or chance item reward, shown with the host.
- Item bubbles: some levels have items hanging in the cluster that go off when a packet touches them.
- Reset progress: one button to start from scratch.

## Non-goals

- Chapters. Until they exist, a "chapter" for unlocking is one 30-level run (levels 1-30, 31-60, ...).
  When chapters are designed they take over this role.
- Final prices. Placeholders now, tuned by playing.
- Lowering the shot limit (`HUMAN_K`) to make items more needed. A separate tuning step once items exist.
- More than one ICE per level (parked: only if items make levels too easy).
- The scrambler difficulty fix and the swap-zone misfire on mobile (owner report). Separate changes.

## Anti-goals

- Items that play the level for you or bring dice back. Every effect is fixed and previewed;
  nothing random happens after release.
- Item bubbles that read as a colour. They must never be mistaken for a colour bubble, in any
  theme or under monochrome.
- Hoarding clutter: the deck button never shows a count.
- A way to farm frags or loot by replaying easy levels.
- Network calls or accounts. Everything stays in `localStorage`.

## Decided by the owner

### Items

Two kinds. **Shot items** load into the shooter and fire along the aim line. **Instant items** take
effect when tapped in the deck, no shot.

| Item | Kind | Effect | From level |
|---|---|---|---|
| Logic bomb | shot | Clears every bubble within 2 cells of where it lands. | 1 |
| Sweep | shot | Clears the whole row it lands in. | 1 |
| Pierce | shot | Flies along the aim line through bubbles, clearing the first 10 it passes, bouncing off walls and keeping its remaining length. | 1 |
| Wildcard | shot | Becomes the colour of the biggest same-colour group it touches (tie: the one that drops more), then pops as normal if that makes 3 or more. | 1 |
| Overclock | instant | +5 shots. | 1 |
| Decrypt | instant | Pick the current packet's colour from the colours on the board. On scrambler it also reveals the next 3 hidden packets. | 1 |
| ICE breaker | instant | Turns the level's ICE off for the next 5 shots. | 1 |
| Star | shot | Clears 6 straight rays of 4 cells from where it lands, one along each grid direction. | 31 |
| Lightning | shot | Works upward from where it lands, bubble to bubble, always to the neighbour nearest the top, clearing about 8. The path is fixed and previewed. | 31 |
| Virus | shot | Turns every bubble within 4 cells into the colour of the bubble it hits. Does not pop them itself; the next normal shot reaps the big group. | 61 |
| Purge | shot | Clears every bubble on screen of the colour of the bubble it hits. | 61 |
| Rainbow | shot | Counts as every colour at once: each touched group that reaches 3 with it pops, all at once. | 61 |
| Rollback | instant | Undoes the last shot: board, shots and packets as before it. | 91 |

Bubbles cut off from the ceiling by any item fall as usual (and pay frags, see below).

Icons: white line art with a glow inside a round dark bubble (approved mockup, round 2). Rainbow's ring
is in all colours. Each item also has a short name and a one-line effect in `lang/`.

### Deck (inventory)

- A "Deck" button at the bottom left of the play screen. No count on it (hoarders). Dimmed when the
  deck is empty.
- Tapping it slides open a list over the lower left of the board: only items the player owns, each with
  icon, name and count. Tap outside closes it.
- No limit on how many items the player holds ("they are code, storage is cheap").
- Tapping a shot item loads it into the shooter. Tapping an instant item uses it at once.
- Loaded item: it takes the shooter slot; the current packet moves to the next slot; the old next packet
  waits behind it (shown small). After the item is fired, both packets come back in that order. Nothing
  is lost, no colour is re-dealt.
- While an item is loaded, swapping is off. Tapping the shooter zone (the same zone that swaps now, which
  never fires) unloads the item back into the deck.
- Landing preview: every bubble the loaded item would affect gets a white outline (Virus: dashed, since it
  recolours). It follows the ICE rules for the landing ring: none on black ICE, none while jammed.

### Frags

- Currency name Frags, sign `ƒ` (fiction: dropped bubbles are code fragments recovered).
- Earned only from **dropped** bubbles, never popped ones. Rewards cutting structures loose.
- During a level the header shows the frags this level would pay on a win, rising with each drop.
- Paid only on the level's **first win**. A loss pays nothing. Replays of a won level pay nothing.
- The balance is everything paid since level 1, minus what was spent. Buying uses only the balance, never
  the pending frags of the current level. Buying works any time, also mid-level from the menu, and an item
  bought mid-level can be used in that level.
- The shot limit ignores deck items: the bot never loads or uses deck items. It only plays item bubbles
  (see Item bubbles).

### Shop

- The Shop tab of the menu, now enabled. The frags balance on top, one row per item: icon, name, one-line
  effect, how many you own, price, buy button. Locked items show the level they unlock at.
- Tapping a row opens a small popup with a short looping demo on a tiny board (before and after). With
  reduced motion: two still frames.
- Prices: placeholders, tuned by playing. Starting point: simple items about 300 to 500 frags, about one
  item every 1 to 2 levels of normal play. At 1 frag per dropped bubble, the bot drops (not pops) about 260
  bubbles per level on average (19 levels sampled from 1-80, range 56 to 516), so about ƒ 260 per level.
  The owner wants items generous.

### Loot

- Always loot: high-stakes hosts (so every long level) and harsh ICE (monochrome, black).
- 35% chance: mild or medium ICE.
- 5% chance: every other level.
- Seeded from the level: same item on every try. Drawn only from items unlocked at that level.
- Shown only once the host is in view: a big item icon next to the host drawing in the host strip,
  labelled "Loot".
- Paid on the first win only, with the frags.

### Item bubbles

- Some levels have item bubbles hanging in the cluster: round, dark, white ring and icon (never a colour).
- Count by screens: up to 2 per screen, sometimes fewer. Most levels have none; some have a normal amount;
  now and then a level is chock full.
- Shot items only (Logic bomb, Sweep, Pierce, Wildcard, Star, Lightning, Virus, Purge, Rainbow), from those
  unlocked at that level. No instant items.
- A packet that touches an item bubble directly sets it off at the item bubble's place. Being part of a
  bigger pop does not (may change later).
- A dropped item bubble is gone: no effect.
- The bot plays like a human: it aims at item bubbles when that helps and counts their effect when it
  scores a shot. So levels with item bubbles get a lower shot limit; the limit assumes they are used.

### Flatline rescue

- When a level is lost because the shots ran out and the player owns an Overclock, the Flatline sheet
  offers "Overclock: +5 shots" next to Try again. It spends one Overclock, closes the sheet and play goes on
  with the same board. Not offered when the loss came from a bubble crossing the loss line (more shots
  would not help).
- Rollback is not offered on the Flatline sheet; it is for a real mistake during play.

### Root access sheet

Shows `+ ƒ n` and, for loot, "{item} added". On a replay, a "Replay: no frags" line and no loot line.

### Progress

- Start over (level 1) keeps frags and items.
- New **Reset progress** wipes everything: best level, frags, items and the board. Asks first with a
  clear warning.

## Builder's calls (made in brainstorming, not confirmed by the owner)

- **Unlocks** go by the level being played, not the best level: a level's loot and item bubbles come from
  items with an unlock level at or below it, so they are pure functions of the level. The Shop shows an
  item as unlocked once best level reaches its unlock level.
- **Saving:** a new key `localStorage['splice-deck']` holds `{ frags, items: { <id>: count } }`, apart from
  `splice-run` and `splice-v1`. Reset progress removes `splice-v1`, `splice-run` and `splice-deck`, keeps
  `splice-lang`.
- **First win** means winning the level equal to the run's best level. Pay out once, at the moment of the
  win, and save it at once; a reload of a won board must not pay again.
- **Header:** pending frags (`ƒ n`) replace the score under the level. The score is not shown anywhere
  else today, so it can drop from the HUD (it may stay in the state). On a replay the header shows the
  frags dimmed or a dash.
- **Frags per dropped bubble:** 1. Bubbles cleared by an item count as popped; what falls afterwards counts
  as dropped. Dropped item bubbles pay nothing.
- **Item bubbles** are stored in the grid as values above the colours (for example 6 + item index), count
  for ceiling connection and the loss line, and never count as colours: `deal` ignores them, matching
  ignores them, a level is won when no colour bubble is left (leftover item bubbles fall with the win).
  `validSave` and the save version change to allow them; an old save restarts its level as today (a
  board in progress restarts once after the update, accepted). Item bubbles also count for the loss line
  and can be what holds a structure to the ceiling: they are bubbles in every way except colour.
  `S.score` stays in the state for now, unused by the HUD.
- **Touching** means the item bubble is a neighbour of the cell the packet lands in. Several touched item
  bubbles all go off. Order: normal pop first, then the items, then everything cut loose falls. A deck
  item packet that lands next to an item bubble sets it off too, and Pierce sets off every item bubble its
  path passes through.
- **Chains (owner):** an item bubble inside the area an item clears goes off too, so items can chain.
  An item bubble caught in a normal pop does not. In practice: the clearing effects (Logic bomb, Sweep,
  Pierce, Star, Lightning) set off the item bubbles in their area; colour effects (Wildcard, Rainbow,
  Purge, Virus) never clear item bubbles, since those have no colour. Builder's call on order: breadth
  first, each item bubble goes off at most once, all cleared cells resolve before anything falls, so the
  preview stays exact (the preview includes the chain).
- **Direction for item bubbles:** Pierce continues in the shot's direction from the item bubble;
  Lightning starts at the item bubble; the others centre on it. A Wildcard or Rainbow item bubble acts as
  if a Wildcard or Rainbow packet sat there.
- **How often:** about 1 level in 4 has item bubbles (from level 3, like noise). Of those, about 1 in 5 is
  chock full (about 3 per screen, cap 4); the rest average about 1 per screen (0 to 2). All seeded from the
  level, placed on cells of the layout (replacing colour cells) after colouring, the same on every try.
  Tune by playing.
- **Lightning path:** from the start cell, step to the neighbouring bubble with the lowest row; ties go to
  the one nearer the start column, then to the left. Stop after 8 bubbles or when no upward neighbour is
  left. Fully deterministic, so the preview is exact.
- **Pierce path:** the aim trace without stopping at bubbles; each bubble the path passes within the hit
  distance of is cleared, up to 10. It ends after 10 or at the ceiling; it never lands or adds a bubble.
- **"Within n cells"** is grid distance on the hex grid (steps through neighbours).
- **Virus** lands as a normal packet in the hit bubble's colour, then recolours; no pop happens on that
  shot.
- **Purge** counts "on screen" as the rows from `S.top` to the loss line.
- **ICE breaker** pauses every ICE effect (including the jam count) for 5 shots, then the ICE comes back.
  A log line and an `#alert` flash mark both ends.
- **Overclock** may push shots above `maxShots`; the packets bar stays full until shots drop below it.
- **Rollback** keeps one snapshot of the whole state before the last shot (board, shots, packets, `hist`,
  `draws`, pending frags, ICE counters such as the jam restore and ICE breaker shots), so the same deal
  comes back; a deck item spent on that shot returns. Not usable with no shot fired yet.
- **Colours after an effect:** after any item effect the usual rule runs: `cur` and `next` are re-dealt if
  their colour left the board. Virus only spreads the hit bubble's colour, which is on the board. A
  Wildcard touching no pair takes the colour of the biggest touched group anyway and stays without popping.
- **First win:** a lost attempt's pending frags vanish; restart (not a fail) also starts pending at 0.
  Whether a win pays is decided at the win from `level === run.best`; no replay path pays.
- **Loaded item and ICE:** a loaded item is never hidden by scrambler; lock blocks swapping, not loading.
  Monochrome leaves item bubbles white. Static blocks can hide them like any bubble.
- **Unlock notice:** reaching level 31, 61 or 91 for the first time flashes "New items in the shop" in
  `#alert` and logs it.
- **Reset progress** sits at the bottom of the Run tab, set apart from the other buttons, and uses the sheet
  question (`asking = 'reset'`): "Reset all progress?" / "Your level, frags and items are deleted." /
  "Reset" / "Cancel".
- **Demo popup** in the shop: a small canvas drawing a fixed hand-made board per item, looping item fire and
  result, using the game's own effect code where practical.

## Left to the builder

- Exact geometry of the deck button and drawer within `fit()`, and how its touches are kept from aiming.
- How the item effects are split between `core.js` (pure rules, testable) and `ui.js` (drawing). The
  effects belong in pure code so the bot can use them.
- Animations for each effect (in the existing pop and fall style, glitchy, short; instant with reduced
  motion).
- Exact placeholder prices.
- How the bot scores item bubbles, within its current cost (about 1 s on the largest levels).
- Whether to split the work into more than one plan (for example deck, frags, shop and loot first; item
  bubbles and the bot second).

## Constraints

- Vanilla HTML, CSS, ES modules; no build step, no dependencies.
- `localStorage` keys start with `splice-`.
- No visible text in code; every string in `lang/en.json`, sentence case, no em-dashes, typographic
  apostrophes.
- Pure rules stay in `src/` without DOM or storage, tested with `node --test`; no `Math.random` in `src/`.
- Design goal 3 (fairness) holds: packets are dealt only from colours on the board; item bubbles are never
  dealt.
- Reduced motion: effects show at once.
- Portrait phones, no horizontal scroll.
- Update `CLAUDE.md`, `sw.js` (`CACHE`, `SHELL`) and the Pages copy step for any new files.
- Rerun `node --test` and the sim after rule or balance changes.
