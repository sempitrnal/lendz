import { describe, expect, it } from "vitest";
import { findLayoutProblems } from "../../lib/word-game/layout-check";
import { sizeForDate } from "./config";
import { buildPuzzle, NoPuzzleError, type Lists } from "./build";

const common = ["plane", "pen", "ale", "lap", "nap", "pal", "lea", "pea", "ape"];
const extras = ["lean", "lane", "plan", "plea", "elan", "neap", "pane"];
const lists = (blocked: string[] = []): Lists => ({
  common,
  valid: new Set([...common, ...extras]),
  blocked: new Set(blocked),
});

const counts = (word: string) => {
  const out: Record<string, number> = {};
  for (const ch of word) out[ch] = (out[ch] ?? 0) + 1;
  return out;
};
const spellable = (word: string, from: string) => {
  const have = counts(from);
  return Object.entries(counts(word)).every(([ch, n]) => (have[ch] ?? 0) >= n);
};

describe("sizeForDate", () => {
  it("is 5 letters and 4 words on Monday and Tuesday", () => {
    expect(sizeForDate("2026-11-09")).toEqual({ letters: 5, gridWords: 4 });
    expect(sizeForDate("2026-11-10")).toEqual({ letters: 5, gridWords: 4 });
  });

  it("is 6 letters and 6 words from Wednesday to Friday", () => {
    for (const d of ["2026-11-11", "2026-11-12", "2026-11-13"]) {
      expect(sizeForDate(d)).toEqual({ letters: 6, gridWords: 6 });
    }
  });

  it("is 7 letters and 8 words on Saturday and Sunday", () => {
    expect(sizeForDate("2026-11-14")).toEqual({ letters: 7, gridWords: 8 });
    expect(sizeForDate("2026-11-15")).toEqual({ letters: 7, gridWords: 8 });
  });
});

describe("buildPuzzle", () => {
  const monday = "2026-11-09";

  it("uses the letters of a base word of the day's length", () => {
    const puzzle = buildPuzzle(monday, lists());
    expect([...puzzle.letters].sort().join("")).toBe("AELNP");
  });

  it("has the right number of grid words, including the base word", () => {
    const puzzle = buildPuzzle(monday, lists());
    expect(puzzle.words).toHaveLength(4);
    expect(puzzle.words.map((w) => w.word)).toContain("PLANE");
  });

  it("only uses grid words that can be spelled from the letters", () => {
    const puzzle = buildPuzzle(monday, lists());
    for (const w of puzzle.words) {
      expect(spellable(w.word, puzzle.letters)).toBe(true);
    }
  });

  it("lays the grid out without problems", () => {
    expect(findLayoutProblems(buildPuzzle(monday, lists()))).toEqual([]);
  });

  it("makes bonus exactly the other valid words that fit the letters", () => {
    const puzzle = buildPuzzle(monday, lists());
    const grid = new Set(puzzle.words.map((w) => w.word));
    const want = [...lists().valid]
      .map((w) => w.toUpperCase())
      .filter((w) => w.length >= 3 && spellable(w, puzzle.letters))
      .filter((w) => !grid.has(w))
      .sort();
    expect([...puzzle.bonus].sort()).toEqual(want);
  });

  it("keeps blocked words out of the grid and the bonus", () => {
    const puzzle = buildPuzzle(monday, lists(["lap"]));
    expect(puzzle.words.map((w) => w.word)).not.toContain("LAP");
    expect(puzzle.bonus).not.toContain("LAP");
  });

  it("gives the same puzzle for the same date", () => {
    expect(buildPuzzle(monday, lists())).toEqual(buildPuzzle(monday, lists()));
  });

  it("throws NoPuzzleError when there are not enough words", () => {
    const tiny: Lists = {
      common: ["plane", "pen"],
      valid: new Set(["plane", "pen"]),
      blocked: new Set(),
    };
    expect(() => buildPuzzle(monday, tiny)).toThrow(NoPuzzleError);
  });
});
