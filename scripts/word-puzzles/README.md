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

## Days already played are frozen

Players save progress as the words they found, so a puzzle must never change
once it may have been played. `npm run words:generate` therefore keeps the
existing puzzle for every date up to today and only builds the dates after
today (and any date with no puzzle yet). To rebuild everything on purpose, run
`npm run words:generate -- --force`; expect saved progress for changed days to
no longer match.

## If a puzzle has a word you don't want

Add the word, lowercase, one per line, to `blocklist.txt`, then run
`npm run words:generate`. The word is removed from every puzzle after today,
grid and bonus alike. Puzzles for today and earlier keep it. Note that adding
a word can change which puzzle a future date gets, because the choice for each
date comes from the whole word list; that is fine for days nobody has seen.

## Changing how puzzles are chosen

Changing `build.ts`, `layout.ts`, the sizes in `config.ts` or the word lists
(or updating the `word-list` / `popular-english-words` packages) changes the
puzzles of every date after today, which is fine, and never touches today or
earlier unless you use `--force`.
