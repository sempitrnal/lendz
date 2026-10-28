/**
 * Whether a schedule's part payment is shown on the viewed day: only on the day
 * a payment to it was made. Other days show the schedule as plainly what is
 * left. `paidIds` are the schedules paid on the viewed day; null or undefined
 * when that isn't known yet (loading, offline), where we show it as before.
 */
export function showsPartial(
  scheduleId: string,
  paidIds: ReadonlySet<string> | null | undefined,
): boolean {
  return paidIds == null || paidIds.has(scheduleId);
}
