import type { RowView } from "@/lib/checklist/row-state";
import { summarizeRows } from "@/lib/checklist/list-view";
import { lateLabel } from "@/lib/checklist/late-label";

/** The figures for one slice of the day's rows. */
export type DaySlice = ReturnType<typeof summarizeRows>;

/**
 * The day's rows split the way the checklist's header reads them: today's own
 * schedules (the headline), and the ones carried over from earlier days
 * (their own line underneath). `all` is the two together.
 */
export function summarizeDay(
  rows: RowView[],
  paidIds?: ReadonlySet<string> | null,
): { all: DaySlice; today: DaySlice; carried: DaySlice } {
  return {
    all: summarizeRows(rows, paidIds),
    today: summarizeRows(
      rows.filter((r) => !r.carried),
      paidIds,
    ),
    carried: summarizeRows(
      rows.filter((r) => r.carried),
      paidIds,
    ),
  };
}

/** One payment made on the viewed day, with the due date of its schedule. */
export type DayPayment = { scheduleId: string; dueDate: string | null };

export type TimingStat = {
  count: number;
  /** Whole days, averaged over the schedules; 0 with none. */
  avgDays: number;
};

const utcDay = (date: string) => {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

/**
 * How the payments made on `date` compare with their due dates: how many
 * schedules were paid early and how many late, with the average gap. A
 * schedule paid in several parts counts once. Only schedules in `scheduleIds`
 * (the checklist's own) count, when it is given.
 */
export function paymentTimingStats(
  payments: readonly DayPayment[],
  date: string,
  scheduleIds?: ReadonlySet<string>,
): { early: TimingStat; late: TimingStat; onTime: number } {
  const seen = new Set<string>();
  const early: number[] = [];
  const late: number[] = [];
  let onTime = 0;
  for (const p of payments) {
    if (!p.dueDate || seen.has(p.scheduleId)) continue;
    if (scheduleIds && !scheduleIds.has(p.scheduleId)) continue;
    seen.add(p.scheduleId);
    const days = Math.round((utcDay(date) - utcDay(p.dueDate)) / 86_400_000);
    if (days > 0) late.push(days);
    else if (days < 0) early.push(-days);
    else onTime += 1;
  }
  const stat = (list: number[]): TimingStat => ({
    count: list.length,
    avgDays: list.length
      ? Math.round(list.reduce((a, b) => a + b, 0) / list.length)
      : 0,
  });
  return { early: stat(early), late: stat(late), onTime };
}

/** "3 paid early · avg 2d": the line under the figures, or null with none. */
export function timingText(
  kind: "early" | "late",
  stat: TimingStat,
): string | null {
  if (stat.count === 0) return null;
  const avg = lateLabel(Math.max(1, stat.avgDays)).short;
  return `${stat.count} paid ${kind} · avg ${avg}`;
}
