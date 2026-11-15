import { shiftDate } from "./date";
import { emptyProgress, type Progress } from "./progress";
import { wordCells, type Puzzle } from "./puzzle";

/**
 * The level run's state, kept on this device: which level you're on, its
 * progress, your coins and lifetime stats. Every change is a pure function
 * here, so the rules are easy to test and the screen only shows the result.
 */

export const START_COINS = 50;
/** Hints, in coins. */
export const LETTER_HINT_COST = 15;
export const WORD_HINT_COST = 40;
/** Coins for a bonus word, before the combo and golden letter. */
export const BONUS_WORD_COINS = 2;
/** Coins for a grid word, before the combo and golden letter. */
export const GRID_WORD_COINS = 1;
/** Coins for solving the day's daily word the first time. */
export const DAILY_SOLVE_COINS = 25;
/** Unspent coins earn this much a day, rounded down, up to the cap. */
export const INTEREST_RATE = 0.02;
export const INTEREST_CAP_PER_DAY = 50;
/** Days of interest paid at most after time away. */
export const INTEREST_MAX_DAYS = 7;
/** A word within this long of the last one keeps the combo going. */
export const COMBO_WINDOW_MS = 8000;

export type ArcadeStats = {
  levelsSolved: number;
  wordsFound: number;
  bonusFound: number;
  longestWord: string;
  bestCombo: number;
  hintsUsed: number;
  coinsEarned: number;
  interestEarned: number;
  timeAttackBest: number;
  timeAttackPlays: number;
};

export type ArcadeState = {
  level: number;
  /** Progress on `level`; reset when moving to the next. */
  progress: Progress;
  coins: number;
  /** The last day interest was paid for, `yyyy-mm-dd`; null before the first. */
  interestPaidOn: string | null;
  /** The days whose daily word already paid its bonus. */
  dailyPaid: string[];
  stats: ArcadeStats;
};

export const emptyStats: ArcadeStats = {
  levelsSolved: 0,
  wordsFound: 0,
  bonusFound: 0,
  longestWord: "",
  bestCombo: 0,
  hintsUsed: 0,
  coinsEarned: 0,
  interestEarned: 0,
  timeAttackBest: 0,
  timeAttackPlays: 0,
};

export const newArcade = (): ArcadeState => ({
  level: 1,
  progress: emptyProgress,
  coins: START_COINS,
  interestPaidOn: null,
  dailyPaid: [],
  stats: emptyStats,
});

/** The coin multiplier a combo of `combo` words in a row gives. */
export function comboMultiplier(combo: number): number {
  return combo >= 5 ? 3 : combo >= 3 ? 2 : 1;
}

/**
 * The combo after a word found at `now`: one more when the last word was
 * within the window, else back to 1.
 */
export function nextCombo(
  combo: number,
  lastAt: number | null,
  now: number,
): number {
  return lastAt !== null && now - lastAt <= COMBO_WINDOW_MS ? combo + 1 : 1;
}

/** What a found word pays: its base, times the combo, doubled if golden. */
export function wordCoins(
  word: string,
  kind: "grid" | "bonus",
  combo: number,
  golden: string | null,
): number {
  const base = kind === "grid" ? GRID_WORD_COINS : BONUS_WORD_COINS;
  const gold = golden && word.toUpperCase().includes(golden) ? 2 : 1;
  return base * comboMultiplier(combo) * gold;
}

/** What solving a level pays, on top of its words: more for bigger ones. */
export function levelCoins(puzzle: Puzzle): number {
  return 5 + puzzle.words.length * 2;
}

const longer = (a: string, b: string) => (b.length > a.length ? b : a);

/** Adds coins earned, counting them in the stats. */
function earn(state: ArcadeState, coins: number): ArcadeState {
  return {
    ...state,
    coins: state.coins + coins,
    stats: { ...state.stats, coinsEarned: state.stats.coinsEarned + coins },
  };
}

/**
 * A word found on the current level. `progress` is the level's progress
 * after it (from `addFound` / `addBonus`); `coins` what it paid. Solving the
 * level also pays the level's coins.
 */
export function recordWord(
  state: ArcadeState,
  {
    puzzle,
    progress,
    word,
    kind,
    coins,
    combo,
  }: {
    puzzle: Puzzle;
    progress: Progress;
    word: string;
    kind: "grid" | "bonus";
    coins: number;
    combo: number;
  },
): ArcadeState {
  const solvedNow = progress.solved && !state.progress.solved;
  const next = earn(
    {
      ...state,
      progress,
      stats: {
        ...state.stats,
        wordsFound: state.stats.wordsFound + (kind === "grid" ? 1 : 0),
        bonusFound: state.stats.bonusFound + (kind === "bonus" ? 1 : 0),
        longestWord: longer(state.stats.longestWord, word.toUpperCase()),
        bestCombo: Math.max(state.stats.bestCombo, combo),
        levelsSolved: state.stats.levelsSolved + (solvedNow ? 1 : 0),
      },
    },
    coins + (solvedNow ? levelCoins(puzzle) : 0),
  );
  return next;
}

