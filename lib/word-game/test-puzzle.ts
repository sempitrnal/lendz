import type { Puzzle } from "./puzzle";

/** A small hand-made puzzle for tests: PLANE across, PEN and ALE down. */
export const testPuzzle: Puzzle = {
  letters: "PLANE",
  grid: { rows: 3, cols: 5 },
  words: [
    { word: "PLANE", row: 0, col: 0, dir: "across" },
    { word: "PEN", row: 0, col: 0, dir: "down" },
    { word: "ALE", row: 0, col: 2, dir: "down" },
  ],
  bonus: ["LAP", "NAP", "PAL", "PEA", "LEAN", "LANE", "PLAN", "PLEA"],
};
