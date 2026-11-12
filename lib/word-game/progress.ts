import { wordCells, type Puzzle } from "./puzzle";

export type Progress = {
  /** Grid words found, uppercase. */
  found: string[];
  /** Bonus words found, uppercase. */
  bonus: string[];
  /** Squares revealed by hints, `[row, col]`. */
  hints: Array<[number, number]>;
  solved: boolean;
};

/** Progress for every date played, keyed by `yyyy-mm-dd`. */
export type AllProgress = Record<string, Progress>;

export const emptyProgress: Progress = {
  found: [],
  bonus: [],
  hints: [],
  solved: false,
};

/** Solved once every grid word has been spelled. Hints never count. */
export function isSolved(puzzle: Puzzle, p: Progress): boolean {
  return puzzle.words.every((w) => p.found.includes(w.word));
}

export function addFound(puzzle: Puzzle, p: Progress, word: string): Progress {
  const w = word.toUpperCase();
  const next = p.found.includes(w) ? p : { ...p, found: [...p.found, w] };
  return { ...next, solved: isSolved(puzzle, next) };
}

export function addBonus(p: Progress, word: string): Progress {
  const w = word.toUpperCase();
  return p.bonus.includes(w) ? p : { ...p, bonus: [...p.bonus, w] };
}

export function addHint(p: Progress, cell: [number, number]): Progress {
  const has = p.hints.some(([r, c]) => r === cell[0] && c === cell[1]);
  return has ? p : { ...p, hints: [...p.hints, cell] };
}

/** Keys (`"row,col"`) of the squares showing a letter: found words and hints. */
export function revealedCells(puzzle: Puzzle, p: Progress): Set<string> {
  const out = new Set<string>();
  for (const placed of puzzle.words) {
    if (!p.found.includes(placed.word)) continue;
    for (const [r, c] of wordCells(placed)) out.add(`${r},${c}`);
  }
  for (const [r, c] of p.hints) out.add(`${r},${c}`);
  return out;
}

/**
 * A random square still hidden, in a word not yet found; null when there is
 * none. Squares are ordered row-major and picked by `random`.
 */
export function pickHintCell(
  puzzle: Puzzle,
  p: Progress,
  random: () => number = Math.random,
): [number, number] | null {
  const revealed = revealedCells(puzzle, p);
  const open = new Map<string, [number, number]>();
  for (const placed of puzzle.words) {
    if (p.found.includes(placed.word)) continue;
    for (const [r, c] of wordCells(placed)) {
      if (!revealed.has(`${r},${c}`)) open.set(`${r},${c}`, [r, c]);
    }
  }
  const cells = [...open.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (cells.length === 0) return null;
  return cells[Math.floor(random() * cells.length)];
}
