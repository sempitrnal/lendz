"use client";

import { m } from "motion/react";

import { cn } from "@/lib/utils";
import { gridCells, wordCells, type Puzzle } from "@/lib/word-game/puzzle";

const TILE = 44;
const GAP = 4;

/**
 * The crossword: a rounded tile for every square that belongs to a word, with
 * its letter once revealed. The squares of `justFound` pop in.
 */
export function CrosswordGrid({
  puzzle,
  revealed,
  justFound,
}: {
  puzzle: Puzzle;
  revealed: Set<string>;
  justFound: string | null;
}) {
  const cells = gridCells(puzzle);
  const popping = new Set(
    (puzzle.words.find((w) => w.word === justFound)
      ? wordCells(puzzle.words.find((w) => w.word === justFound)!)
      : []
    ).map(([r, c]) => `${r},${c}`),
  );
  const { rows, cols } = puzzle.grid;

  return (
    <div
      className="mx-auto grid"
      style={{
        gap: GAP,
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        maxWidth: cols * TILE + (cols - 1) * GAP,
      }}
      role="img"
      aria-label={`Crossword, ${puzzle.words.length} words`}
    >
      {Array.from({ length: rows * cols }, (_, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const key = `${row},${col}`;
        const letter = cells.get(key);
        if (letter === undefined) return <span key={key} aria-hidden="true" />;
        const shown = revealed.has(key);
        return (
          <m.span
            key={popping.has(key) ? `${key}-${justFound}` : key}
            initial={popping.has(key) ? { scale: 0.6 } : false}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 18 }}
            className={cn(
              `flex aspect-square items-center justify-center rounded-lg text-lg
              font-black uppercase`,
              shown
                ? "bg-emerald-600 text-white shadow-sm"
                : `bg-emerald-100/70 ring-1 ring-emerald-200
                  dark:bg-emerald-500/10 dark:ring-emerald-500/25`,
            )}
          >
            {shown ? letter : ""}
          </m.span>
        );
      })}
    </div>
  );
}
