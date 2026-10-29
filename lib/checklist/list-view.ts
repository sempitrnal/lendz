import type { RowView } from "@/lib/checklist/row-state";

export type ChecklistFilter = "all" | "overdue" | "today" | "paid";

const cents = (n: number) => Math.round(n * 100) / 100;

export function matchesFilter(row: RowView, filter: ChecklistFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "overdue":
      return row.status !== "paid" && row.lateDays > 0;
    case "today":
      return row.status !== "paid" && row.dueOnDay;
    case "paid":
      return row.status === "paid";
  }
}

/** What a search looks at: the borrower's name and the row's note. */
function searchText(row: RowView): string {
  const name = row.model?.borrower?.name ?? "";
  const note = row.model?.note ?? "";
  // A label with no parsed lines still has its own text to search.
  return `${name} ${note || (row.model ? "" : row.item.label)}`.toLowerCase();
}

/** Every word typed must appear somewhere in the row; blank matches all. */
export function matchesSearch(row: RowView, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = searchText(row);
  return words.every((w) => text.includes(w));
}

export function filterCounts(rows: RowView[]): Record<ChecklistFilter, number> {
  return {
    all: rows.length,
    overdue: rows.filter((r) => matchesFilter(r, "overdue")).length,
    today: rows.filter((r) => matchesFilter(r, "today")).length,
    paid: rows.filter((r) => matchesFilter(r, "paid")).length,
  };
}

/** Paid rows move to the end; everything else keeps its order. */
export function sortSettledLast(rows: RowView[]): RowView[] {
  return [
    ...rows.filter((r) => r.status !== "paid"),
    ...rows.filter((r) => r.status === "paid"),
  ];
}

export function summarizeRows(rows: RowView[]): {
  left: number;
  due: number;
  collected: number;
  done: number;
  count: number;
  /** What is left on rows with something due on or after the day. */
  leftToday: number;
  /** What is left on rows that are only from earlier days. */
  leftCarried: number;
  /** Profit collected on all the rows. */
  profit: number;
} {
  const due = cents(rows.reduce((s, r) => s + r.total, 0));
  const left = cents(rows.reduce((s, r) => s + r.left, 0));
  const leftCarried = cents(
    rows.reduce((s, r) => s + (r.carried ? r.left : 0), 0),
  );
  return {
    leftToday: cents(left - leftCarried),
    leftCarried,
    profit: cents(rows.reduce((s, r) => s + r.profit, 0)),
    left,
    due,
    collected: cents(due - left),
    done: rows.filter((r) => r.status === "paid").length,
    count: rows.length,
  };
}
