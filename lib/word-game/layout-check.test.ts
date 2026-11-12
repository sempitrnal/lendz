import { describe, expect, it } from "vitest";
import { findLayoutProblems } from "./layout-check";
import { testPuzzle } from "./test-puzzle";

describe("findLayoutProblems", () => {
  it("accepts a valid layout", () => {
    expect(findLayoutProblems(testPuzzle)).toEqual([]);
  });

  it("reports words stacked side by side (accidental words)", () => {
    const problems = findLayoutProblems({
      grid: { rows: 2, cols: 5 },
      words: [
        { word: "PLANE", row: 0, col: 0, dir: "across" },
        { word: "LAP", row: 1, col: 0, dir: "across" },
      ],
    });
    expect(problems.length).toBeGreaterThan(0);
  });

  it("reports a word that runs out of the grid", () => {
    const problems = findLayoutProblems({
      grid: { rows: 1, cols: 3 },
      words: [{ word: "PLANE", row: 0, col: 0, dir: "across" }],
    });
    expect(problems.length).toBeGreaterThan(0);
  });

  it("reports two words that disagree about a shared square", () => {
    const problems = findLayoutProblems({
      grid: { rows: 3, cols: 3 },
      words: [
        { word: "CAT", row: 0, col: 0, dir: "across" },
        { word: "DOG", row: 0, col: 0, dir: "down" },
      ],
    });
    expect(problems.length).toBeGreaterThan(0);
  });
});
