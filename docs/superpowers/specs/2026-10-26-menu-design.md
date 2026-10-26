# Menu design

## Intent

Splice has one HUD button today (Restart) and one sheet built only for win, loss and the restart
question. The game needs a home for things that are not play: what the game is, where its code
lives, sharing, language, moving between levels, and later a shop for special bubbles. The owner
wants these in one menu, so the main screen stays clean (Restart moves into it), and wants the
menu shaped so the shop can slot in later without a redesign.

Kiln (`../kiln`) is the model for content and copy (one menu button, info with share and source
link, start over from level 1, language picker). Splice's version differs in shape: a full-screen
panel with tabs, chosen by the owner from mockups, because the shop will need a whole page.

## Goals

- One menu button in the HUD, replacing Restart.
- A full-screen panel with three tabs: Run, Shop, Info.
- Restart, start over from level 1, back to the furthest level, and replaying any level already
  reached, all from the Run tab.
- Info with a blurb, how to play, share, source link, license, credits, and a language picker.
- A remembered best level, so the game knows how far the player got.

## Non-goals

- The shop itself. Its tab exists but is disabled.
- A second language (the picker is built now; the file comes later).
- Sound, stats, settings beyond language.
- Keeping a half-played board when leaving a level (see Replay).

## Anti-goals

- A menu button people do not recognise as a button. The owner liked a terminal prompt icon but
  chose menu bars because players must see at once that it is tappable.
- Anything that makes the board harder to read, or that fires a shot from a tap meant for the menu.
- Network calls to anyone but the game's own site (design goal 1). Share uses the phone's own
  share sheet or the clipboard, nothing else.

## Decided by the owner

### Menu button

- Replaces `#restart` in the HUD, same place (right end), same large tap target (the whole header
  height, at least 44 px).
- Icon: three horizontal bars of uneven length, like glitched scanlines, inline SVG in the accent
  colour with the same faint glow the HUD uses. Mockup path: `M3 6h18M3 12h11M3 18h15` on a 24 x 24
  box, stroke 2, no fill. It needs an `aria-label` from `lang/` ("Menu").

### Panel

- Full screen, solid background (`var(--bg)`, not see-through: an earlier see-through mockup let the
  HUD show through and looked broken). Scanline overlay stays on top as everywhere.
- Tab row at the top: Run, Shop, Info. Active tab in the accent with an underline; others dimmed.
  Shop is drawn dimmer still and does nothing when tapped.
- A primary "Keep playing" button at the bottom closes the panel. Escape also closes it.
- Opens on the Run tab.

### Run tab

