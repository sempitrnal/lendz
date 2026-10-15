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

  describe("with schedule statuses", () => {
    const ids = (i: number) => `00000000-0000-4000-8000-00000000000${i}`;
    const sched = (
      amount_due: number,
      amount_paid: number,
      status: string,
    ) => ({
      amount_due,
      amount_paid,
      remaining_amount: amount_due - amount_paid,
      status,
    });

    it("counts only paid and partly paid lines on a ticked row", () => {
      const totals = summarizeChecklist(
        [{ label: label([1000, 500, 300]), is_checked: true }],
        new Map([
          [ids(0), sched(1000, 1000, "paid")],
          [ids(1), sched(500, 200, "partial")],
          [ids(2), sched(300, 0, "pending")],
        ]),
      );
      expect(totals).toEqual({
        expected: 1800,
        checkedOff: 1200,
        left: 600,
        collections: 3,
      });
    });

    it("counts a payment on an unticked row", () => {
      const totals = summarizeChecklist(
        [{ label: label([1000]), is_checked: false }],
        new Map([[ids(0), sched(1000, 1000, "paid")]]),
      );
      expect(totals.checkedOff).toBe(1000);
    });

    it("counts only this day's share when the line was listed after an earlier partial", () => {
      // Listed for the 700 still owed; 900 paid in all now, so 600 today.
      const totals = summarizeChecklist(
        [{ label: label([700]), is_checked: true }],
        new Map([[ids(0), sched(1000, 900, "partial")]]),
      );
      expect(totals.checkedOff).toBe(600);
    });

    it("falls back to the tick for lines without a known schedule", () => {
      const totals = summarizeChecklist(
        [{ label: label([1000, 500]), is_checked: true }],
        new Map([[ids(0), sched(1000, 0, "pending")]]),
      );
      expect(totals.checkedOff).toBe(500);
    });
  });
});
