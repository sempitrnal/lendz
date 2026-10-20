import { describe, expect, it } from "vitest";
import { isEchoOfLocalState } from "@/lib/checklist/realtime";
import type { DailyChecklistItem } from "@/lib/checklist/types";

const row: DailyChecklistItem = {
  id: "a",
  checklist_date: "2026-10-20",
  label: "Pay rent",
  is_checked: false,
  sort_order: 1,
  created_at: "2026-10-20T00:00:00Z",
  category_id: null,
  daily_checklist_categories: null,
};

describe("isEchoOfLocalState", () => {
  it("treats a DELETE for an id no longer shown as an echo", () => {
    expect(
      isEchoOfLocalState({ eventType: "DELETE", new: {}, old: { id: "b" } }, [row]),
    ).toBe(true);
  });

  it("does not treat a DELETE for a shown id as an echo", () => {
    expect(
      isEchoOfLocalState({ eventType: "DELETE", new: {}, old: { id: "a" } }, [row]),
    ).toBe(false);
  });

  it("treats a matching UPDATE as an echo (numeric sort_order, null category)", () => {
    expect(
      isEchoOfLocalState(
        {
          eventType: "UPDATE",
          new: {
            id: "a",
            label: "Pay rent",
            is_checked: false,
            sort_order: "1" as unknown as number,
            category_id: undefined,
          },
          old: { id: "a" },
        },
        [row],
      ),
    ).toBe(true);
  });

  it("does not treat a changed label as an echo", () => {
    expect(
      isEchoOfLocalState(
        {
          eventType: "UPDATE",
          new: { id: "a", label: "Other", is_checked: false, sort_order: 1, category_id: null },
          old: { id: "a" },
        },
        [row],
      ),
    ).toBe(false);
  });

  it("does not treat an INSERT for an unknown id as an echo", () => {
    expect(
      isEchoOfLocalState(
        { eventType: "INSERT", new: { id: "z", label: "x" }, old: {} },
        [row],
      ),
    ).toBe(false);
  });
});
