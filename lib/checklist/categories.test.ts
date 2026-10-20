import { describe, expect, it } from "vitest";
import {
  resolveCategoryIds,
  tabOf,
} from "@/lib/checklist/categories";
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

const item = (category_id: string | null): DailyChecklistItem => ({
  id: "i1",
  checklist_date: "2026-10-19",
  label: "x",
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
});
