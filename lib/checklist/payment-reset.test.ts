import { describe, expect, it } from "vitest";
import {
  buildResetAndRestore,
  isEmptyPlan,
  planCallCount,
  planOnReset,
  resetCopy,
} from "@/lib/checklist/payment-reset";
import type { ScheduleDialogRow } from "@/lib/checklist/schedule-cache";

const CUTOFF = "2026-10-20";

function sched(over: Partial<ScheduleDialogRow> = {}): ScheduleDialogRow {
  return {
    id: "s1",
    account_id: "a1",
    due_date: "2026-10-15",
    amount_due: 2000,
    amount_paid: 0,
    remaining_amount: 2000,
    status: "overdue",
    ...over,
  };
}

describe("resetCopy", () => {
  it("clears what was paid, overdue when past due", () => {
    expect(
      resetCopy(
        sched({ status: "paid", amount_paid: 2000, remaining_amount: 0 }),
        CUTOFF,
      ),
    ).toMatchObject({
      status: "overdue",
      amount_paid: 0,
      remaining_amount: 2000,
    });
    expect(
      resetCopy(sched({ due_date: "2026-10-25", status: "partial" }), CUTOFF)
        .status,
    ).toBe("pending");
  });
});

describe("planOnReset", () => {
  it("records the full installment as paid and less as a partial", () => {
    const plan = planOnReset(
      [
        sched({
          id: "a",
          status: "paid",
          amount_paid: 2000,
          remaining_amount: 0,
        }),
        sched({ id: "b", status: "partial", amount_paid: 900 }),
        sched({ id: "c", status: "partial", amount_paid: 900 }),
      ],
      { a: 2000, b: 300, c: 0 },
      CUTOFF,
    );
    expect(plan.paidIds).toEqual(["a"]);
    expect(plan.partials).toEqual([{ id: "b", amount: 300 }]);
    expect(plan.payments).toEqual([
      { scheduleId: "a", amount: 2000 },
      { scheduleId: "b", amount: 300 },
    ]);
    expect(plan.undoCalls).toEqual([]);
  });

  it("clamps to the whole installment", () => {
    const plan = planOnReset([sched()], { s1: 5000 }, CUTOFF);
    expect(plan.payments).toEqual([{ scheduleId: "s1", amount: 2000 }]);
  });
});

describe("buildResetAndRestore", () => {
  it("resets every row and puts back what each had", () => {
    const { reset, restore } = buildResetAndRestore(
      [
        sched({ id: "a", status: "paid", amount_paid: 0, remaining_amount: 0 }),
        sched({ id: "b", status: "partial", amount_paid: 400 }),
        sched({ id: "c", due_date: "2026-10-30", status: "pending" }),
      ],
      CUTOFF,
    );
    expect(reset.undoCalls).toEqual([
      { accountId: "a1", scheduleId: "a", status: "overdue" },
      { accountId: "a1", scheduleId: "b", status: "overdue" },
      { accountId: "a1", scheduleId: "c", status: "pending" },
    ]);
    expect(reset.payments).toEqual([]);
    // A paid row with no amount recorded counts as the whole installment.
    expect(restore.paidIds).toEqual(["a"]);
    expect(restore.partials).toEqual([{ id: "b", amount: 400 }]);
    expect(restore.undoCalls).toEqual([]);
  });
});

describe("planCallCount", () => {
  it("counts one call for all paid ids plus one per partial and undo", () => {
    const { reset, restore } = buildResetAndRestore(
      [
        sched({
          id: "a",
          status: "paid",
          amount_paid: 2000,
          remaining_amount: 0,
        }),
        sched({
          id: "b",
          status: "paid",
          amount_paid: 2000,
          remaining_amount: 0,
        }),
        sched({ id: "c", status: "partial", amount_paid: 400 }),
      ],
      CUTOFF,
    );
    expect(planCallCount(reset)).toBe(3);
    expect(planCallCount(restore)).toBe(2);
    expect(isEmptyPlan(planOnReset([], {}, CUTOFF))).toBe(true);
  });
});
