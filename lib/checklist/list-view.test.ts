import { describe, expect, it } from "vitest";
import {
  filterCounts,
  matchesFilter,
  matchesSearch,
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
    profit: 0,
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
    expect(filterCounts(rows)).toEqual({
      all: 4,
      overdue: 1,
      today: 1,
      paid: 1,
    });
  });

  it("sortSettledLast moves paid rows last and keeps the rest in order", () => {
    expect(sortSettledLast(rows).map((r) => r.item.id)).toEqual([
      "b",
      "c",
      "d",
      "a",
    ]);
  });

  it("summarizeRows totals the list", () => {
    const s = summarizeRows(rows);
    expect(s).toEqual({
      left: 350.3,
      due: 650.2,
      collected: 299.9,
      done: 1,
      count: 4,
      leftToday: 350.3,
      leftCarried: 0,
      profit: 0,
    });
  });

  it("summarizeRows totals the profit collected on the rows", () => {
    const withProfit = [
      row("p1", { status: "paid", total: 100, left: 0, profit: 12.5 }),
      row("p2", { status: "partial", total: 300, left: 100, profit: 30.25 }),
      row("p3", { status: "unpaid", total: 50, left: 50 }),
    ];
    expect(summarizeRows(withProfit).profit).toBe(42.75);
  });

  it("summarizeRows splits what is left into due today and carried over", () => {
    const mixed = [
      row("t1", { status: "unpaid", total: 100, left: 100 }),
      row("t2", { status: "partial", total: 300, left: 100.1 }),
      row("c1", { status: "unpaid", total: 50.2, left: 50.2, carried: true }),
      row("c2", { status: "paid", total: 80, left: 0, carried: true }),
    ];
    const s = summarizeRows(mixed);
    expect(s.leftToday).toBe(200.1);
    expect(s.leftCarried).toBe(50.2);
    expect(s.leftToday + s.leftCarried).toBeCloseTo(s.left, 2);
  });

  it("matchesSearch needs every word, ignores case, and blank matches all", () => {
    const named = row("n", {
      status: "unpaid",
      model: {
        borrower: { id: "1", name: "Maria Santos" },
        lines: [],
        total: 0,
        note: "ca for rent",
      },
    });
    expect(matchesSearch(named, "")).toBe(true);
    expect(matchesSearch(named, "  ")).toBe(true);
    expect(matchesSearch(named, "MAR")).toBe(true);
    expect(matchesSearch(named, "santos maria")).toBe(true);
    expect(matchesSearch(named, "maria rent")).toBe(true);
    expect(matchesSearch(named, "maria juan")).toBe(false);
  });

  it("matchesSearch falls back to the label when a row has no parsed lines", () => {
    const plain = row("p", {
      status: "unpaid",
      item: { id: "p", label: "Call the landlord" } as RowView["item"],
    });
    expect(matchesSearch(plain, "landlord")).toBe(true);
    expect(matchesSearch(plain, "maria")).toBe(false);
  });
});
