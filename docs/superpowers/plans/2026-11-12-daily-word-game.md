# Daily Word Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Wordscapes-style daily puzzle page ("daily word") with a swipeable letter wheel, a crossword grid, bonus words, hints, a streak and replay of earlier days.

**Architecture:** A script pre-generates about three years of puzzles into monthly static JSON files under `public/word-puzzles/`. The app looks a puzzle up by date, keeps progress in `localStorage`, and all game rules live in pure, unit-tested functions under `lib/word-game/`. The screen is a thin client layer on top of them.

**Tech Stack:** Next.js 16 App Router, React 19.2, TypeScript, Tailwind, vitest, `tsx` (script runner), `canvas-confetti`, `lib/haptics`, `lib/sound/cha-ching`.

**Spec:** `docs/superpowers/specs/2026-11-12-daily-word-game-design.md`

## Global Constraints

- English words only; no accounts, server code or database. Progress is `localStorage` only (key `word-game:v1`).
- The same date always gives the same puzzle. "Today" is the Manila date (`Asia/Manila`), as elsewhere in the app.
- Sizes by weekday: Monday and Tuesday 5 letters and 4 grid words; Wednesday to Friday 6 letters and 6 grid words; Saturday and Sunday 7 letters and 8 grid words.
- Horizon: `2026-11-01` to `2029-12-31`, one file per month `public/word-puzzles/YYYY-MM.json`, shape from the spec (`letters`, `grid`, `words`, `bonus`; all words uppercase).
- Grid words come from the common list; bonus words from the wide list minus the blocklist; bonus excludes grid words; every word is 3 or more letters.
- All UI text is lowercase. The wheel uses `touch-action: none` so dragging never scrolls the page.
- Hint is unlimited. Replaying an earlier day never changes the streak; hints and shuffles never affect it.
- Tests live where vitest looks: `lib/**/*.test.ts` and (added in Task 3) `scripts/**/*.test.ts`.
- Commit messages end with the Co-Authored-By line the session specifies. Do not push.

## Review Focus

Inputs the spec implies but its examples do not pin, most likely first:

