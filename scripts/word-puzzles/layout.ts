import { findLayoutProblems } from "../../lib/word-game/layout-check";
import type { PlacedWord } from "../../lib/word-game/puzzle";

export type Layout = {
  grid: { rows: number; cols: number };
  words: PlacedWord[];
};

const MAX_SIDE = 8;

/** Shift so the top-left is 0,0 and measure the box. */
function normalise(words: PlacedWord[]): Layout {
  const minRow = Math.min(...words.map((w) => w.row));
  const minCol = Math.min(...words.map((w) => w.col));
  const shifted = words.map((w) => ({
    ...w,
    row: w.row - minRow,
    col: w.col - minCol,
  }));
  let rows = 0;
  let cols = 0;
  for (const w of shifted) {
    rows = Math.max(rows, w.dir === "down" ? w.row + w.word.length : w.row + 1);
    cols = Math.max(
      cols,
      w.dir === "across" ? w.col + w.word.length : w.col + 1,
    );
  }
  return { grid: { rows, cols }, words: shifted };
}

/**
 * Lays the words out as a crossword in which they all connect by crossings.
 * Longest first; each later word goes where it crosses an earlier one, keeps
 * the layout valid (see `findLayoutProblems`) and makes the smallest box,
 * ties broken by `random`. Null when some word cannot be placed.
 */
export function layoutCrossword(
  words: string[],
  random: () => number,
): Layout | null {
  const order = [...words].sort((a, b) => b.length - a.length);
  if (order.length === 0) return null;
  let placed: PlacedWord[] = [
    { word: order[0], row: 0, col: 0, dir: "across" },
  ];

  for (const word of order.slice(1)) {
    let best: { words: PlacedWord[]; area: number; tie: number }[] = [];
    for (const other of placed) {
      for (let i = 0; i < word.length; i += 1) {
        for (let j = 0; j < other.word.length; j += 1) {
          if (word[i] !== other.word[j]) continue;
          const candidate: PlacedWord =
            other.dir === "across"
              ? { word, row: other.row - i, col: other.col + j, dir: "down" }
              : { word, row: other.row + j, col: other.col - i, dir: "across" };
          const layout = normalise([...placed, candidate]);
          if (layout.grid.rows > MAX_SIDE || layout.grid.cols > MAX_SIDE) {
            continue;
          }
          if (findLayoutProblems(layout).length > 0) continue;
          best.push({
            words: [...placed, candidate],
            area: layout.grid.rows * layout.grid.cols,
            tie: random(),
          });
        }
      }
    }
    if (best.length === 0) return null;
    const smallest = Math.min(...best.map((b) => b.area));
    best = best.filter((b) => b.area === smallest);
    best.sort((a, b) => a.tie - b.tie);
    placed = best[0].words;
  }
  return normalise(placed);
}
