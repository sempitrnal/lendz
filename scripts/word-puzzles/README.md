# Daily word puzzles

`npm run words:generate` builds one puzzle for every date from `START_DATE` to
`END_DATE` (both in `config.ts`) and writes `public/word-puzzles/YYYY-MM.json`.
The app only looks puzzles up by date; it never builds one.

## Adding more days (do this before `END_DATE` arrives)

1. In `config.ts`, move `END_DATE` later (for example to `2032-12-31`).
2. `npm run words:generate`. Existing dates come out identical (the choice is
   seeded by the date), so only new files appear in git.
3. `npx vitest run lib/word-game/puzzle-data.test.ts`. It checks every date in
   the range has a valid puzzle and that no blocked word is in any of them.
4. Commit `public/word-puzzles` and `config.ts`.

## If a puzzle has a word you don't want

Add the word, lowercase, one per line, to `blocklist.txt`, then run
`npm run words:generate`. A blocked word is removed from both the grid and the
bonus list; because the puzzle changes, that date's puzzle may change for
players who have not played it yet, and anyone who already found a word that is
now blocked keeps their saved progress.

## Changing how puzzles are chosen

Changing `build.ts`, `layout.ts`, the sizes in `config.ts` or the word lists
changes puzzles for dates that may already have been played, because progress is
saved as words found. Prefer extending the date range and the blocklist; only
regenerate everything on purpose.