- **Repeated letters on the wheel** (e.g. `LETTER`): a chain is tiles, not letters; two tiles holding the same letter are different tiles. Pinned in Task 2 (`extendChain`).
- **Corrupt or blocked `localStorage`:** reading must give empty progress, never throw; a bad entry must not hide the good ones. Pinned in Task 4.
- **`?date=` that is garbage, impossible (`2026-02-30`), in the future, or before the horizon:** garbage, impossible and future dates fall back to today; before the horizon shows "no puzzle for this day". Pinned in Task 2 (`resolveDate`) and Task 4 (`loadPuzzleResult`).
- **Streak across a month end, a year end and a missed day.** Pinned in Task 2.
- **Hint when nothing is left to reveal,** and a word whose squares are all filled by crossings or hints but was never spelled: it still is not "found". Pinned in Task 1.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/word-game/puzzle.ts` | Types; `classifyWord`; `gridCells` |
| `lib/word-game/progress.ts` | Progress type and pure updates; `isSolved`, `revealedCells`, `pickHintCell` |
| `lib/word-game/date.ts` | `manilaToday`, `shiftDate`, `resolveDate`, `monthOf` |
| `lib/word-game/streak.ts` | `currentStreak`, `solvedDates` |
| `lib/word-game/wheel.ts` | Wheel geometry, `extendChain`, `shuffled` |
| `lib/word-game/storage.ts` | Safe `localStorage` read and write of all progress |
| `lib/word-game/load-puzzle.ts` | Month-file fetch with cache; `loadPuzzleResult` |
| `lib/word-game/layout-check.ts` | `findLayoutProblems` (shared by generator and data tests) |
| `scripts/word-puzzles/*.ts` | Seeded RNG, crossword layout, puzzle builder, runner |
| `public/word-puzzles/*.json` | Generated data (committed) |
| `components/word-game/*.tsx` | Wheel, grid, progress hook, game screen |
| `app/(dashboard)/word-game/page.tsx` | Thin server page |

---

### Task 1: Puzzle types, word classification and progress rules

**Files:**
- Create: `lib/word-game/puzzle.ts`, `lib/word-game/progress.ts`, `lib/word-game/test-puzzle.ts`
- Test: `lib/word-game/puzzle.test.ts`, `lib/word-game/progress.test.ts`

**Interfaces:**
- Produces (`puzzle.ts`): `type Direction = "across" | "down"`; `type PlacedWord = { word: string; row: number; col: number; dir: Direction }`; `type Puzzle = { letters: string; grid: { rows: number; cols: number }; words: PlacedWord[]; bonus: string[] }`; `type MonthFile = { month: string; puzzles: Record<string, Puzzle> }`; `type WordKind = "grid" | "bonus" | "invalid"`; `classifyWord(puzzle: Puzzle, word: string): WordKind`; `gridCells(puzzle: Puzzle): Map<string, string>` (key `"row,col"` to the letter there).
- Produces (`progress.ts`): `type Progress = { found: string[]; bonus: string[]; hints: Array<[number, number]>; solved: boolean }`; `type AllProgress = Record<string, Progress>`; `emptyProgress: Progress`; `addFound(puzzle: Puzzle, p: Progress, word: string): Progress` (uppercases, no duplicates, sets `solved` from `isSolved`); `addBonus(p: Progress, word: string): Progress`; `addHint(p: Progress, cell: [number, number]): Progress`; `isSolved(puzzle: Puzzle, p: Progress): boolean`; `revealedCells(puzzle: Puzzle, p: Progress): Set<string>`; `pickHintCell(puzzle: Puzzle, p: Progress, random?: () => number): [number, number] | null`.
- Produces (`test-puzzle.ts`): `testPuzzle: Puzzle` fixture used by later tests: letters `"PLANE"`, grid 3 rows by 5 cols, words `PLANE` across at (0,0), `PEN` down at (0,0), `ALE` down at (0,2), bonus `["LAP","NAP","PAL","PEA","LEAN","LANE","PLAN","PLEA"]`.

- [ ] **Step 1: Write the failing tests.** `puzzle.test.ts`: `classifyWord(testPuzzle, "plane")` is `"grid"` (case-insensitive); `"lap"` is `"bonus"`; `"zzz"` is `"invalid"`; `"pa"` is `"invalid"` (under 3 letters); `""` is `"invalid"`. `gridCells(testPuzzle).get("0,0")` is `"P"`, `.get("1,0")` is `"E"`, `.get("2,2")` is `"E"`, `.get("1,1")` is `undefined`, `.size` is 9. `progress.test.ts`: `addFound` of `"pen"` stores `"PEN"` once even when added twice; `solved` stays `false` until `PLANE`, `PEN`, `ALE` are all found, then `true`; `addBonus` ignores duplicates; `revealedCells` with found `["PEN"]` and hint `[0,4]` is exactly `{"0,0","1,0","2,0","0,4"}`; a word whose every square is filled by crossings or hints is not counted found (`isSolved` false, `found` unchanged); `pickHintCell(testPuzzle, emptyProgress, () => 0)` is `[0,0]`; `pickHintCell` returns `null` when every word is found; it never returns a revealed cell (run with `random` values 0, 0.5, 0.99 after `PEN` found and assert the result is not in `revealedCells`).
- [ ] **Step 2: Run to verify failure.** Run: `npx vitest run lib/word-game`. Expected: FAIL (modules not found).
- [ ] **Step 3: Implement `puzzle.ts`, `progress.ts`, `test-puzzle.ts`** with the signatures above. `pickHintCell` chooses among cells that belong to at least one word not yet found and are not yet revealed, ordered row-major, indexed by `Math.floor(random() * count)`.
- [ ] **Step 4: Run to verify pass.** Run: `npx vitest run lib/word-game`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add lib/word-game && git commit -m "feat: word game puzzle types, classification and progress rules"`

### Task 2: Dates, streak and wheel logic

**Files:**
- Create: `lib/word-game/date.ts`, `lib/word-game/streak.ts`, `lib/word-game/wheel.ts`
- Test: `lib/word-game/date.test.ts`, `lib/word-game/streak.test.ts`, `lib/word-game/wheel.test.ts`

**Interfaces:**
- Produces (`date.ts`): `manilaToday(now?: Date): string`; `shiftDate(date: string, by: number): string` (UTC calendar arithmetic, `yyyy-mm-dd`); `resolveDate(param: string | undefined, today: string): string`; `monthOf(date: string): string` (`"2026-11-12"` to `"2026-11"`).
- Produces (`streak.ts`): `currentStreak(solved: string[], today: string): number`; `solvedDates(all: AllProgress): string[]` (keys whose `solved` is true; consumes `AllProgress` from Task 1).
- Produces (`wheel.ts`): `type Point = { x: number; y: number }`; `letterPositions(count: number, radius: number): Point[]` (first at the top, clockwise, centre `(0,0)`); `letterAt(point: Point, positions: Point[], hitRadius: number): number | null`; `extendChain(chain: number[], index: number): number[]`; `shuffled(items: string[], random?: () => number): string[]`.

- [ ] **Step 1: Write the failing tests.**
  - `date.test.ts`: `resolveDate(undefined, "2026-11-12")` is `"2026-11-12"`; `("2026-11-01", today)` is `"2026-11-01"`; `("2026-11-13", today)` (future) is today; `("2026-02-30", today)` (impossible) is today; `("abc", today)` is today; `shiftDate("2026-12-31", 1)` is `"2027-01-01"`; `shiftDate("2027-03-01", -1)` is `"2027-02-28"`; `monthOf("2026-11-12")` is `"2026-11"`; `manilaToday(new Date("2026-11-12T17:00:00Z"))` is `"2026-11-13"` (already past midnight in Manila).
  - `streak.test.ts`: `currentStreak(["2026-11-10","2026-11-11","2026-11-12"], "2026-11-12")` is 3; `(["2026-11-10","2026-11-11"], "2026-11-12")` is 2 (ends yesterday); `(["2026-11-10"], "2026-11-12")` is 0 (missed yesterday); `(["2026-12-31","2027-01-01"], "2027-01-01")` is 2; `(["2027-02-28","2027-03-01"], "2027-03-01")` is 2; `(["2026-11-08","2026-11-10","2026-11-11"], "2026-11-11")` is 2; `([], today)` is 0; duplicates count once; `solvedDates` ignores entries with `solved: false`.
  - `wheel.test.ts`: `letterPositions(4, 10)` is close to `[{x:0,y:-10},{x:10,y:0},{x:0,y:10},{x:-10,y:0}]`; `letterAt({x:9,y:1}, positions, 4)` is 1; `letterAt({x:5,y:5}, positions, 4)` is `null`; `extendChain([], 2)` is `[2]`; `([2], 2)` is `[2]`; `([2,0], 1)` is `[2,0,1]`; `([2,0,1], 0)` is `[2,0]` (back to the previous tile removes the last); `([2,0,1], 2)` is `[2,0,1]` (already used, ignored); repeated letters: for letters `LETTER` (tiles 0 to 5), `extendChain([1,2], 3)` is `[1,2,3]` (two tiles holding `T` are different tiles); `shuffled(["A","B","C"], () => 0)` is `["B","C","A"]`; it returns a permutation with the same letters and does not mutate its input.
- [ ] **Step 2: Run to verify failure.** Run: `npx vitest run lib/word-game`. Expected: FAIL.
- [ ] **Step 3: Implement the three modules** to those signatures. `resolveDate` accepts only a real calendar date matching `^\d{4}-\d{2}-\d{2}$` that is `<= today` (compare strings after validating by round-tripping through `Date.UTC`). `currentStreak` starts from `today` if solved, else from yesterday if solved, else 0, then counts back day by day. `shuffled` is Fisher-Yates from the end, swapping `i` with `Math.floor(random() * (i + 1))`.
- [ ] **Step 4: Run to verify pass.** Run: `npx vitest run lib/word-game`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add lib/word-game && git commit -m "feat: word game dates, streak and wheel logic"`

### Task 3: Crossword layout and its checker

**Files:**
- Create: `scripts/word-puzzles/rng.ts`, `scripts/word-puzzles/layout.ts`, `lib/word-game/layout-check.ts`
- Modify: `vitest.config.ts` (`include: ["lib/**/*.test.ts", "scripts/**/*.test.ts"]`)
- Test: `scripts/word-puzzles/rng.test.ts`, `scripts/word-puzzles/layout.test.ts`, `lib/word-game/layout-check.test.ts`

