import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  ENDLESS_FROM,
  LEVEL_COUNT,
  bankLevel,
  goldenLetter,
  levelFile,
  levelSize,
  type LevelFile,
} from "./levels";
import { classifyWord } from "./puzzle";
import { findLayoutProblems } from "./layout-check";

describe("levelSize", () => {
  it("starts small and ramps up", () => {
    expect(levelSize(1)).toEqual({ letters: 4, gridWords: 3 });
    expect(levelSize(30).letters).toBe(5);
    expect(levelSize(501)).toEqual({ letters: 7, gridWords: 7 });
  });
  it("gives every 10th level more words", () => {
    expect(levelSize(20).gridWords).toBe(levelSize(19).gridWords + 1);
    expect(levelSize(200).gridWords).toBe(levelSize(199).gridWords + 2);
  });
});

describe("levelFile and bankLevel", () => {
  it("puts 100 levels in a file", () => {
    expect([1, 100, 101, 1000].map(levelFile)).toEqual([
      "001",
      "001",
      "002",
      "010",
    ]);
  });
  it("replays every hard level once a lap after the last", () => {
    expect(bankLevel(LEVEL_COUNT)).toBe(LEVEL_COUNT);
    const span = LEVEL_COUNT - ENDLESS_FROM + 1;
    const lap = new Set(
      Array.from({ length: span }, (_, i) => bankLevel(LEVEL_COUNT + 1 + i)),
    );
    expect(lap.size).toBe(span);
    expect(Math.min(...lap)).toBe(ENDLESS_FROM);
    expect(Math.max(...lap)).toBe(LEVEL_COUNT);
  });
});

describe("the made levels", () => {
  const files = Array.from(
    { length: LEVEL_COUNT / 100 },
    (_, i) =>
      JSON.parse(
        readFileSync(
          `public/word-levels/${levelFile(i * 100 + 1)}.json`,
          "utf8",
        ),
      ) as LevelFile,
  );
  const all = files.flatMap((f) => f.levels);

  it("has every level, each the size its number asks for", () => {
    expect(all).toHaveLength(LEVEL_COUNT);
    all.forEach((puzzle, i) => {
      const size = levelSize(i + 1);
      expect(puzzle.letters).toHaveLength(size.letters);
      expect(puzzle.words).toHaveLength(size.gridWords);
    });
  });
  it("lays every level out cleanly", () => {
    for (const puzzle of all) {
      expect(findLayoutProblems(puzzle)).toEqual([]);
      for (const w of puzzle.words)
        expect(classifyWord(puzzle, w.word)).toBe("grid");
    }
  });
  it("never repeats a wheel, anagrams included", () => {
    const sets = all.map((p) => [...p.letters].sort().join(""));
    expect(new Set(sets).size).toBe(sets.length);
  });
  it("gives every third level a golden letter from its wheel", () => {
    expect(goldenLetter(1, all[0])).toBeNull();
    const gold = goldenLetter(3, all[2]);
    expect(gold && all[2].letters.includes(gold)).toBe(true);
  });
});
