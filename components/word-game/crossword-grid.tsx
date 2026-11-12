"use client";

import { m } from "motion/react";

import { cn } from "@/lib/utils";
import { gridCells, wordCells, type Puzzle } from "@/lib/word-game/puzzle";

const GAP = 3;
/** The biggest a tile gets, so a small grid doesn't blow up. */
const MAX_TILE = 52;

/**
 * The crossword: a rounded tile for every square that belongs to a word, with
 * its letter once revealed. It fills the box it is given and shrinks to fit
 * (sized in container units), so the page never has to scroll. The squares of
 * `justFound` pop in.
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
  const found = puzzle.words.find((w) => w.word === justFound);
  const popping = new Set(
    (found ? wordCells(found) : []).map(([r, c]) => `${r},${c}`),
  );
  const { rows, cols } = puzzle.grid;

  return (
    <div
      className="flex size-full items-center justify-center"
      style={{ containerType: "size" }}
    >
      <div
        className="grid"
        role="img"
        aria-label={`Crossword, ${puzzle.words.length} words`}
        style={{
          gap: GAP,
          width: `min(100cqw, calc(100cqh * ${cols} / ${rows}), ${cols * MAX_TILE}px)`,
          aspectRatio: `${cols} / ${rows}`,
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          fontSize: `calc(min(100cqw / ${cols}, 100cqh / ${rows}, ${MAX_TILE}px) * 0.55)`,
        }}
      >
        {Array.from({ length: rows * cols }, (_, i) => {
          const row = Math.floor(i / cols);
          const col = i % cols;
          const key = `${row},${col}`;
          const letter = cells.get(key);
          if (letter === undefined) {
            return <span key={key} aria-hidden="true" />;
          }
          const shown = revealed.has(key);
          return (
            <m.span
              key={popping.has(key) ? `${key}-${justFound}` : key}
              initial={popping.has(key) ? { scale: 0.6 } : false}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 18 }}
              className={cn(
                `flex items-center justify-center rounded-md leading-none
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
    </div>
  );
}