**Interfaces:**
- Consumes: `Puzzle`, `PlacedWord` from Task 1.
- Produces (`rng.ts`): `hashString(s: string): number`; `mulberry32(seed: number): () => number` (values in `[0,1)`).
- Produces (`layout-check.ts`): `findLayoutProblems(puzzle: Pick<Puzzle, "grid" | "words">): string[]` (empty when valid). A layout is valid when every word is in bounds, squares shared by two words hold the same letter, and every maximal horizontal or vertical run of 2 or more filled squares is exactly one placed word (no accidental side-by-side words).
- Produces (`layout.ts`): `layoutCrossword(words: string[], random: () => number): { grid: { rows: number; cols: number }; words: PlacedWord[] } | null`. Places every word so that all connect by crossings, normalised to start at row 0, col 0, within 8 by 8; `null` when it cannot.

- [ ] **Step 1: Write the failing tests.** `rng.test.ts`: `mulberry32(1)` called twice from fresh gives the same first 5 values; seeds 1 and 2 differ; all values are in `[0,1)`; `hashString("2026-11-12")` is stable across calls and differs from `hashString("2026-11-13")`. `layout-check.test.ts`: `findLayoutProblems(testPuzzle)` is `[]`; a puzzle with `PLANE` across at (0,0) and `LAP` across at (1,0) reports a problem (accidental vertical runs); a word placed out of bounds reports a problem; two crossing words with different letters at the shared square report a problem. `layout.test.ts`: `layoutCrossword(["PLANE","PEN","ALE"], mulberry32(1))` is non-null, every input word appears exactly once, `findLayoutProblems` of the result is `[]`, and `grid.rows` and `grid.cols` are both `<= 8`; the same call with the same seed returns the same layout; `layoutCrossword(["ABC","XYZ"], mulberry32(1))` is `null` (no shared letters); try seeds 1 to 50 with `["PLANE","PEN","ALE","LEAN"]` and assert every non-null result passes `findLayoutProblems`.
- [ ] **Step 2: Run to verify failure.** Run: `npx vitest run scripts lib/word-game/layout-check.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** `layoutCrossword`: place the longest word across at the origin; place each remaining word (longest first) at the crossing position, perpendicular to the word it crosses, that passes `findLayoutProblems`-style checks and gives the smallest bounding box, breaking ties with `random`; return `null` if any word has no valid position; translate to origin and compute the box. Reuse `findLayoutProblems` as the validity check so the two cannot disagree.
- [ ] **Step 4: Run to verify pass.** Run: `npx vitest run`. Expected: all pass, including existing tests.
- [ ] **Step 5: Commit.** `git add scripts lib/word-game vitest.config.ts && git commit -m "feat: seeded crossword layout and layout checker for word puzzles"`

### Task 4: Storage and puzzle loading

**Files:**
- Create: `lib/word-game/storage.ts`, `lib/word-game/load-puzzle.ts`
- Test: `lib/word-game/storage.test.ts`, `lib/word-game/load-puzzle.test.ts`

**Interfaces:**
- Consumes: `AllProgress`, `emptyProgress` (Task 1); `monthOf` (Task 2); `Puzzle`, `MonthFile` (Task 1).
- Produces (`storage.ts`): `STORAGE_KEY = "word-game:v1"`; `readAll(storage?: Pick<Storage, "getItem">): AllProgress` (empty on missing, corrupt or blocked storage; entries with the wrong shape are dropped, good ones kept); `writeAll(all: AllProgress, storage?: Pick<Storage, "setItem">): boolean` (false when writing throws). Default storage is `localStorage`, reached inside try/catch.
- Produces (`load-puzzle.ts`): `type LoadResult = { status: "ok"; puzzle: Puzzle } | { status: "none" } | { status: "error" }`; `loadPuzzleResult(date: string, fetchFn?: typeof fetch): Promise<LoadResult>` (never rejects; fetches `/word-puzzles/<month>.json`; `none` for a 404 or a date missing from the file; `error` for a network failure or non-404 failure); successful month files are cached in memory, failures are not; `prefetchMonth(month: string, fetchFn?: typeof fetch): void`; `clearPuzzleCache(): void`.

- [ ] **Step 1: Write the failing tests.** `storage.test.ts`: `readAll` with `getItem` returning `null` is `{}`; returning `"not json"` is `{}`; a throwing `getItem` is `{}`; returning `{"2026-11-12":{"found":["PEN"],"bonus":[],"hints":[],"solved":false}}` parses to that object; `{"2026-11-12":{"found":"x"},"2026-11-11":{"found":[],"bonus":[],"hints":[],"solved":true}}` keeps only `2026-11-11`; `writeAll` returns `true` and stores `JSON.stringify` under `"word-game:v1"` with a working `setItem`, `false` with a throwing one. `load-puzzle.test.ts` (fake `fetchFn`, call `clearPuzzleCache()` in `beforeEach`): returns `{status:"ok", puzzle}` for a date in the month file; `none` on a 404; `none` when the date is missing from the file; `error` when `fetchFn` rejects; `error` on a 500; two dates in one month call `fetchFn` once; after an `error`, the next call fetches again and can succeed.
- [ ] **Step 2: Run to verify failure.** Run: `npx vitest run lib/word-game`. Expected: FAIL.
- [ ] **Step 3: Implement both modules** to the signatures above. Cache month files as promises keyed by month and drop the entry when the result is `error`.
- [ ] **Step 4: Run to verify pass.** Run: `npx vitest run lib/word-game`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add lib/word-game && git commit -m "feat: word game storage and puzzle loading"`

