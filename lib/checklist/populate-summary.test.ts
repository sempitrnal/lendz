import { describe, expect, it } from "vitest";
import { buildDueLabel } from "@/lib/checklist/labels";
import type { DailyChecklistItem } from "@/lib/checklist/types";
import { buildRowView } from "@/lib/checklist/row-state";
import {
  autoPopulateStamp,
  summarizeAutoPopulate,
} from "@/lib/checklist/populate-summary";

const id = (i: number) => `00000000-0000-4000-8000-00000000000${i}`;

function item(
  n: number,
  dueDates: string[],
  createdAt: string,
  date = "2026-10-22",
): DailyChecklistItem {
  return {
    id: `item-${n}`,
    checklist_date: date,
    label: buildDueLabel({
      borrower_id: `b${n}`,
      name: `person ${n}`,
      items: dueDates.map((d, i) => ({
        id: id(n * 2 + i),
        due_date: d,
        amount: 100,
        type: "loan" as const,
      })),
    }),
    is_checked: false,
    sort_order: 0,
    created_at: createdAt,
    category_id: null,
    daily_checklist_categories: null,
  };
}

describe("autoPopulateStamp", () => {
  it("is 6:00:00 AM Manila on that day, as a UTC instant", () => {
    expect(autoPopulateStamp("2026-10-22")).toBe("2026-10-21T22:00:00.000Z");
  });
});

describe("summarizeAutoPopulate", () => {
  const stamp = autoPopulateStamp("2026-10-22");
  const rows = [
    buildRowView(item(1, ["2026-10-22"], stamp)),
    buildRowView(item(2, ["2026-10-20"], stamp)),
    buildRowView(item(3, ["2026-10-22"], "2026-10-22T02:15:00.000Z")),
  ];

  it("counts only the rows the 6 AM run stamped", () => {
    const s = summarizeAutoPopulate(rows, "2026-10-22");
    expect(s?.added).toBe(2);
  });
  it("splits due today from carried over and totals what is left", () => {
    const s = summarizeAutoPopulate(rows, "2026-10-22")!;
    expect(s.dueToday.map((r) => r.item.id)).toEqual(["item-1"]);
    expect(s.carried.map((r) => r.item.id)).toEqual(["item-2"]);
    expect(s.left).toBe(200);
  });
  it("is null when nothing was auto-added that day", () => {
    expect(summarizeAutoPopulate([rows[2]], "2026-10-22")).toBeNull();
    expect(summarizeAutoPopulate([], "2026-10-22")).toBeNull();
  });
  it("ignores stamped rows that belong to another day", () => {
    const other = buildRowView(item(4, ["2026-10-22"], stamp, "2026-10-23"));
    expect(summarizeAutoPopulate([other], "2026-10-22")).toBeNull();
  });
});