/** On to the next level, with fresh progress. Only once this one is solved. */
export function nextLevel(state: ArcadeState): ArcadeState {
  if (!state.progress.solved) return state;
  return { ...state, level: state.level + 1, progress: emptyProgress };
}

/** Spends coins on a hint; null when there aren't enough. */
function spend(state: ArcadeState, cost: number): ArcadeState | null {
  if (state.coins < cost) return null;
  return {
    ...state,
    coins: state.coins - cost,
    stats: { ...state.stats, hintsUsed: state.stats.hintsUsed + 1 },
  };
}

/** Reveals one square for LETTER_HINT_COST; null when unaffordable. */
export function buyLetter(
  state: ArcadeState,
  cell: [number, number],
): ArcadeState | null {
  const paid = spend(state, LETTER_HINT_COST);
  if (!paid) return null;
  const hints = state.progress.hints;
  if (hints.some(([r, c]) => r === cell[0] && c === cell[1])) return null;
  return {
    ...paid,
    progress: { ...paid.progress, hints: [...hints, cell] },
  };
}

/** The shortest grid word not found yet; null when all are found. */
export function wordToReveal(puzzle: Puzzle, progress: Progress) {
  const open = puzzle.words.filter((w) => !progress.found.includes(w.word));
  if (open.length === 0) return null;
  return [...open].sort(
    (a, b) => a.word.length - b.word.length || a.word.localeCompare(b.word),
  )[0];
}

/**
 * Reveals every square of the shortest unfound word for WORD_HINT_COST: the
 * squares are shown, but the word still has to be spelled to count.
 */
export function buyWord(
  state: ArcadeState,
  puzzle: Puzzle,
): ArcadeState | null {
  const target = wordToReveal(puzzle, state.progress);
  if (!target) return null;
  const paid = spend(state, WORD_HINT_COST);
  if (!paid) return null;
  const have = new Set(state.progress.hints.map(([r, c]) => `${r},${c}`));
  const add = wordCells(target).filter(([r, c]) => !have.has(`${r},${c}`));
  return {
    ...paid,
    progress: {
      ...paid.progress,
      hints: [...paid.progress.hints, ...add],
    },
  };
}

const daysBetween = (from: string, to: string) => {
  const ms = (d: string) => {
    const [y, m, day] = d.split("-").map(Number);
    return Date.UTC(y, m - 1, day);
  };
  return Math.round((ms(to) - ms(from)) / 86_400_000);
};

/**
 * Pays interest on unspent coins for each day since it was last paid (at most
 * INTEREST_MAX_DAYS), compounding day by day. The first visit only starts the
 * clock. Returns the new state and what was paid.
 */
export function payInterest(
  state: ArcadeState,
  today: string,
): { state: ArcadeState; paid: number } {
  if (state.interestPaidOn === null) {
    return { state: { ...state, interestPaidOn: today }, paid: 0 };
  }
  const days = Math.min(
    INTEREST_MAX_DAYS,
    daysBetween(state.interestPaidOn, today),
  );
  if (days <= 0) return { state, paid: 0 };
  let coins = state.coins;
  let paid = 0;
  for (let i = 0; i < days; i += 1) {
    const interest = Math.min(
      INTEREST_CAP_PER_DAY,
      Math.floor(coins * INTEREST_RATE),
    );
    coins += interest;
    paid += interest;
  }
  return {
    state: {
      ...state,
      coins,
      interestPaidOn: today,
      stats: {
        ...state.stats,
        interestEarned: state.stats.interestEarned + paid,
        coinsEarned: state.stats.coinsEarned + paid,
      },
    },
    paid,
  };
}

/** The daily word's bonus for `date`, paid once. */
export function payDaily(state: ArcadeState, date: string): ArcadeState {
  if (state.dailyPaid.includes(date)) return state;
  // Keep the list short: only recent days can still be paid.
  const recent = state.dailyPaid.filter(
    (d) => d >= shiftDate(date, -60) && d <= shiftDate(date, 60),
  );
  return earn({ ...state, dailyPaid: [...recent, date] }, DAILY_SOLVE_COINS);
}

/** A finished time attack: its score counts toward the best, words pay a coin. */
export function recordTimeAttack(
  state: ArcadeState,
  score: number,
): ArcadeState {
  return earn(
    {
      ...state,
      stats: {
        ...state.stats,
        timeAttackBest: Math.max(state.stats.timeAttackBest, score),
        timeAttackPlays: state.stats.timeAttackPlays + 1,
      },
    },
    score,
  );
}