### Task 5: Puzzle builder, generator script and generated data

**Files:**
- Create: `scripts/word-puzzles/config.ts`, `scripts/word-puzzles/build.ts`, `scripts/word-puzzles/generate.ts`, `scripts/word-puzzles/blocklist.txt`, `public/word-puzzles/*.json` (generated)
- Modify: `package.json` (devDependencies `popular-english-words`, `word-list`, `badwords-list`; script `"words:generate": "tsx scripts/word-puzzles/generate.ts"`)
- Test: `scripts/word-puzzles/build.test.ts`, `lib/word-game/puzzle-data.test.ts`

**Interfaces:**
- Consumes: `hashString`, `mulberry32`, `layoutCrossword` (Task 3); `findLayoutProblems` (Task 3); `Puzzle`, `MonthFile` (Task 1); `shiftDate`, `monthOf` (Task 2).
- Produces (`config.ts`): `START_DATE = "2026-11-01"`, `END_DATE = "2029-12-31"`; `sizeForDate(date: string): { letters: number; gridWords: number }` per the weekday table in Global Constraints.
- Produces (`build.ts`): `type Lists = { common: string[]; valid: Set<string>; blocked: Set<string> }` (all lowercase); `class NoPuzzleError extends Error`; `buildPuzzle(date: string, lists: Lists): Puzzle`. It picks a base word of the day's length from `common` (seeded by the date) that has at least `gridWords + 2` common words spellable from its letters, shuffles the wheel letters, picks the grid words (the base word plus the rest), lays them out with up to 30 attempts of `layoutCrossword`, and sets `bonus` to every other word of 3 or more letters in `valid` that is spellable from the letters and not blocked. Throws `NoPuzzleError` when it cannot.
- Produces (`generate.ts`): a CLI that builds `Lists` from the three packages (`words.getMostPopular(20000)` intersected with `word-list`, 3 to 7 letters, a to z only; blocklist = `badwords-list` array plus `scripts/word-puzzles/blocklist.txt`), builds every date from `START_DATE` to `END_DATE`, writes compact JSON to `public/word-puzzles/YYYY-MM.json`, prints a summary, and exits non-zero if any date failed.

