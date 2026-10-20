import { describe, expect, it } from "vitest";
import { buildPaymentPlan } from "@/lib/checklist/payment-plan";
import type { ScheduleDialogRow } from "@/lib/checklist/schedule-cache";

const CUTOFF = "2026-10-20";

function row(over: Partial<ScheduleDialogRow> = {}): ScheduleDialogRow {
  return {
    id: "s1",
    account_id: "a1",
    due_date: "2026-10-25",
    amount_due: 2000,
    amount_paid: 500,
    remaining_amount: 1500,
    status: "partial",
    ...over,
  };
}

describe("buildPaymentPlan", () => {
  it("paid pays what is left", () => {
    const plan = buildPaymentPlan(
      [row()],
      { s1: { status: "paid", amount: "" } },
      CUTOFF,
    );
    expect(plan.payments).toEqual([{ scheduleId: "s1", amount: 1500 }]);
    expect(plan.paidIds).toEqual(["s1"]);
    expect(plan.partials).toEqual([]);
    expect(plan.undoCalls).toEqual([]);
  });

  it("partial pays the typed amount", () => {
    const plan = buildPaymentPlan(
      [row()],
      { s1: { status: "partial", amount: "400" } },
      CUTOFF,
    );
    expect(plan.payments).toEqual([{ scheduleId: "s1", amount: 400 }]);
    expect(plan.partials).toEqual([{ id: "s1", amount: 400 }]);
    expect(plan.paidIds).toEqual([]);
  });

  it("clamps a partial larger than what is owed", () => {
    const plan = buildPaymentPlan(
      [row()],
      { s1: { status: "partial", amount: "99999" } },
      CUTOFF,
    );
    expect(plan.payments).toEqual([{ scheduleId: "s1", amount: 1500 }]);
    expect(plan.partials).toEqual([{ id: "s1", amount: 1500 }]);
  });

  it.each(["0", "-5", "abc", ""])("ignores partial amount %j", (amount) => {
    const plan = buildPaymentPlan(
      [row()],
      { s1: { status: "partial", amount } },
      CUTOFF,
    );
    expect(plan.payments).toEqual([]);
    expect(plan.partials).toEqual([]);
  });

  it("paid on an already-paid schedule does nothing", () => {
    const plan = buildPaymentPlan(
      [row({ status: "paid", amount_paid: 2000, remaining_amount: 0 })],
      { s1: { status: "paid", amount: "" } },
      CUTOFF,
    );
    expect(plan).toEqual({
      payments: [],
      paidIds: [],
      partials: [],
      undoCalls: [],
    });
  });

  it("undo resets to pending, or overdue once past due", () => {
    const plan = buildPaymentPlan(
      [
        row({ id: "s1", account_id: "a1", due_date: "2026-10-25" }),
        row({ id: "s2", account_id: "a2", due_date: "2026-10-01" }),
      ],
      {
        s1: { status: "undo", amount: "" },
        s2: { status: "undo", amount: "" },
      },
      CUTOFF,
    );
    expect(plan.undoCalls).toEqual([
      { accountId: "a1", scheduleId: "s1", status: "pending" },
      { accountId: "a2", scheduleId: "s2", status: "overdue" },
    ]);
    expect(plan.payments).toEqual([]);
  });

  it("rows with no choice are ignored", () => {
    const plan = buildPaymentPlan(
      [row({ id: "s1" }), row({ id: "s2" })],
      { s1: { status: null, amount: "100" } },
      CUTOFF,
    );
    expect(plan).toEqual({
      payments: [],
      paidIds: [],
      partials: [],
      undoCalls: [],
    });
  });
});
