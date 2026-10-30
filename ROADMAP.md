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
- **Sound and music** ([#6](https://github.com/thomaslazar/splice/issues/6)). Generated synth music
  in a cyberpunk, Tron-like style, plus sound effects for shots, pops, drops, items and ICE. Open:
  whether it respects the phone's silent switch, and a mute control. Needs a brainstorm.

- **Boss levels at chapter ends.** Super hard levels that can hardly be won without items (or
  without failing until the retry easing adds shots). Needs a brainstorm: how hard, how often, how
  they are announced.

## Tuning (by playtest)

- **ICE schedule.** ICE now starts at run position 6, about two levels in three, with overlapping
  severities (harsh from 21); black and monochrome get the full board. Check whether the climb feels
  right and whether black still needs 1.5x shots. Seal ICE (lock with a hidden next packet) is new
  and harsh; if monochrome and seal feel apart from the other harsh types, consider a fourth
  severity for them.
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

- `?level=N` (a test path) can drop a saved loaded item.
- A Virus with nothing to recolour cannot fire.
- Cleared bubbles blink out about 100 ms before their pop shows.
- Rollback remembers only the last shot, in memory, and any other item use clears it.

## Done

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