- [ ] **Step 1: Write the failing tests.** `build.test.ts` with a small hand-made `Lists` (`common`: plane, pen, ale, lap, nap, pal, lea, pea, ape; `valid`: those plus lean, lane, plan, plea, elan, neap, pane; `blocked`: empty, and a second case blocking `lap`): `sizeForDate` gives `{5,4}` for `2026-11-09` and `2026-11-10`, `{6,6}` for `2026-11-11`, `2026-11-12`, `2026-11-13`, `{7,8}` for `2026-11-14` and `2026-11-15`; `buildPuzzle("2026-11-09", lists)` returns letters that are an anagram of `PLANE`, exactly 4 grid words including `PLANE`, every grid word spellable from the letters, `findLayoutProblems` empty, `bonus` excluding the grid words and containing only words of `valid` spellable from the letters, and `lap` absent when blocked; calling it twice gives deep-equal results; with `common` too small it throws `NoPuzzleError`. `puzzle-data.test.ts` reads every `public/word-puzzles/*.json` with `fs` and asserts: a file exists for every month from `START_DATE` to `END_DATE`; a puzzle exists for every date in that range; each puzzle's `letters.length` and `words.length` match `sizeForDate`; every grid word is spellable from the letters (with multiplicity) and is not in `bonus`; `findLayoutProblems` is empty; every word is 3 or more uppercase letters; no word is in the `badwords-list` array or the blocklist file; each file is under 250 KB.
- [ ] **Step 2: Run to verify failure.** Run: `npx vitest run scripts lib/word-game/puzzle-data.test.ts`. Expected: FAIL.
- [ ] **Step 3: Install the dev dependencies and implement `config.ts` and `build.ts`.** Run: `npm install -D popular-english-words word-list badwords-list`. Run the build tests: `npx vitest run scripts`. Expected: PASS.
- [ ] **Step 4: Implement `generate.ts` and run it.** Run: `npm run words:generate`. Expected: a summary showing every date built and no failures; if some dates fail, relax the base-word search (try more base words before giving up) rather than lowering the sizes.
- [ ] **Step 5: Run the data test.** Run: `npx vitest run lib/word-game/puzzle-data.test.ts`. Expected: PASS. Open three generated puzzles (a Monday, a Thursday, a Sunday) and read the grid words and a sample of the bonus words; if obscure or rude words appear, add them to `scripts/word-puzzles/blocklist.txt` and regenerate.
- [ ] **Step 6: Commit.** `git add scripts public/word-puzzles package.json package-lock.json lib/word-game/puzzle-data.test.ts && git commit -m "feat: word puzzle generator and three years of generated puzzles"`

