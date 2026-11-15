import type { Puzzle } from "./puzzle";

/**
 * The level run: numbered puzzles played one after another, made ahead of
 * time by `npm run words:levels` into public/word-levels/, LEVELS_PER_FILE per
 * file. Past the last made level the run keeps going ("endless") by replaying
 * the harder part of the bank in a scrambled order.
 */

/** How many levels are made ahead of time. */
export const LEVEL_COUNT = 1000;
export const LEVELS_PER_FILE = 100;
/** Endless levels replay the bank from here on: the 6- and 7-letter levels. */
export const ENDLESS_FROM = 151;

/** Every BIG_EVERY-th level has more words than the ones around it. */
export const BIG_EVERY = 10;

export function isBigLevel(level: number): boolean {
  return level % BIG_EVERY === 0;
}

/** The wheel size and grid-word count for a level: it ramps up slowly. */
export function levelSize(level: number): {
  letters: number;
  gridWords: number;
} {
  const base =
    level <= 5
      ? { letters: 4, gridWords: 3 }
      : level <= 20
        ? { letters: 5, gridWords: 4 }
        : level <= 60
          ? { letters: 5, gridWords: 5 }
          : level <= 150
            ? { letters: 6, gridWords: 5 }
            : level <= 300
              ? { letters: 6, gridWords: 6 }
              : { letters: 7, gridWords: 7 };
  if (!isBigLevel(level)) return base;
  return { ...base, gridWords: base.gridWords + (base.letters >= 6 ? 2 : 1) };
}

/** The file a made level is in: levels 1–100 are "001", 101–200 "002". */
export function levelFile(level: number): string {
  return String(Math.ceil(level / LEVELS_PER_FILE)).padStart(3, "0");
}

export type LevelFile = { first: number; levels: Puzzle[] };

/**
 * The made level an endless level replays: a scrambled walk through
 * ENDLESS_FROM..LEVEL_COUNT, so one doesn't come back for hundreds of levels.
 */
export function bankLevel(level: number): number {
  if (level <= LEVEL_COUNT) return level;
  const span = LEVEL_COUNT - ENDLESS_FROM + 1;
  const step = 389; // coprime with the span, so every bank level is used once a lap
  const i = (level - LEVEL_COUNT - 1) % span;
  return ENDLESS_FROM + ((i * step) % span);
}

export function isEndless(level: number): boolean {
  return level > LEVEL_COUNT;
}

/** A small stable hash, to pick a level's golden letter. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Every third level (from level 3) has a golden letter: words that use it are
 * worth double. Null on the others.
 */
export function goldenLetter(level: number, puzzle: Puzzle): string | null {
  if (level < 3 || level % 3 !== 0) return null;
  const letters = [...new Set(puzzle.letters.split(""))].sort();
  return letters[hash(`gold-${level}`) % letters.length] ?? null;
}
