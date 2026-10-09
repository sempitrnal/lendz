import { describe, expect, it } from "vitest";
import { buildDueLabel } from "@/lib/checklist/labels";
import { summarizeChecklist } from "@/lib/checklist/totals";

const label = (amounts: number[]) =>
  buildDueLabel({
    borrower_id: "b",
    name: "x y",
    items: amounts.map((amount, i) => ({
      id: `00000000-0000-4000-8000-00000000000${i}`,
      due_date: "2026-10-10",
      amount,
      type: "loan" as const,
    })),
  });

describe("summarizeChecklist", () => {
  it("returns zeros for an empty or unlinked list", () => {
    const zero = { expected: 0, checkedOff: 0, left: 0, collections: 0 };
    expect(summarizeChecklist([])).toEqual(zero);
    expect(
      summarizeChecklist([
        { label: "17,400- renew for 50k", is_checked: false },
      ]),
    ).toEqual(zero);
  });

  it("sums collections but never the Total lines", () => {
    const totals = summarizeChecklist([
      { label: label([1000, 500]), is_checked: false },
    ]);
    expect(totals).toEqual({
      expected: 1500,
      checkedOff: 0,
      left: 1500,
      collections: 2,
    });
  });

  it("splits checked-off from remaining and avoids float drift", () => {
    const totals = summarizeChecklist([
      { label: label([0.1]), is_checked: true },
      { label: label([0.2]), is_checked: false },
    ]);
    expect(totals.expected).toBe(0.3);
    expect(totals.checkedOff).toBe(0.1);
    expect(totals.left).toBe(0.2);
  });
});