- Shows "Level" with the current level and "Best level" with the best level.
- Buttons, in order:
  1. Restart this level: closes the panel and shows the existing restart question (same copy, same
     behaviour: confirm restarts with fails unchanged, Keep playing closes).
  2. Back to level {best}: only shown while the current level is below the best level. Starts the
     best level fresh.
  3. Start over from level 1: asks first, like Kiln ("Start over?" / "Your level goes back to 1.
     Your best level is kept." / "Start over" / "Cancel"). Confirm starts level 1 with fails 0.
  4. Pick a level: a number stepper with a minus button, the number and a plus button. The number
     is an input the player can tap and type into (numeric keyboard). Range 1 to best. Below it, the
     host label of that level (`hostFor(n).label`), updated as the number changes. A "Play level
     {n}" button starts it.

### Replay

- Winning a level always leads to the next level, also when replaying an old one. Replaying never
  jumps back on its own; "Back to level {best}" does that.
- Best only moves when the player reaches a new level.
- Leaving a level halfway (pick a level, back to best, start over) throws away its board. Coming
  back starts it fresh.

### Info tab

- Title "Splice" and a blurb: "A relaxed bubble shooter. No ads, no accounts, no tracking."
- How to play, 2 or 3 short lines: drag to aim, let go to fire; tap the strip at the shooter to
  swap; three or more of one colour pop, anything cut off from the top falls.
- Share Splice, as Kiln: `navigator.share({title: 'Splice', text, url})`, text "A relaxed bubble
  shooter with no ads. Give it a try:" (adapted from Kiln's `shareText`), with the page URL
  (`location.origin + location.pathname`); without it, copy the URL to the clipboard and show
  "Link copied" briefly; if that fails too, show the URL as selectable text. A cancelled share
  (`AbortError`) does nothing.
- "Source code on GitHub", a link to https://github.com/thomaslazar/splice (new tab, `rel=noopener`).
- License line: free for non-commercial use (PolyForm Noncommercial 1.0.0).
- Credits: font Chakra Petch, SIL Open Font License.
- Language: a native `<select>` filled from `lang/languages.json` (own-language names), saved to
  `localStorage['splice-lang']` on change, then the texts redraw. Today it holds only English.

### Copy

All visible text goes in `lang/en.json`, sentence case, no em-dashes, typographic apostrophes.
The exact English above is the intended copy; the builder may tighten it.

## Builder's calls (made in brainstorming, not confirmed by the owner)

- Best level is saved apart from the board save, under `localStorage['splice-run']` as
  `{ best, fails }`: `fails` is the fail count on the best level. That keeps `splice-v1` and its
  `validSave` unchanged.
- Rule: whenever a level begins, `best = max(best, level)`. If `level === best`, it begins with
  `max(the fails passed in, the stored fails)` and that is written back to `fails`. So every path to
  the best level (Back to level {best}, picking it in the stepper, winning the level just below it
  in a replay, Try again) keeps the extra shots earned by failing it, and a trip back in time never
  resets them. A new best level starts with stored fails 0. Levels below best begin with the fails
  passed in (0 for a jump, as now for retry and restart).
- Without `splice-run` (old players), best comes from the board save's level (and its fails).
- `?level=N` goes through the same rule, so it raises best. Handy for testing: after `?level=50`
  the stepper reaches 1 to 50.
- Pick a level and Back to level {best} start at once, no question: they take a deliberate
  button press in a panel. Only Start over asks, as in Kiln, because it reads as losing progress.
- The menu button is ignored while loading, during the win sequence (`busy()`) and while a sheet is
  open (as Restart is today). So from a Flatline or Root access sheet the player first takes Try
  again or Next level.
- While the panel is open no aiming, firing, swapping or wheel swapping; closing it starts the
  usual `GRACE` so a lingering tap does not fire.
- The shop tab stays visible but disabled, so its place is reserved and players see the panel has
  room to grow. It carries no "coming soon" teaser text.
- The stepper clamps a typed number into 1..best on change and on Play; an empty or non-number
  input falls back to the current level. Minus and plus stop at the ends.

## Left to the builder

- Markup and CSS of the panel and tabs, within the current look (`.card` borders, accent, glow,
  Chakra Petch, uppercase small caps on buttons as in the mockups).
- Whether the restart question and start-over question reuse `#sheet` (likely: give it a text line
  and set its buttons per use) or the panel shows its own confirm.
- The "Link copied" notice: a small toast, or the existing `#alert` style at a smaller size.
- How `fit()` and `ready()` learn about the panel.

## Constraints

- Vanilla HTML, CSS, ES modules; no build step, no dependencies.
- `localStorage` keys start with `splice-`.
- No visible text in code.
- Works at phone width with no horizontal scroll; portrait only, as now.
- Reduced motion: no tab or panel animation beyond an instant switch.
- `node --test` passes; `tests/lang.test.mjs` keeps checking the lang files. Pure logic (best
  level rule, stepper clamp) is small enough to live in `ui.js`; a test is welcome if it is
  pulled into a pure module.
- Update `CLAUDE.md` (UI section, saving, storage keys list) and `sw.js` `SHELL`/`CACHE` only if
  new files are added.
