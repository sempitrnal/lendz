import type { AllProgress } from "./progress";
import { shiftDate } from "./date";

/**
 * The dates that count for the streak: solved, and solved on that very day.
 * A day solved later (replaying a missed day) does not count.
 */
export function solvedDates(all: AllProgress): string[] {
  return Object.keys(all).filter(
    (date) => all[date].solved && all[date].solvedOn === date,
  );
}

/**
 * Consecutive solved days ending today, or yesterday when today is not solved
 * yet; 0 when neither is solved.
 */
export function currentStreak(solved: string[], today: string): number {
  const days = new Set(solved);
  let day = days.has(today) ? today : shiftDate(today, -1);
  let streak = 0;
  while (days.has(day)) {
    streak += 1;
    day = shiftDate(day, -1);
  }
  return streak;
}
