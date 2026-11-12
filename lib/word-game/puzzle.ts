export type Direction = "across" | "down";

export type PlacedWord = {
  /** Uppercase. */
  word: string;
  row: number;
  col: number;
  dir: Direction;
};

export type Puzzle = {
  /** The wheel's letters, uppercase. */
  letters: string;
  grid: { rows: number; cols: number };
  /** The grid words. */
  words: PlacedWord[];
  /** Every other valid word of 3 or more letters spellable from `letters`. */
  bonus: string[];
};

export type MonthFile = { month: string; puzzles: Record<string, Puzzle> };

export type WordKind = "grid" | "bonus" | "invalid";

/** What a spelled word is worth in this puzzle. */
export function classifyWord(puzzle: Puzzle, word: string): WordKind {
  const w = word.toUpperCase();
  if (w.length < 3) return "invalid";
  if (puzzle.words.some((p) => p.word === w)) return "grid";
  if (puzzle.bonus.includes(w)) return "bonus";
  return "invalid";
}

/** The `[row, col]` of every square a word covers. */
export function wordCells(word: PlacedWord): Array<[number, number]> {
  return Array.from({ length: word.word.length }, (_, i) =>
    word.dir === "across"
      ? [word.row, word.col + i]
      : [word.row + i, word.col],
  );
}

/** Each filled square (key `"row,col"`) and the letter that belongs in it. */
export function gridCells(puzzle: Puzzle): Map<string, string> {
  const cells = new Map<string, string>();
  for (const placed of puzzle.words) {
    wordCells(placed).forEach(([row, col], i) => {
      cells.set(`${row},${col}`, placed.word[i]);
    });
  }
  return cells;
}
