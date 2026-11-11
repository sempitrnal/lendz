import { profitOnInstallment } from "@/lib/checklist/profit";

/** One recorded payment, as the profit calendar needs it. */
export type CalendarPayment = {
  id: string;
  scheduleId: string;
  /** yyyy-mm-dd, the day it was paid. */
  date: string;
  amount: number;
  createdAt: string | null;
  /** yyyy-mm-dd the installment was due, when known. */
  dueDate?: string | null;
};

export type DayFigure = {
  /** Profit collected that day. */
  profit: number;
  /** How many payments were recorded that day. */
  payments: number;
  /** Everything collected that day, principal included. */
  collected: number;
  /**
   * The part of `profit` from installments due in a different month than the
   * one they were paid in: late ones catching up, or ones paid ahead.
   */
  otherMonths: number;
};

/**
 * Profit collected on each day that had payments, the same way the checklist
 * counts one day (`dayProfit`): a payment earns profit for the part that lifts
 * its schedule past its principal share, on the day it was paid.
 *
 * `payments` are the period's payments in any order; `before` is what each
 * schedule had been paid before the period began; `shares` is each schedule's
 * principal share. Days are worked through in order, so a schedule paid on two
 * days of the period carries its total from the first into the second.
 */
export function dailyProfit(
  payments: CalendarPayment[],
  before: Map<string, number>,
  shares: Map<string, number>,
): Record<string, DayFigure> {
  const byDay = new Map<string, CalendarPayment[]>();
  for (const payment of payments) {
    const list = byDay.get(payment.date);
    if (list) list.push(payment);
    else byDay.set(payment.date, [payment]);
  }

  const paid = new Map(before);
  const out: Record<string, DayFigure> = {};
  for (const date of [...byDay.keys()].sort()) {
    const ordered = byDay
      .get(date)!
      .sort(
        (a, b) =>
          (a.createdAt ?? "").localeCompare(b.createdAt ?? "") ||
          a.id.localeCompare(b.id),
      );
    // Payment by payment, as `dayProfit` does: each earns profit for the
    // part that lifts its schedule past its principal share.
    let profit = 0;
    let otherMonths = 0;
    let collected = 0;
    for (const p of ordered) {
      const prior = paid.get(p.scheduleId) ?? 0;
      paid.set(p.scheduleId, prior + p.amount);
      collected += p.amount;
      const share = shares.get(p.scheduleId);
      if (share === undefined) continue;
      const gained =
        profitOnInstallment(prior + p.amount, share) -
        profitOnInstallment(prior, share);
      profit += gained;
      if (p.dueDate && p.dueDate.slice(0, 7) !== date.slice(0, 7)) {
        otherMonths += gained;
      }
    }
    out[date] = {
      profit: cents(profit),
      payments: ordered.length,
      collected: cents(collected),
      otherMonths: cents(otherMonths),
    };
  }
  return out;
}

const cents = (n: number) => Math.round(n * 100) / 100;

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-11" -> its first day and the next month's first day. */
export function monthBounds(month: string): [string, string] {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? [y + 1, 1] : [y, m + 1];
  return [`${y}-${pad(m)}-01`, `${next[0]}-${pad(next[1])}-01`];
}

/** "2026-11" moved by `by` months. */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(y, m - 1 + by, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/**
 * The month as calendar rows starting on Sunday: each cell is a yyyy-mm-dd of
 * that month, or null for the blanks before the 1st and after the last day.
 */
export function monthGrid(month: string): (string | null)[][] {
  const [y, m] = month.split("-").map(Number);
  const lead = new Date(y, m - 1, 1).getDay();
  const days = new Date(y, m, 0).getDate();
  const cells: (string | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: days }, (_, i) => `${month}-${pad(i + 1)}`),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

/** A calendar cell's short amount: 850, 1.2k, 12k, 1.5m. No peso sign. */
export function compactAmount(value: number): string {
  const n = Math.round(value);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}k`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}
