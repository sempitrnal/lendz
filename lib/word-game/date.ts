const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's date where the lending happens, as yyyy-mm-dd. */
export function manilaToday(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

/** `date` moved by `by` calendar days. */
export function shiftDate(date: string, by: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + by)).toISOString().slice(0, 10);
}

/** "2026-11-12" -> "2026-11". */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/**
 * The date to show for a `?date=` value: it, when it is a real date that is
 * not after today; otherwise today.
 */
export function resolveDate(param: string | undefined, today: string): string {
  if (!param || !DATE.test(param)) return today;
  const [y, m, d] = param.split("-").map(Number);
  const real = new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
  return real === param && param <= today ? param : today;
}
