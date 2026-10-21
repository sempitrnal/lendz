import { describe, expect, it } from "vitest";
import {
  changedShownIds,
  newRowSortOrders,
  sortDayItems,
} from "@/lib/checklist/day-items";
import type { DailyChecklistItem } from "@/lib/checklist/types";

const item = (
  id: string,
  over: Partial<DailyChecklistItem> = {},
): DailyChecklistItem => ({
  id,
  checklist_date: "2026-10-20",
  label: id,
  is_checked: false,
  sort_order: 0,
  created_at: "2026-10-20T00:00:00.000Z",
  category_id: "c1",
  daily_checklist_categories: null,
  ...over,
});

describe("sortDayItems", () => {
  it("orders by sort_order, then newest first", () => {
    const rows = [
      item("a", { sort_order: 1 }),
      item("b", { sort_order: 0, created_at: "2026-10-20T01:00:00.000Z" }),
      item("c", { sort_order: 0, created_at: "2026-10-20T02:00:00.000Z" }),
    ];
    expect(sortDayItems(rows).map((r) => r.id)).toEqual(["c", "b", "a"]);
  });

  it("does not mutate its input", () => {
    const rows = [item("a", { sort_order: 1 }), item("b")];
    sortDayItems(rows);
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("newRowSortOrders", () => {
  it("puts a single new row below the category's lowest sort_order", () => {
    const existing = [
      item("a", { sort_order: -3 }),
      item("b", { sort_order: 2 }),
    ];
    expect(newRowSortOrders(existing, [{ categoryId: "c1" }])).toEqual([-4]);
  });

  it("starts below 0 for an empty category", () => {
    expect(newRowSortOrders([], [{ categoryId: null }])).toEqual([-1]);
  });

  it("keeps the given order for several rows, per category", () => {
    const existing = [
      item("a", { sort_order: -1 }),
      item("x", { category_id: "c2", sort_order: 5 }),
    ];
    expect(
      newRowSortOrders(existing, [
        { categoryId: "c1" },
        { categoryId: "c2" },
        { categoryId: "c1" },
      ]),
    ).toEqual([-3, -1, -2]);
  });
});

describe("changedShownIds", () => {
  const shown = [item("a"), item("b"), item("c")];

  it("reports shown rows whose content changed", () => {
    const fetched = [
      item("a", { is_checked: true }),
      item("b"),
      item("c", { label: "new" }),
    ];
    expect(changedShownIds(shown, fetched, new Set())).toEqual(["a", "c"]);
  });

  it("ignores new rows and excluded ids", () => {
    const fetched = [item("a", { sort_order: 4 }), item("d", { label: "x" })];
    expect(changedShownIds(shown, fetched, new Set(["a"]))).toEqual([]);
  });

  it("treats a category change as a change", () => {
    const fetched = [item("b", { category_id: "c9" })];
    expect(changedShownIds(shown, fetched, new Set())).toEqual(["b"]);
  });
});
