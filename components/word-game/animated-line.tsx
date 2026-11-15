"use client";

import type { ReactNode } from "react";
import { AnimatePresence, m } from "motion/react";

/**
 * The one line under the board (the word being spelled, a note, the combo):
 * each new thing springs in and the old one floats away. `id` says when it's
 * a new thing; the word being spelled keeps one id, so it grows in place.
 */
export function AnimatedLine({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {children ? (
        <m.div
          key={id}
          layout
          initial={{ opacity: 0, y: 10, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 520, damping: 30 }}
          className="flex min-w-0 justify-center"
        >
          {children}
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}

/** The word being spelled, each letter popping in as the finger reaches it. */
export function SpelledWord({
  word,
  className,
}: {
  word: string;
  className: string;
}) {
  return (
    <m.span
      layout
      transition={{ type: "spring", stiffness: 600, damping: 32 }}
      className={className}
    >
      {[...word].map((ch, i) => (
        <m.span
          key={i}
          initial={{ opacity: 0, y: 6, scale: 0.6 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 700, damping: 24 }}
          className="inline-block"
        >
          {ch}
        </m.span>
      ))}
    </m.span>
  );
}
