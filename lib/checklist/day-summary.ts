import type { RowView } from "@/lib/checklist/row-state";
import { summarizeRows } from "@/lib/checklist/list-view";
import { lateLabel } from "@/lib/checklist/late-label";

/** The figures for one slice of the day's rows. */
export type DaySlice = ReturnType<typeof summarizeRows>;

const cents = (n: number) => Math.round(n * 100) / 100;

/** What one slice of the day holds, counted by installment. */
function sliceOf(
  rows: RowView[],
  /** Which installments belong to the slice. */
  pick: (line: RowView["lines"][number], day: string) => boolean,
  /** Which of those still count as left to collect. */
  countsLeft: (dueDate: string, day: string) => boolean,
): DaySlice {
  let due = 0;
  let left = 0;
  let collected = 0;
  let done = 0;
  let count = 0;
  for (const row of rows) {
    const day = row.item.checklist_date.slice(0, 10);
    const lines = row.lines.filter((l) => pick(l, day));
    if (lines.length === 0) continue;
    count += 1;
    if (lines.every((l) => l.state === "paid")) done += 1;
    for (const l of lines) {
      const open = l.state === "paid" ? 0 : l.left;
      due += l.original;
      collected += l.original - open;
      if (countsLeft(l.due_date.slice(0, 10), day)) left += open;
    }
  }
  return {
    left: cents(left),
    due: cents(due),
    collected: cents(collected),
    done,
    count,
    leftToday: cents(left),
    leftCarried: 0,
    profit: 0,
  };
}

/**
 * The day's figures, read installment by installment. Today is what is due on
 * the day, plus anything paid on it ahead of its date; only the part due on
 * the day counts as left. Carried over is what is still open from earlier
 * days. Installments due after the day add nothing to what is left, even when
 * they sit on the same borrower's row. `all` is every row as the list shows it.
 */
export function summarizeDay(
  rows: RowView[],
  paidIds?: ReadonlySet<string> | null,
  /** The payments made on the day: what "collected" adds up, once known. */
  payments?: readonly DayPayment[] | null,
): { all: DaySlice; today: DaySlice; carried: DaySlice } {
  const result = {
    all: summarizeRows(rows, paidIds),
    today: sliceOf(
      rows,
      (l, day) =>
        l.due_date.slice(0, 10) === day || (!!paidIds && paidIds.has(l.id)),
      (due, day) => due === day,
    ),
    carried: sliceOf(
      rows,
      (l, day) => l.due_date.slice(0, 10) < day,
      () => true,
    ),
  };
  if (payments) {
    // Collected is what was actually paid on the day, a part payment counting
    // only the part paid that day: each payment goes to the slice its
    // installment belongs to (one not on the list goes to today).
    const dueOf = new Map<string, { due: string; day: string }>();
    for (const row of rows) {
      const day = row.item.checklist_date.slice(0, 10);
      for (const l of row.lines) {
        dueOf.set(l.id, { due: l.due_date.slice(0, 10), day });
      }
    }
    let today = 0;
    let carried = 0;
    for (const p of payments) {
      const info = dueOf.get(p.scheduleId);
      // Money collected that day counts even when its schedule is not on the
      // list (paid from the account page, or a manual account).
      if (!info) {
        today += p.amount;
        continue;
      }
      if (info.due < info.day) carried += p.amount;
      else today += p.amount;
    }
    result.today = { ...result.today, collected: cents(today) };
    result.carried = { ...result.carried, collected: cents(carried) };
  }
  return result;
}

/** One payment made on the viewed day, with the due date of its schedule. */
export type DayPayment = {
  scheduleId: string;
  /** What this payment put toward the schedule. */
  amount: number;
  dueDate: string | null;
};

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
