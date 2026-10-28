# Roadmap

What comes next for Splice, roughly in order. Issues live on
[GitHub](https://github.com/thomaslazar/splice/issues). Specs and plans for built work are in
`docs/superpowers/`.

## Next

- **Item effects** ([#7](https://github.com/thomaslazar/splice/issues/7)). Each item gets its own
  visual when it goes off: the bomb explodes, lightning arcs up its path, the sweep cuts across its
  row. Today every item shows the same white flash before its bubbles pop.
- **Play tracking.** The game records how each level went (level, ICE, shots used against the limit,
  win or loss, retries, items used, time) and the player can send it off from the menu, as a
  pre-filled GitHub issue or through the share sheet. It is for balancing: data to tune shot limits,
  ICE and item levels from. Nothing is sent without a tap. Needs a brainstorm.
- **Tutorial and first steps** ([#5](https://github.com/thomaslazar/splice/issues/5)). A short
  introduction that opens from the menu and on a fresh start or after Reset progress, possibly with
  a little story about the setting. Needs a brainstorm.
- **Sound and music** ([#6](https://github.com/thomaslazar/splice/issues/6)). Generated synth music
  in a cyberpunk, Tron-like style, plus sound effects for shots, pops, drops, items and ICE. Open:
  whether it respects the phone's silent switch, and a mute control. Needs a brainstorm.

## Tuning (by playtest)

- **Scrambler ICE.** Scrambler levels feel hard; consider moving them to higher difficulty or
  giving them more shots.
- **Shot limits on item levels.** Levels full of item bubbles (for example 25 and 55) got 25 to 35%
  fewer shots, since the bot uses the items. If they feel tight, give item levels their own factor.
- **Human factor.** Lower `HUMAN_K` (now 1.4) once items are in regular use.
- **Mobile misfires near the swap strip.** Dragging below the dashed line now cancels a shot; check
  whether the swap zone still causes misfires.

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
