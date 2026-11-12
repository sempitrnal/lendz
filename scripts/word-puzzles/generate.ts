/**
 * Builds every daily word puzzle from START_DATE to END_DATE and writes one
 * file per month to public/word-puzzles/YYYY-MM.json. Run by hand:
 *
 *   npm run words:generate
 *
 * Inputs: `word-list` (every word that counts), `popular-english-words` (the
 * words that may be in the grid, most popular first), and a blocklist from
 * `badwords-list` plus scripts/word-puzzles/blocklist.txt.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import wordListPath from "word-list";
import { words as popular } from "popular-english-words";
import { array as badWords } from "badwords-list";
import { monthOf, shiftDate } from "../../lib/word-game/date";
import type { MonthFile } from "../../lib/word-game/puzzle";
import { buildPuzzle, NoPuzzleError, type Lists } from "./build";
import { END_DATE, START_DATE } from "./config";

const POPULAR_COUNT = 20000;
/**
 * How popular a word must be to go in the grid, by length. The popularity
 * list comes from Wikipedia, so rare short words are mostly names and
 * abbreviations; short words are held to a much higher bar.
 */
const MAX_RANK_BY_LENGTH: Record<number, number> = { 3: 1500, 4: 4000 };
const MAX_RANK_LONGER = 9000;
const OUT = join("public", "word-puzzles");
const WORD = /^[a-z]{3,7}$/;

function buildLists(): Lists {
  const valid = new Set(
    readFileSync(wordListPath, "utf8")
      .split("\n")
      .map((w) => w.trim().toLowerCase())
      .filter((w) => WORD.test(w)),
  );
  const extra = readFileSync(
    join("scripts", "word-puzzles", "blocklist.txt"),
    "utf8",
  )
    .split("\n")
    .filter((line) => line.trim() && !line.startsWith("#"));
  const blocked = new Set(
    [...badWords, ...extra].map((w) => w.trim().toLowerCase()),
  );
  const common = popular
    .getMostPopular(POPULAR_COUNT)
    .map((w: string) => w.toLowerCase())
    .filter(
      (w: string, rank: number) =>
        WORD.test(w) &&
        valid.has(w) &&
        !blocked.has(w) &&
        rank < (MAX_RANK_BY_LENGTH[w.length] ?? MAX_RANK_LONGER),
    );
  return { common, valid, blocked };
}

const lists = buildLists();
console.log(
  `Lists: ${lists.valid.size} valid, ${lists.common.length} common, ${lists.blocked.size} blocked`,
);

const months = new Map<string, MonthFile>();
const failed: string[] = [];
for (let date = START_DATE; date <= END_DATE; date = shiftDate(date, 1)) {
  try {
    const month = monthOf(date);
    const file = months.get(month) ?? { month, puzzles: {} };
    file.puzzles[date] = buildPuzzle(date, lists);
    months.set(month, file);
  } catch (error) {
    if (!(error instanceof NoPuzzleError)) throw error;
    failed.push(date);
  }
}

mkdirSync(OUT, { recursive: true });
let puzzles = 0;
for (const [month, file] of months) {
  writeFileSync(join(OUT, `${month}.json`), JSON.stringify(file));
  puzzles += Object.keys(file.puzzles).length;
}
console.log(`Wrote ${months.size} files, ${puzzles} puzzles.`);
if (failed.length > 0) {
  console.error(`No puzzle for ${failed.length} dates: ${failed.slice(0, 10).join(", ")}`);
  process.exit(1);
}
