import type { Puzzle } from "./puzzle";
import { wordCells } from "./puzzle";

/**
 * What is wrong with a crossword layout, as messages; empty when it is valid.
 * Valid means: every word is inside the grid, words sharing a square agree on
 * its letter, and every row or column run of 2 or more filled squares is
 * exactly one placed word (so no accidental words from side-by-side words).
 */
export function findLayoutProblems(
  puzzle: Pick<Puzzle, "grid" | "words">,
): string[] {
  const problems: string[] = [];
  const { rows, cols } = puzzle.grid;
  const letters = new Map<string, string>();

  for (const placed of puzzle.words) {
    wordCells(placed).forEach(([r, c], i) => {
      if (r < 0 || c < 0 || r >= rows || c >= cols) {
        problems.push(`${placed.word} runs outside the grid at ${r},${c}`);
        return;
      }
      const key = `${r},${c}`;
      const letter = placed.word[i];
      const have = letters.get(key);
      if (have !== undefined && have !== letter) {
        problems.push(`${key} is both ${have} and ${letter}`);
      }
      letters.set(key, letter);
    });
  }

  const isPlaced = (r: number, c: number, length: number, dir: string) =>
    puzzle.words.some(
      (w) =>
        w.dir === dir && w.row === r && w.col === c && w.word.length === length,
    );

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (!letters.has(`${r},${c}`)) continue;
      if (!letters.has(`${r},${c - 1}`)) {
        let end = c;
        while (letters.has(`${r},${end + 1}`)) end += 1;
        const length = end - c + 1;
        if (length >= 2 && !isPlaced(r, c, length, "across")) {
          problems.push(`row ${r} has an unplaced run at ${c}-${end}`);
        }
      }
      if (!letters.has(`${r - 1},${c}`)) {
        let end = r;
        while (letters.has(`${end + 1},${c}`)) end += 1;
        const length = end - r + 1;
        if (length >= 2 && !isPlaced(r, c, length, "down")) {
          problems.push(`column ${c} has an unplaced run at ${r}-${end}`);
        }
      }
    }
  }
  return problems;
}
