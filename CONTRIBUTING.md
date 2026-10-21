# Contributing

## Code

- No frameworks, no dependencies, no build step unless a feature truly needs one.
- Game rules live in `src/core.js` and `src/levels.js` as pure functions: no DOM, no
  storage. The UI in `src/ui.js` renders and animates, and the balance bot in
  `tools/sim.mjs` plays the same core.
- Everything random is seeded, so a level is reproducible from its seed. No
  `Math.random` in `src/`.
- Match the surrounding style: compact, terse JS.

## Copy

- Sentence case, short and plain.
- No em-dashes in UI copy or docs. Use typographic apostrophes (’) in visible text.

## Tests and balance

- `node --test` runs the unit tests in `tests/`.
- `node tools/sim.mjs` plays the levels with a bot and reports results. Rerun it after
  any change to level generation, goals or shooting rules.

## Commits

Conventional Commits: `type: subject`.

- Types: `feat`, `fix`, `docs`, `test`, `ci`, `refactor` (no behaviour change), `chore`.
- Subject: imperative, lowercase, no period, about 72 characters max.
- Body (optional): explain why, not what. Wrap at 72 characters.
