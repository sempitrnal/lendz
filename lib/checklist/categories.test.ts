import { describe, expect, it } from "vitest";
import {
  resolveCategoryIds,
  tabOf,
} from "@/lib/checklist/categories";
import { buildRowView } from "@/lib/checklist/row-state";
import { bulkPaidRows } from "@/lib/checklist/bulk-paid";
import type {
  ChecklistCategory,
  DailyChecklistItem,
} from "@/lib/checklist/types";

const cat = (id: string, name: string, sort_order = 0): ChecklistCategory => ({
  id,
  name,
  color: "#000000",
  sort_order,
});

const item = (
  category_id: string | null,
  label = "x",
): DailyChecklistItem => ({
  id: "i1",
  checklist_date: "2026-10-19",
  label,
  is_checked: false,
  sort_order: 0,
  created_at: "2026-10-19T00:00:00Z",
  category_id,
  daily_checklist_categories: null,
});

describe("resolveCategoryIds", () => {
  it("finds received and released, trimmed and case-insensitive", () => {
    expect(
      resolveCategoryIds([cat("a", " Received "), cat("b", "RELEASED")]),
    ).toEqual({ releasedId: "b", collectId: "a" });
  });

  it("falls back to the only non-released category", () => {
    expect(resolveCategoryIds([cat("a", "to do")])).toEqual({
      releasedId: null,
      collectId: "a",
    });
  });

  it("uses the lowest sort_order when there is no received", () => {
    expect(
      resolveCategoryIds([
        cat("a", "later", 5),
        cat("b", "first", 1),
        cat("c", "released", 0),
      ]),
    ).toEqual({ releasedId: "c", collectId: "b" });
  });

  it("returns nulls when empty", () => {
    expect(resolveCategoryIds([])).toEqual({
      releasedId: null,
      collectId: null,
    });
  });
});

describe("tabOf", () => {
  it("maps the released category to release", () => {
    expect(tabOf(item("r"), "r")).toBe("release");
  });
  it("maps null and other categories to collect", () => {
    expect(tabOf(item(null), "r")).toBe("collect");
    expect(tabOf(item("x"), "r")).toBe("collect");
  });
  it("is always collect without a released id", () => {
    expect(tabOf(item("r"), null)).toBe("collect");
  });
  const collection =
    "[ana](/borrowers/b1)\n₱1,000 [Oct 21](#badge:date:2026-10-21|s1) [Loan](#badge:type:loan)";
  it("sends a released-category row that links installments to collect", () => {
    expect(tabOf(item("r", collection), "r")).toBe("collect");
    expect(tabOf(item("x", collection), "r")).toBe("collect");
    expect(tabOf(item(null, collection), "r")).toBe("collect");
  });
  it("keeps released-category rows without schedule links on release", () => {
    expect(tabOf(item("r", "[ana](/borrowers/b1) 10,000 - 10 months"), "r")).toBe(
      "release",
    );
    // A date badge with no schedule id links nothing.
    expect(
      tabOf(item("r", "[ana](/borrowers/b1) ₱500 [Oct 21](#badge:date:2026-10-21|)"), "r"),
    ).toBe("release");
  });
  it("puts every item on exactly one tab", () => {
    const items = [
      item("r", collection),
      item("r", "[ana](/borrowers/b1) 5,000 - 5 months"),
      item("c", collection),
      item("c", "note"),
      item(null, "note"),
    ];
    const collect = items.filter((i) => tabOf(i, "r") === "collect");
    const release = items.filter((i) => tabOf(i, "r") === "release");
    expect(collect.length + release.length).toBe(items.length);
    expect(release).toEqual([items[1]]);
  });
  it("a rerouted row is an ordinary collection row (pay, bulk, swipe)", () => {
    const view = buildRowView(item("r", collection));
    expect(view.model?.borrower).toEqual({ id: "b1", name: "ana" });
    expect(view.lines.map((l) => l.id)).toEqual(["s1"]);
    expect(bulkPaidRows([view])).toEqual([view]);
  });
});
