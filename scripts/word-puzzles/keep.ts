/**
 * Whether regenerating should leave a date's existing puzzle alone. Dates up
 * to today may already have been played, and progress is saved as the words
 * found, so their puzzles must not change; later dates have not been seen yet.
 * `force` rebuilds everything.
 */
export function shouldKeep(
  date: string,
  today: string,
  hasExisting: boolean,
  force: boolean,
): boolean {
  return !force && hasExisting && date <= today;
}
