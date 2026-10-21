import { describe, expect, it } from "vitest";
import { buildRowView } from "@/lib/checklist/row-state";
import { composeLabel } from "@/lib/checklist/composer";
import {
  plainLabelText,
  rowDisplayName,
  ROW_NAME_MAX,
} from "@/lib/checklist/row-name";
import type { DailyChecklistItem } from "@/lib/checklist/types";

const item = (label: string): DailyChecklistItem => ({
  id: "i1",
  checklist_date: "2026-10-20",
  label,
  is_checked: false,
  sort_order: 0,
  created_at: "2026-10-20T00:00:00Z",
  category_id: null,
  daily_checklist_categories: null,
});
const name = (label: string) => rowDisplayName(buildRowView(item(label)));

describe("rowDisplayName", () => {
  it("uses the borrower, lowercase, for a collection row", () => {
    const label = composeLabel({
      borrower: { id: "a1", name: "Ana Cruz" },
      others: [],
      lines: [{ id: "s1", due_date: "2026-10-20", amount: 100, type: "loan" }],
      note: "",
    });
    expect(name(label)).toBe("ana cruz");
  });
  it("uses a plain note's own text", () => {
    expect(name("bring change")).toBe("bring change");
  });
  it("shows mentions as lowercase names", () => {
    expect(name("call [Ana Cruz](/borrowers/a1) later")).toBe(
      "call ana cruz later",
    );
    expect(plainLabelText("[Bo](https://x.test) hi")).toBe("Bo hi");
  });
  it("takes the first line", () => {
    expect(name("\n  first line \nsecond")).toBe("first line");
  });
  it("truncates long text with an ellipsis", () => {
    const out = name("x".repeat(100));
    expect(out).toHaveLength(ROW_NAME_MAX);
    expect(out.endsWith("…")).toBe(true);
  });
  it("falls back to item when empty", () => {
    expect(name("   ")).toBe("item");
    expect(name("")).toBe("item");
  });
});
