import { describe, expect, it } from "vitest";
import {
  filterCounts,
  matchesFilter,
  sortSettledLast,
  summarizeRows,
} from "@/lib/checklist/list-view";
import type { RowStatus, RowView } from "@/lib/checklist/row-state";

function row(
  name: string,
  p: Partial<RowView> & { status: RowStatus },
): RowView {
  return {
    item: { id: name } as RowView["item"],
    model: null,
    lines: [],
    left: 0,
    total: 0,
    lateDays: 0,
    dueOnDay: false,
    carried: false,
    ...p,
  };
}

const rows = [
  row("a", { status: "paid", total: 100, left: 0 }),
  row("b", { status: "unpaid", total: 200, left: 200, lateDays: 3 }),
  row("c", { status: "partial", total: 300, left: 100.1, dueOnDay: true }),
  row("d", { status: "unpaid", total: 50.2, left: 50.2 }),
];

describe("list-view", () => {
  it("matchesFilter covers all four filters", () => {
    const [a, b, c] = rows;
    expect(matchesFilter(a, "all")).toBe(true);
    expect(matchesFilter(b, "overdue")).toBe(true);
    expect(matchesFilter(c, "overdue")).toBe(false);
    expect(matchesFilter(c, "today")).toBe(true);
    expect(matchesFilter(b, "today")).toBe(false);
    expect(matchesFilter(a, "paid")).toBe(true);
    expect(matchesFilter(b, "paid")).toBe(false);
    const paidLate = row("p", { status: "paid", lateDays: 2, dueOnDay: true });
    expect(matchesFilter(paidLate, "overdue")).toBe(false);
    expect(matchesFilter(paidLate, "today")).toBe(false);
  });

  it("filterCounts counts each filter", () => {
    expect(filterCounts(rows)).toEqual({ all: 4, overdue: 1, today: 1, paid: 1 });
  });

  it("sortSettledLast moves paid rows last and keeps the rest in order", () => {
    expect(sortSettledLast(rows).map((r) => r.item.id)).toEqual(["b", "c", "d", "a"]);
  });

  it("summarizeRows totals the list", () => {
    const s = summarizeRows(rows);
    expect(s).toEqual({ left: 350.3, due: 650.2, collected: 299.9, done: 1, count: 4 });
  });
});
