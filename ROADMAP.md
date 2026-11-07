# Roadmap

What comes next for Splice, roughly in order. Issues live on
[GitHub](https://github.com/thomaslazar/splice/issues). Specs and plans for built work are in
`docs/superpowers/`.

## Next

- **Item effects** ([#7](https://github.com/thomaslazar/splice/issues/7)). Each item gets its own
  visual when it goes off: the bomb explodes, lightning arcs up its path, the sweep cuts across its
  row. Today every item shows the same white flash before its bubbles pop.
- **Tutorial and first steps** ([#5](https://github.com/thomaslazar/splice/issues/5)). A short
  introduction that opens from the menu and on a fresh start or after Reset progress, possibly with
  a little story about the setting. Needs a brainstorm.
- **Sound effects** ([#6](https://github.com/thomaslazar/splice/issues/6)). Shots, pops, drops, items
  and ICE, synthesised in `src/audio.js` like the music. Music is in (see Done); tune it by playtest.
- **Boss levels at chapter ends.** Super hard levels that can hardly be won without items (or
  without failing until the retry easing adds shots). Needs a brainstorm: how hard, how often, how
  they are announced.

## Tuning (by playtest)

- **ICE schedule.** ICE now starts at run position 6, about two levels in three, with overlapping
  severities (harsh from 21); black and monochrome get the full board. Check whether the climb feels
  right and whether black still needs 1.5x shots. Seal ICE (lock with a hidden next packet) is new
  and harsh; if monochrome and seal feel apart from the other harsh types, consider a fourth
  severity for them.
- **Balance pass (2026-11-06), check by playtest.** From a play log of levels 74-139 (93% first-try
  wins, ICE levels and the end of each run the loosest): the ICE shot factor is per type, measured
  (monochrome, lag and blink 1, black 1.3, jitter 1.4), ICE levels get the full board, the human factor
  falls from 1.4 to 1.34 over a run's hardness, and the bot counts only drops it can see. Replayed
  against the log, about 16% of first tries would be lost (was 8%). Share a new log to retune
  `ICE_K` (seal and monochrome had one level each) and `HUMAN_HARD`.
- **Monochrome and black that bite.** With their factor near 1 they are harsh in name only (the
  header still says Fortified). Ideas: monochrome shows symbols only near the aim line; black also
  hides the far board. Needs a brainstorm.
- **ICE-aware bot.** Let ICE hamper the bot instead of a flat factor: no swaps under lock, aim at the
  average over colours for a hidden packet (scrambler, seal), aim error that grows per bounce under
  black, jitter and jam. The cost would then follow each level's geometry.
- **Shot limits on item levels.** The bot uses item bubbles, so levels with them get fewer shots. Since
  items are placed where they do the most, limits dropped further (level 25 from 71 to 59, 33 from 51
  to 36, 55 from 121 to 87). If they feel tight, give item levels their own factor so the limit
  assumes only some items are used.
- **Human factor.** Lower `HUMAN_K` (now 1.4) once items are in regular use.

## Later

- **Chapters**, as in Kiln: a palette per chapter, a rival-hacker theme, new items introduced along
  the way.
- **More languages.** All text is in `lang/`; only English exists.
- **New bubbles:** hardened bubbles that need two hits, firewall rows that drop only once everything
  above them is cleared.
- **Data cores** in the cluster as an alternative level goal, like Kiln's gems.

## Known small issues

- A Virus with nothing to recolour cannot fire.

## Done

- A big drop (10 or more, 14 under harsh ICE) disrupts any ICE for 3 shots
  ([#8](https://github.com/thomaslazar/splice/issues/8)). Music volume slider and no squeak when
  leaving the app ([#6](https://github.com/thomaslazar/splice/issues/6)).
- Item bubbles placed by what they do once the player can reach them (a Wildcard with two colours
  and a group to join, a Rainbow with two groups, a Sweep in a row at least half full, every one
  worth 5 or more there). Logic bomb radius 3 (was 2). Ceiling and loss lines run the full width.

- Music: one generated dark techno track per level, shaped by the host, the security tier and the ICE,
  reacting to the trace warnings, with a win run and a flatline power-down. Music switch on the Info tab;
  respects the silent switch on iOS. A Music tab in the menu plays any reached level's track.
- Small fixes: `?level=N` returns a loaded item to the deck; bubbles cleared by an item bubble stay
  visible until their pop; the Rollback point survives a reload.
- Scrambler gets the medium shot factor 1.25 (a play log showed about 1.5x the bot's shots on it).
- Swap misfires: a play log with touch events showed every swap was a clean tap; no surprise swaps.

- Core loop, endless generated levels, PWA with offline play.
- Visual pass: HUD, hosts, run log, win sequence, font.
- Difficulty pass: hardness, fragmented layouts, ICE.
- Low-shots warning ([#1](https://github.com/thomaslazar/splice/issues/1)), difficulty fixes
  ([#2](https://github.com/thomaslazar/splice/issues/2)), scrambler rework
  ([#3](https://github.com/thomaslazar/splice/issues/3)), jitter rework
  ([#4](https://github.com/thomaslazar/splice/issues/4)).
- Menu with Run, Shop and Info tabs, level picker, share, language choice.
- Items and shop: 13 items, frags, deck, loot, item bubbles in levels, Flatline rescue, Reset
  progress.
- Jitter ICE rarer, popup warnings shown longer, aim cancels below the dashed line.
- Strands between big parts vary in length, width and colours.
- Items in half the levels, and 50 frags per dropped item bubble.
- Play log: an opt-in record of each attempt, shared from the menu and read with `tools/plays.mjs`.
- Level progress indicator: a track in the right gutter with the percent through the level.
