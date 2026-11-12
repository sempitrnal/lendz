# Daily word: a Wordscapes-style mini game

Status: draft for review.

## Why

A fun break inside the app, just for the owner. One small puzzle a day, with a
streak to keep it a habit. Not shared, no accounts, no leaderboard.

## What we're building

A new page, "daily word", in the More menu and the desktop sidebar.

- **Puzzle:** a wheel of letters and a small crossword grid. Spell the grid's
  words by swiping across the wheel's letters. Words that fit the letters but
  are not in the grid count as bonus words.
- **One puzzle per date,** the same every time that date is opened. Size ramps
  through the week:

  | Day | Letters | Grid words |
  |---|---|---|
  | Monday, Tuesday | 5 | 4 |
  | Wednesday, Thursday, Friday | 6 | 6 |
  | Saturday, Sunday | 7 | 8 |
- **Words:** English only.
- **Progress:** kept on this device only (`localStorage`). A different phone, or
  cleared site data, starts fresh.
- **Extras:** hint button, streak counter, bonus words, replay earlier days.

Out of scope: leaderboards, syncing between devices, accounts, themes, other
languages, hint limits or an economy.

## Where the puzzles come from

Pre-generated, shipped as static data. The app never builds a puzzle and never
carries a big dictionary.

### The script

`scripts/generate-word-puzzles.mjs`, run by hand, not part of the app build.
For each date from a start date to three years ahead (about 1,100 puzzles):

1. Pick the letter count and grid-word count from the weekday (see the table above).
2. Pick a letter set whose letters spell enough common words.
3. Choose the grid words from a common-words list and lay them out as a small
   crossword with a placement routine (words cross, no stray adjacency).
4. Compute every valid word of 3 or more letters that can be spelled from the
   letters, using the wide word list minus a blocklist.

Selection is deterministic (seeded by the date), so re-running gives the same
file for a date unless the inputs change.

Inputs: a wide word list for what counts as a word, a common-words list for what
may appear in the grid, and a blocklist of rude or unwanted words. The lists are
dev-only inputs; the exact packages and their licences are settled in the plan.

### The data

One file per month: `public/word-puzzles/YYYY-MM.json`, about 40 KB each:

```json
{
  "month": "2026-11",
  "puzzles": {
    "2026-11-12": {
      "letters": "PLANET",
      "grid": { "rows": 5, "cols": 6 },
      "words": [{ "word": "PLANET", "row": 0, "col": 0, "dir": "across" }],
      "bonus": ["ANT", "PEN"]
    }
  }
}
```

`words` are the grid words; `bonus` is every other valid word from the letters.
A word typed is a grid word if it is in `words`, a bonus if it is in `bonus`,
otherwise invalid.

### Loading

A loader fetches the month file for the date shown, and the next month's file in
the background. "Today" is the Manila date, as elsewhere in the app. The files
are plain static files, so the service worker and browser can keep them for
offline play; the plan confirms the service worker's caching and whether the
offline manifest needs to list them.

## The screen

Route: `app/(dashboard)/word-game/page.tsx`, a thin server page. It reads
`?date=`, rejects anything after today's Manila date, and passes the date to a
client component. The page is added to the pages that own their green header
(`usePageOwnsMobileHeader`) and to the pages that hide the back arrow.

Layout:

- Green header band with the label "daily word", the streak chip and the date.
  The existing day picker overlaps the band's bottom edge; it already takes
  `date` and `today` and blocks future days. It is how earlier days are replayed.
- The crossword grid in a card.
- The word being spelled, above the letter wheel.
- The letter wheel: a round card with the letters around it. Beside it: shuffle,
  hint, and a "bonus N" chip.

### Playing

Press a letter and drag across others to chain them; a line follows the finger;
releasing submits. The wheel does not scroll the page while dragging
(`touch-action: none`).

On release:

- **Grid word, not yet found:** its squares fill with a small pop; haptic and
  sound.
- **Bonus word, not yet found:** counted; the chip goes up.
- **Already found (grid or bonus):** the wheel shakes and a short note says so.
- **Not a word:** the wheel shakes.

**Hint:** reveals one random letter in a grid word that is not finished.
Unlimited.

**Solved:** when every grid word is found: confetti, a "solved" state with the
words found and the bonus count, the streak updated, and a note to come back
tomorrow.

**Streak:** consecutive solved days ending today or yesterday (so a missed day
reads 0). Replaying an earlier day never changes it, and hints and shuffles
never affect it.

## Code layout

`lib/word-game/` (pure logic, no React):

- `puzzle.ts`: types, the month-file loader with an in-memory cache,
  `classifyWord(puzzle, word)` returning `"grid" | "bonus" | "invalid"`.
- `progress.ts`: per date, `{ found: string[], bonus: string[], hints:
  [row, col][] }` under one `localStorage` key; `loadProgress`, `saveProgress`,
  `isSolved`, `revealedCells`. Every read and write is in try/catch.
- `streak.ts`: `currentStreak(solvedDates, today)`.
- `wheel.ts`: `letterPositions(count, radius)` for where each letter sits.

`components/word-game/`:

- `word-game.tsx`: state and layout.
- `crossword-grid.tsx`: the grid.
- `letter-wheel.tsx`: the swipe chain and the line.
- `use-word-progress.ts`: a small `localStorage` hook in the style of
  `lib/hide-amounts.ts`.

Reused as they are: `canvas-confetti`, `lib/haptics`, `lib/sound`,
`components/day-picker.tsx`, the green band pattern.

## Errors and edge cases

- **No puzzle for the date** (past the three-year horizon): "no puzzle for this
  day".
- **File fails to load** (offline, not yet cached): "couldn't load, try when
  online", with a retry.
- **`localStorage` blocked:** the game plays but does not remember; a quiet note
  says so.
- **Midnight rollover while the page is open:** the date stays as loaded; moving
  to the new day is the day picker's job.

## Testing

- Unit tests (vitest): `classifyWord`, progress helpers (`isSolved`,
  `revealedCells`, adding found words), `currentStreak`, `letterPositions`.
- A data test over the generated files: every grid word can be spelled from the
  wheel's letters; crossing squares agree; every grid word is in the valid list;
  no grid or bonus word is on the blocklist; every date in the horizon has a
  puzzle.
- Manual check in a phone-sized browser: swiping, shuffle, hint, finishing a
  puzzle, replaying a past day.

## Open details for the plan

- The exact word-list packages and their licences.
- Whether the service worker already caches `public/` JSON, and whether the
  offline manifest should list the puzzle files.
- The sound used for found words (reuse an existing one from `lib/sound`).
