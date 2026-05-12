/** Days in month (monthIndex 0–11). Respects leap years via Date. */
export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * Advance one calendar month from `prev`, using the same day-of-month as `anchorDay`
 * when that day exists (e.g. anchor 30 → Feb 28 non‑leap, Feb 29 leap, then Mar 30).
 */
export function addOneMonthAnchored(prev: Date, anchorDay: number): Date {
  let y = prev.getFullYear();
  let m = prev.getMonth() + 1;
  if (m > 11) {
    m = 0;
    y += 1;
  }
  const dim = daysInMonth(y, m);
  const day = Math.min(anchorDay, dim);
  return new Date(y, m, day);
}