### Task 6: Wheel, grid and progress hook components

**Files:**
- Create: `components/word-game/use-word-progress.ts`, `components/word-game/crossword-grid.tsx`, `components/word-game/letter-wheel.tsx`

**Interfaces:**
- Consumes: `readAll`, `writeAll` (Task 4); `Progress`, `AllProgress`, `emptyProgress`, `revealedCells` (Task 1); `gridCells`, `Puzzle` (Task 1); `letterPositions`, `letterAt`, `extendChain` (Task 2).
- Produces (`use-word-progress.ts`): `useWordProgress(date: string): { all: AllProgress; progress: Progress; update(next: Progress): void; persistent: boolean }`. Backed by `useSyncExternalStore` with a module-level cache of the raw string and its parse (so the snapshot is stable), a custom change event, and the `storage` event, in the style of `lib/hide-amounts.ts`. `persistent` is false when a write failed.
- Produces (`crossword-grid.tsx`): `CrosswordGrid({ puzzle, revealed, justFound }: { puzzle: Puzzle; revealed: Set<string>; justFound: string | null })`. Squares that belong to a word render as a rounded tile, showing the letter when revealed and blank otherwise; squares not in any word render nothing; the squares of the word `justFound` pop (a short scale animation, none under reduced motion).
- Produces (`letter-wheel.tsx`): `LetterWheel({ letters, onSubmit, onChange, shakeKey, onFirstTouch }: { letters: string[]; onSubmit(word: string): void; onChange?(word: string): void; shakeKey: number; onFirstTouch?(): void })`. A round card with the letters on tiles at `letterPositions`; pointer down on a tile starts a chain, moving over tiles extends it with `extendChain` and `letterAt`, a line follows through the chain's tiles and the finger, and release calls `onSubmit` with the spelled word and clears the chain. The container sets `touch-action: none` and captures the pointer. A change of `shakeKey` plays a short shake (none under reduced motion).

- [ ] **Step 1: Implement the three files** to those interfaces, using existing patterns: lowercase text, `bg-card` cards with `ring-1 ring-black/5 dark:ring-white/10`, emerald accents.
- [ ] **Step 2: Typecheck and lint.** Run: `npx tsc --noEmit` and `npx eslint components/word-game`. Expected: no errors.
- [ ] **Step 3: Commit.** `git add components/word-game && git commit -m "feat: word game wheel, grid and progress hook"`

### Task 7: Game screen, page and navigation

