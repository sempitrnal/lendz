import { emptyStats, newArcade, type ArcadeState } from "./arcade";
import { emptyProgress, type Progress } from "./progress";

export const ARCADE_KEY = "word-game:arcade:v1";

const num = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const strings = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

function progressOf(v: unknown): Progress {
  if (typeof v !== "object" || v === null) return emptyProgress;
  const p = v as Record<string, unknown>;
  const hints = Array.isArray(p.hints)
    ? p.hints.filter(
        (h): h is [number, number] =>
          Array.isArray(h) &&
          h.length === 2 &&
          typeof h[0] === "number" &&
          typeof h[1] === "number",
      )
    : [];
  return {
    found: strings(p.found),
    bonus: strings(p.bonus),
    hints,
    solved: p.solved === true,
    solvedOn: typeof p.solvedOn === "string" ? p.solvedOn : null,
  };
}

/**
 * The saved level run, repaired field by field: a missing or broken field
 * falls back to its default instead of losing the rest.
 */
export function parseArcade(text: string | null): ArcadeState {
  if (!text) return newArcade();
  try {
    const v = JSON.parse(text) as Record<string, unknown>;
    const s = (v.stats ?? {}) as Record<string, unknown>;
    const start = newArcade();
    return {
      level: Math.max(1, Math.floor(num(v.level, 1))),
      progress: progressOf(v.progress),
      coins: Math.max(0, Math.floor(num(v.coins, start.coins))),
      interestPaidOn:
        typeof v.interestPaidOn === "string" ? v.interestPaidOn : null,
      dailyPaid: strings(v.dailyPaid),
      stats: {
        levelsSolved: num(s.levelsSolved, 0),
        wordsFound: num(s.wordsFound, 0),
        bonusFound: num(s.bonusFound, 0),
        longestWord:
          typeof s.longestWord === "string"
            ? s.longestWord
            : emptyStats.longestWord,
        bestCombo: num(s.bestCombo, 0),
        hintsUsed: num(s.hintsUsed, 0),
        coinsEarned: num(s.coinsEarned, 0),
        interestEarned: num(s.interestEarned, 0),
        timeAttackBest: num(s.timeAttackBest, 0),
        timeAttackPlays: num(s.timeAttackPlays, 0),
      },
    };
  } catch {
    return newArcade();
  }
}
