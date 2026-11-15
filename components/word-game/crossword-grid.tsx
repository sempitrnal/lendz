"use client";

import { m, useReducedMotion } from "motion/react";

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
  // The found word's squares, in spelling order, so they flip in one by one.
  const popping = new Map(
    (found ? wordCells(found) : []).map(([r, c], i) => [`${r},${c}`, i]),
  );
  const reduceMotion = useReducedMotion();
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
          const order = popping.get(key);
          return (
            <m.span
              key={order !== undefined ? `${key}-${justFound}` : key}
              initial={
                reduceMotion
                  ? false
                  : order !== undefined
                    ? { scale: 0.4, rotateX: 90 }
                    : { scale: 0.5, opacity: 0 }
              }
              animate={{ scale: 1, rotateX: 0, opacity: 1 }}
              transition={{
                type: "spring",
                stiffness: 460,
                damping: 20,
                // A found word flips in letter by letter; on load the grid
                // ripples in from the top left.
                delay: order !== undefined ? order * 0.06 : (row + col) * 0.025,
              }}
              className={cn(
                `flex items-center justify-center rounded-md leading-none
                font-black lowercase`,
                shown ? "wg-fill shadow-sm" : "wg-cell",
              )}
            >
              {shown ? (
                <m.span
                  initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 600, damping: 22 }}
                >
                  {letter}
                </m.span>
              ) : (
                ""
              )}
            </m.span>
          );
        })}
      </div>
    </div>
  );
}
