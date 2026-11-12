import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { array as badWords } from "badwords-list";
import { describe, expect, it } from "vitest";
import { END_DATE, START_DATE, sizeForDate } from "../../scripts/word-puzzles/config";
import { shiftDate, monthOf } from "./date";
import { findLayoutProblems } from "./layout-check";
import type { MonthFile } from "./puzzle";

const DIR = join(process.cwd(), "public", "word-puzzles");
const blocklistFile = readFileSync(
  join(process.cwd(), "scripts", "word-puzzles", "blocklist.txt"),
  "utf8",
);
const blocked = new Set(
  [
    ...badWords,
    ...blocklistFile.split("\n").filter((l) => l.trim() && !l.startsWith("#")),
  ].map((w) => w.trim().toLowerCase()),
);

const dates: string[] = [];
for (let d = START_DATE; d <= END_DATE; d = shiftDate(d, 1)) dates.push(d);
const monthNames = [...new Set(dates.map(monthOf))];

const readMonth = (month: string): MonthFile =>
  JSON.parse(readFileSync(join(DIR, `${month}.json`), "utf8"));

const spellable = (word: string, from: string) => {
  const have: Record<string, number> = {};
  for (const ch of from) have[ch] = (have[ch] ?? 0) + 1;
  for (const ch of word) {
    if (!have[ch]) return false;
    have[ch] -= 1;
  }
  return true;
};

describe("generated word puzzles", () => {
  it("has a file for every month in the horizon", () => {
    const files = new Set(readdirSync(DIR));
    for (const month of monthNames) expect(files.has(`${month}.json`)).toBe(true);
  });

  it("keeps every file under 250 KB", () => {
    for (const month of monthNames) {
      expect(statSync(join(DIR, `${month}.json`)).size).toBeLessThan(250_000);
    }
  });

  it("has a valid puzzle for every date in the horizon", () => {
    for (const month of monthNames) {
      const file = readMonth(month);
      for (const date of dates.filter((d) => monthOf(d) === month)) {
        const puzzle = file.puzzles[date];
        expect(puzzle, date).toBeDefined();
        const size = sizeForDate(date);
        expect(puzzle.letters.length, date).toBe(size.letters);
        expect(puzzle.words.length, date).toBe(size.gridWords);
        expect(findLayoutProblems(puzzle), date).toEqual([]);
        for (const w of puzzle.words) {
          expect(w.word, date).toMatch(/^[A-Z]{3,}$/);
          expect(spellable(w.word, puzzle.letters), `${date} ${w.word}`).toBe(true);
          expect(puzzle.bonus, date).not.toContain(w.word);
          expect(blocked.has(w.word.toLowerCase()), `${date} ${w.word}`).toBe(false);
        }
        for (const w of puzzle.bonus) {
          expect(w, date).toMatch(/^[A-Z]{3,}$/);
          expect(spellable(w, puzzle.letters), `${date} ${w}`).toBe(true);
          expect(blocked.has(w.toLowerCase()), `${date} ${w}`).toBe(false);
        }
      }
    }
  });
});
