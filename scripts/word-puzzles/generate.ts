/**
 * Builds every daily word puzzle from START_DATE to END_DATE and writes one
 * file per month to public/word-puzzles/YYYY-MM.json. Run by hand:
 *
 *   npm run words:generate            (dates up to today keep their puzzles)
 *   npm run words:generate -- --force (rebuild every date)
 *
 * Inputs: `word-list` (every word that counts), `popular-english-words` (the
 * words that may be in the grid, most popular first), and a blocklist from
 * `badwords-list` plus scripts/word-puzzles/blocklist.txt.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { manilaToday, monthOf, shiftDate } from "../../lib/word-game/date";
import type { MonthFile } from "../../lib/word-game/puzzle";
import { buildPuzzle, NoPuzzleError } from "./build";
import { buildLists } from "./lists";
import { END_DATE, START_DATE } from "./config";
import { shouldKeep } from "./keep";

const OUT = join("public", "word-puzzles");
const lists = buildLists();
console.log(
  `Lists: ${lists.valid.size} valid, ${lists.common.length} common, ${lists.blocked.size} blocked`,
);

const force = process.argv.includes("--force");
const today = manilaToday();

/** The month file already on disk, if any. */
function existingMonth(month: string): MonthFile | null {
  const path = join(OUT, `${month}.json`);
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as MonthFile)
    : null;
}

const months = new Map<string, MonthFile>();
const failed: string[] = [];
let kept = 0;
for (let date = START_DATE; date <= END_DATE; date = shiftDate(date, 1)) {
  try {
    const month = monthOf(date);
    const file = months.get(month) ?? { month, puzzles: {} };
    const old = existingMonth(month)?.puzzles[date];
    if (old && shouldKeep(date, today, true, force)) {
      file.puzzles[date] = old;
      kept += 1;
    } else {
      file.puzzles[date] = buildPuzzle(date, lists);
    }
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
console.log(
  `Wrote ${months.size} files, ${puzzles} puzzles (${kept} kept as they were).`,
);
if (failed.length > 0) {
  console.error(
    `No puzzle for ${failed.length} dates: ${failed.slice(0, 10).join(", ")}`,
  );
  process.exit(1);
}
