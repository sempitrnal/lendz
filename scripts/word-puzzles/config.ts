/** The dates puzzles are generated for, inclusive. */
export const START_DATE = "2026-11-01";
export const END_DATE = "2029-12-31";

/** The wheel size and grid-word count for a date, by weekday. */
export function sizeForDate(date: string): {
  letters: number;
  gridWords: number;
} {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  if (day === 1 || day === 2) return { letters: 5, gridWords: 4 };
  if (day === 6 || day === 0) return { letters: 7, gridWords: 8 };
  return { letters: 6, gridWords: 6 };
}