**Files:**
- Create: `components/word-game/word-game.tsx`, `app/(dashboard)/word-game/page.tsx`
- Modify: `components/bottom-nav.tsx` (add `{ href: "/word-game", label: "daily word", Icon: Puzzle }` to `ALL_ITEMS`, import `Puzzle` from `lucide-react`), `components/sidebar-nav.tsx` (add `{ href: "/word-game", label: "Daily word", Icon: Puzzle }` under Manage), `components/mobile-top-bar.tsx` (add `"/word-game"` to `HIDE_BACK_PATHS`), `components/use-wallet-dashboard.ts` (add `pathname === "/word-game"` to `usePageOwnsMobileHeader`)

**Interfaces:**
- Consumes: everything from Tasks 1 to 6; `DayPicker({ date, today })` from `components/day-picker.tsx`; `playChaChing`, `primeAudio` from `lib/sound/cha-ching`; `triggerHaptic` from `lib/haptics`; `canvas-confetti`.
- Produces: `WordGame({ date, today }: { date: string; today: string })` (client); the page reads `?date=`, resolves it with `resolveDate(params.date, manilaToday())`, and renders `<WordGame key={date} date={date} today={today} />`.

- [ ] **Step 1: Implement `WordGame`.** It has the green band (same markup pattern as `components/components-2/dashboard/daily-payments-view.tsx`) labelled "daily word", with a streak chip (`currentStreak(solvedDates(all), today)`) and the date; the day picker card overlapping the band; the grid; the word being spelled; the wheel with shuffle (`shuffled`), hint (`pickHintCell` then `addHint`, disabled when it returns `null`) and a "bonus N" chip. It loads the puzzle with `use()` on a cached `loadPuzzleResult(date)` promise inside `Suspense`, and shows "no puzzle for this day" for `none` and "couldn't load, try when online" with a retry (`clearPuzzleCache()` then a fresh promise) for `error`. It calls `prefetchMonth` for the next month. On submit it uses `classifyWord`: a new grid word calls `addFound`, then `playChaChing("partial")` and `triggerHaptic("success")`; a new bonus word calls `addBonus` and `triggerHaptic("light")`; an already found word or a non-word bumps `shakeKey`, shows a short lowercase note ("already found" or "not a word") for about 1.2 seconds, and calls `triggerHaptic("error")`. When `addFound` makes the puzzle solved it fires confetti (`disableForReducedMotion: true`) and `playChaChing("full")`, and shows a "solved" panel with words found and bonus count and a note to come back tomorrow. When `persistent` is false it shows a quiet note that progress won't be saved. `primeAudio()` runs on the wheel's first touch.
- [ ] **Step 2: Add the page and the four registrations** listed under Files.
- [ ] **Step 3: Typecheck, lint and run all tests.** Run: `npx tsc --noEmit`, `npx eslint components/word-game "app/(dashboard)/word-game" components/bottom-nav.tsx components/sidebar-nav.tsx`, `npx vitest run`. Expected: no new errors; all tests pass.
- [ ] **Step 4: Check it in a phone-sized browser** on the dev server at `/word-game` (if the preview is signed out, sign in is the owner's step): the more menu shows "daily word"; swipe a grid word and see the squares fill; swipe a bonus word and see the chip rise; swipe a wrong word and see the shake; the back-to-previous-tile gesture removes the last letter; shuffle moves the letters; hint reveals a square and stops being available only when nothing is left; solve the puzzle and see confetti, the solved panel and the streak chip update; reload and see progress kept; pick yesterday and see a different, playable puzzle; try `?date=2099-01-01` and `?date=garbage` (both fall back to today) and a date before `2026-11-01` ("no puzzle for this day").
- [ ] **Step 5: Commit.** `git add components app && git commit -m "feat: daily word game page and navigation"`

### Task 8: Handover note on extending the horizon

**Files:**
- Modify: `docs/superpowers/specs/2026-11-12-daily-word-game-design.md` (record the final decisions under "Open details for the plan": the three packages and licences, that the service worker already keeps these files, and that found-word sounds reuse `playChaChing`)
- Create: `scripts/word-puzzles/README.md` (how to extend: change `END_DATE` in `config.ts`, run `npm run words:generate`, run `npx vitest run lib/word-game/puzzle-data.test.ts`, commit the new files)

- [ ] **Step 1: Write both documents.**
- [ ] **Step 2: Commit.** `git add docs scripts/word-puzzles/README.md && git commit -m "docs: how to extend the daily word puzzles"`
