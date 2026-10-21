/**
 * The line under the checklist's sticky bar while the connection is down:
 * null when online, otherwise what is saved and how many edits still wait to
 * sync. Bad counts (negative, NaN) read as nothing waiting.
 */
export function offlineBannerText(
  offline: boolean,
  waiting: number,
): string | null {
  if (!offline) return null;
  const n = Number.isFinite(waiting) ? Math.floor(waiting) : 0;
  if (n <= 0) return "Offline · showing saved data";
  return `Offline · ${n} change${n === 1 ? "" : "s"} waiting`;
}
