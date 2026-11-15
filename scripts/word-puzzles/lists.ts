/**
 * The word lists every generator uses: `word-list` (every word that counts),
 * `popular-english-words` (the words that may be in the grid, most popular
 * first), and a blocklist from `badwords-list` plus blocklist.txt.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import wordListPath from "word-list";
import { words as popular } from "popular-english-words";
import { array as badWords } from "badwords-list";
import type { Lists } from "./build";

const POPULAR_COUNT = 20000;
/**
 * How popular a word must be to go in the grid, by length. The popularity
 * list comes from Wikipedia, so rare short words are mostly names and
 * abbreviations; short words are held to a much higher bar.
 */
const MAX_RANK_BY_LENGTH: Record<number, number> = { 3: 1500, 4: 4000 };
const MAX_RANK_LONGER = 9000;
const WORD = /^[a-z]{3,7}$/;

export function buildLists(): Lists {
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
