import { shuffled } from "../../lib/word-game/wheel";
import type { Puzzle } from "../../lib/word-game/puzzle";
import { findLayoutProblems } from "../../lib/word-game/layout-check";
import { sizeForDate } from "./config";
import { layoutCrossword } from "./layout";
import { hashString, mulberry32 } from "./rng";

/** All lowercase. `common` may be grid words; `valid` is every word that counts. */
export type Lists = {
  common: string[];
  valid: Set<string>;
  blocked: Set<string>;
};

export class NoPuzzleError extends Error {}

const LAYOUT_ATTEMPTS = 30;

const bit = (ch: string) => 1 << (ch.charCodeAt(0) - 97);
const maskOf = (word: string) =>
  [...word].reduce((mask, ch) => mask | bit(ch), 0);

function counts(word: string): number[] {
  const out = new Array<number>(26).fill(0);
  for (const ch of word) out[ch.charCodeAt(0) - 97] += 1;
  return out;
}

/** Whether `word` can be spelled from `base`'s letters (with multiplicity). */
function spellable(word: string, base: number[]): boolean {
  const need = counts(word);
  return need.every((n, i) => n <= base[i]);
}

type Indexed = { word: string; mask: number };
const indexes = new WeakMap<Set<string>, Indexed[]>();

/** The valid words of 3 or more letters, each with a letter mask, computed once. */
function indexOf(valid: Set<string>): Indexed[] {
  let index = indexes.get(valid);
  if (!index) {
    index = [...valid]
      .filter((w) => w.length >= 3)
      .map((word) => ({ word, mask: maskOf(word) }));
    indexes.set(valid, index);
  }
  return index;
}

/**
 * The puzzle for a date: a base word of the day's length, the wheel made from
 * its letters, grid words laid out as a crossword, and every other valid word
 * that fits the letters as a bonus. The same date always gives the same
 * puzzle. Throws `NoPuzzleError` when the lists cannot make one.
 */
export function buildPuzzle(date: string, lists: Lists): Puzzle {
  const { letters: size, gridWords } = sizeForDate(date);
  const random = mulberry32(hashString(date));
  const ok = (w: string) => !lists.blocked.has(w);

  const bases = shuffled(
    lists.common.filter(
      (w) => w.length === size && ok(w) && lists.valid.has(w),
    ),
    random,
  );

  for (const base of bases) {
    const have = counts(base);
    const candidates = lists.common.filter(
      (w) => w.length >= 3 && w.length <= size && ok(w) && spellable(w, have),
    );
    if (candidates.length < gridWords + 2) continue;
    const others = candidates.filter((w) => w !== base);

    for (let attempt = 0; attempt < LAYOUT_ATTEMPTS; attempt += 1) {
      const chosen = [
        base,
        ...shuffled(others, random).slice(0, gridWords - 1),
      ].map((w) => w.toUpperCase());
      const layout = layoutCrossword(chosen, random);
      if (!layout || findLayoutProblems(layout).length > 0) continue;

      let wheel = base.toUpperCase();
      for (let i = 0; i < 10 && wheel === base.toUpperCase(); i += 1) {
        wheel = shuffled([...base.toUpperCase()], random).join("");
      }
      const inGrid = new Set(chosen);
      const baseMask = maskOf(base);
      const bonus = indexOf(lists.valid)
        .filter(
          ({ word, mask }) =>
            word.length <= size &&
            (mask & ~baseMask) === 0 &&
            ok(word) &&
            spellable(word, have),
        )
        .map(({ word }) => word.toUpperCase())
        .filter((w) => !inGrid.has(w))
        .sort();
      return { letters: wheel, grid: layout.grid, words: layout.words, bonus };
    }
  }
  throw new NoPuzzleError(`No puzzle could be built for ${date}`);
}
