import type { AllProgress, Progress } from "./progress";

/** The day (`yyyy-mm-dd`) the "play the daily word" prompt was last shown. */
export const PROMPT_KEY = "word-game:prompted";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function browserStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Whether a day has any play in it: a word, a bonus word, a hint, or a solve. */
export function hasPlayed(p: Progress | undefined): boolean {
  return Boolean(
    p &&
    (p.found.length > 0 ||
      p.bonus.length > 0 ||
      p.hints.length > 0 ||
      p.solved),
  );
}

/**
 * Whether to ask the player to try today's puzzle: they haven't played it, and
 * the prompt hasn't already been shown today (it is shown once a day).
 */
export function shouldPrompt(
  all: AllProgress,
  today: string,
  lastPrompted: string | null,
): boolean {
  return lastPrompted !== today && !hasPlayed(all[today]);
}

/** The day the prompt was last shown; null when unknown or storage is blocked. */
export function readPrompted(
  storage: Pick<Storage, "getItem"> | null = browserStorage(),
): string | null {
  try {
    const value = storage?.getItem(PROMPT_KEY);
    return value && DATE.test(value) ? value : null;
  } catch {
    return null;
  }
}

/** Remembers that the prompt was shown on `date`; false when it can't be saved. */
export function writePrompted(
  date: string,
  storage: Pick<Storage, "setItem"> | null = browserStorage(),
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(PROMPT_KEY, date);
    return true;
  } catch {
    return false;
  }
}
