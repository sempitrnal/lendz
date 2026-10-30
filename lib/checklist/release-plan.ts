import type { BorrowerSearchItem } from "@/app/api/borrowers/route";
import { tabOf } from "@/lib/checklist/categories";
import { borrowerPrimaryCategory } from "@/lib/checklist/labels";
import { buildReleaseView } from "@/lib/checklist/release-items";
import type { DailyChecklistItem } from "@/lib/checklist/types";

/**
 * The release days a month plans on by default: pairs fifteen days apart
 * (4 & 19, 5 & 20, 7 & 22, 8 & 23, 10 & 25, 15 & 30).
 */
export const PATTERN_DAYS = [4, 5, 7, 8, 10, 15, 19, 20, 22, 23, 25, 30];

/** `YYYY-MM`, the month the planner shows. */
export type MonthKey = string;

const pad = (n: number) => String(n).padStart(2, "0");

export function monthKeyOf(date: string): MonthKey {
  return date.slice(0, 7);
}

export function shiftMonth(month: MonthKey, by: number): MonthKey {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

export function lastDayOf(month: MonthKey): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** The first and last date of a month, for a range query. */
export function monthRange(month: MonthKey): { from: string; to: string } {
  return { from: `${month}-01`, to: `${month}-${pad(lastDayOf(month))}` };
}

/**
 * The dates the planner shows for a month, in order: the pattern days (a day
 * past the month's end, the 30th in February, becomes its last day), plus any
 * other day that already has a release or that was added by hand.
 */
export function planDates(month: MonthKey, extra: string[] = []): string[] {
  const last = lastDayOf(month);
  const dates = new Set(
    PATTERN_DAYS.map((d) => `${month}-${pad(Math.min(d, last))}`),
  );
  for (const date of extra) if (monthKeyOf(date) === month) dates.add(date);
  return [...dates].sort();
}

/** True for a day the planner shows every month (see `planDates`). */
export function isPatternDate(date: string): boolean {
  return planDates(monthKeyOf(date)).includes(date);
}

export type PlanEntry = {
  id: string;
  date: string;
  /** The borrower's name, or the whole note when it mentions nobody. */
  name: string;
  borrowerId: string | null;
  /** The principal it reads as, when the note parses as a release. */
  amount: number | null;
  /** "loan" or "cash_advance", when the note parses as a release. */
  kind: "loan" | "cash_advance" | null;
  /** e.g. "4 mo" or "2 gives", when the note says. */
  term: string | null;
  /** The borrower's main category, once the borrower list has loaded. */
  category: { name: string; color: string | null } | null;
  /** Ticked on the checklist: its account was created. */
  done: boolean;
};

/**
 * The month's release items as planner entries, by date. Only the Release
 * tab's items count (a "released" row that links installments is a
 * collection, see `tabOf`).
 */
export function planEntries(
  items: DailyChecklistItem[],
  releasedId: string | null,
  borrowers: BorrowerSearchItem[] = [],
): Map<string, PlanEntry[]> {
  const byId = new Map(borrowers.map((b) => [b.id, b]));
  const byDate = new Map<string, PlanEntry[]>();
  const sorted = [...items].sort(
    (a, b) =>
      a.checklist_date.localeCompare(b.checklist_date) ||
      a.sort_order - b.sort_order ||
      a.created_at.localeCompare(b.created_at),
  );
  for (const item of sorted) {
    if (tabOf(item, releasedId) !== "release") continue;
    const view = buildReleaseView(item);
    const values = view.parsed?.initialValues;
    const amount = Number(values?.principal_amount ?? 0);
    const months = Number(values?.term_months ?? 0);
    const category = view.borrowerId
      ? borrowerPrimaryCategory(byId.get(view.borrowerId))
      : null;
    const entry: PlanEntry = {
      id: item.id,
      date: item.checklist_date,
      name: view.name || view.typed,
      borrowerId: view.borrowerId,
      amount: amount > 0 ? amount : null,
      kind:
        values?.type === "cash_advance"
          ? "cash_advance"
          : values
            ? "loan"
            : null,
      term:
        months > 0
          ? values?.payment_frequency === "custom"
            ? `${months} give${months === 1 ? "" : "s"}`
            : `${months} mo`
          : null,
      category: category
        ? { name: category.name, color: category.color }
        : null,
      done: item.is_checked,
    };
    const list = byDate.get(entry.date) ?? [];
    list.push(entry);
    byDate.set(entry.date, list);
  }
  return byDate;
}

/** 50000 → "50k", 2500 → "2.5k", 12345 → "12.3k", 800 → "800", 1380600 → "1.38M". */
export function shortAmount(n: number): string {
  if (n < 1000) return String(Math.round(n));
  if (n >= 1_000_000) {
    return `${Number((Math.round(n / 10_000) / 100).toFixed(2))}M`;
  }
  const k = Math.round(n / 100) / 10;
  return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
}

/** What a set of entries adds up to (unparsed ones count as nothing). */
export function planTotal(entries: PlanEntry[]): number {
  return entries.reduce((sum, e) => sum + (e.amount ?? 0), 0);
}

/**
 * Which days the planner shows: every day, days with a release still to
 * create, days with created releases, or days with nothing on them.
 */
export type PlanFilter = "all" | "open" | "created" | "free";

/**
 * The days a filter keeps, each with the releases it shows: "open" keeps only
 * the releases still to create on a day, "created" only the created ones.
 */
export function filterPlan(
  dates: string[],
  byDate: Map<string, PlanEntry[]>,
  filter: PlanFilter,
): { date: string; entries: PlanEntry[] }[] {
  const days = dates.map((date) => ({ date, entries: byDate.get(date) ?? [] }));
  switch (filter) {
    case "all":
      return days;
    case "free":
      return days.filter((d) => d.entries.length === 0);
    case "open":
      return days
        .map((d) => ({ ...d, entries: d.entries.filter((e) => !e.done) }))
        .filter((d) => d.entries.length > 0);
    case "created":
      return days
        .map((d) => ({ ...d, entries: d.entries.filter((e) => e.done) }))
        .filter((d) => d.entries.length > 0);
  }
}

/** What each filter's chip counts: releases for open and created, days otherwise. */
export function filterCounts(
  dates: string[],
  byDate: Map<string, PlanEntry[]>,
): Record<PlanFilter, number> {
  const entries = dates.flatMap((d) => byDate.get(d) ?? []);
  return {
    all: dates.length,
    open: entries.filter((e) => !e.done).length,
    created: entries.filter((e) => e.done).length,
    free: dates.filter((d) => (byDate.get(d) ?? []).length === 0).length,
  };
}
