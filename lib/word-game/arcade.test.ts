import { describe, expect, it } from "vitest";
import {
  BONUS_WORD_COINS,
  DAILY_SOLVE_COINS,
  LETTER_HINT_COST,
  START_COINS,
  WORD_HINT_COST,
  buyLetter,
  buyWord,
  comboMultiplier,
  levelCoins,
  newArcade,
  nextCombo,
  nextLevel,
  payDaily,
  payInterest,
  recordTimeAttack,
  recordWord,
  wordCoins,
} from "./arcade";
import { addFound } from "./progress";
import type { Puzzle } from "./puzzle";
import { parseArcade } from "./arcade-storage";

const puzzle: Puzzle = {
  letters: "RCEA",
  grid: { rows: 3, cols: 4 },
  words: [
    { word: "RACE", row: 0, col: 0, dir: "across" },
    { word: "ARE", row: 0, col: 1, dir: "down" },
  ],
  bonus: ["ACE"],
};

describe("combo", () => {
  it("keeps going within the window and resets after", () => {
    expect(nextCombo(0, null, 1000)).toBe(1);
    expect(nextCombo(2, 1000, 5000)).toBe(3);
    expect(nextCombo(4, 1000, 20000)).toBe(1);
  });
  it("multiplies coins at 3 and 5 in a row", () => {
    expect([1, 2, 3, 4, 5].map(comboMultiplier)).toEqual([1, 1, 2, 2, 3]);
  });
});

describe("wordCoins", () => {
  it("doubles words with the golden letter", () => {
    expect(wordCoins("ACE", "bonus", 1, null)).toBe(BONUS_WORD_COINS);
    expect(wordCoins("ACE", "bonus", 1, "C")).toBe(BONUS_WORD_COINS * 2);
    expect(wordCoins("ARE", "grid", 5, "C")).toBe(3);
  });
});

describe("recordWord and nextLevel", () => {
  it("pays the word, then the level once it's solved", () => {
    let state = newArcade();
    let progress = addFound(puzzle, state.progress, "RACE");
    state = recordWord(state, {
      puzzle,
      progress,
      word: "RACE",
      kind: "grid",
      coins: 1,
      combo: 1,
    });
    expect(state.coins).toBe(START_COINS + 1);
    expect(nextLevel(state).level).toBe(1);
    progress = addFound(puzzle, progress, "ARE");
    state = recordWord(state, {
      puzzle,
      progress,
      word: "ARE",
      kind: "grid",
      coins: 1,
      combo: 2,
    });
    expect(state.coins).toBe(START_COINS + 2 + levelCoins(puzzle));
    expect(state.stats.levelsSolved).toBe(1);
    expect(state.stats.longestWord).toBe("RACE");
    const moved = nextLevel(state);
    expect(moved.level).toBe(2);
    expect(moved.progress.found).toEqual([]);
  });
});

describe("hints", () => {
  it("a letter costs coins and needs enough of them", () => {
    const state = buyLetter(newArcade(), [0, 0]);
    expect(state?.coins).toBe(START_COINS - LETTER_HINT_COST);
    expect(buyLetter({ ...newArcade(), coins: 1 }, [0, 0])).toBeNull();
  });
  it("a word reveals the shortest unfound word's squares", () => {
    const state = buyWord(newArcade(), puzzle);
    expect(state?.coins).toBe(START_COINS - WORD_HINT_COST);
    expect(state?.progress.hints).toEqual([
      [0, 1],
      [1, 1],
      [2, 1],
    ]);
  });
});

describe("payInterest", () => {
  it("starts the clock on the first visit", () => {
    const { state, paid } = payInterest(newArcade(), "2026-11-16");
    expect(paid).toBe(0);
    expect(state.interestPaidOn).toBe("2026-11-16");
  });
  it("compounds each day away, up to a week", () => {
    const start = { ...newArcade(), coins: 1000, interestPaidOn: "2026-11-01" };
    const { state, paid } = payInterest(start, "2026-11-03");
    expect(paid).toBe(20 + 20);
    expect(state.coins).toBe(1040);
    const long = payInterest(start, "2026-12-01");
    expect(long.paid).toBeGreaterThan(0);
    expect(long.state.interestPaidOn).toBe("2026-12-01");
  });
  it("caps a day's interest", () => {
    const rich = {
      ...newArcade(),
      coins: 100000,
      interestPaidOn: "2026-11-01",
    };
    expect(payInterest(rich, "2026-11-02").paid).toBe(50);
  });
});

describe("payDaily and time attack", () => {
  it("pays the daily word once per day", () => {
    const once = payDaily(newArcade(), "2026-11-16");
    expect(once.coins).toBe(START_COINS + DAILY_SOLVE_COINS);
    expect(payDaily(once, "2026-11-16").coins).toBe(once.coins);
  });
  it("keeps the best time attack score", () => {
    const a = recordTimeAttack(newArcade(), 12);
    const b = recordTimeAttack(a, 7);
    expect(b.stats.timeAttackBest).toBe(12);
    expect(b.stats.timeAttackPlays).toBe(2);
  });
});

describe("parseArcade", () => {
  it("starts fresh when nothing is saved or it's broken", () => {
    expect(parseArcade(null).coins).toBe(START_COINS);
    expect(parseArcade("{oops").level).toBe(1);
  });
  it("keeps good fields when one is broken", () => {
    const state = parseArcade(
      JSON.stringify({ level: 7, coins: "lots", stats: { bestCombo: 4 } }),
    );
    expect(state.level).toBe(7);
    expect(state.coins).toBe(START_COINS);
    expect(state.stats.bestCombo).toBe(4);
  });
});
