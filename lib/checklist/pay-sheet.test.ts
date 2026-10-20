import { describe, expect, it } from "vitest";
import {
  buildPaySheet,
  payButtonLabel,
  payFailureMessage,
  type PaySheetInput,
} from "@/lib/checklist/pay-sheet";
import type { ScheduleDialogRow } from "@/lib/checklist/schedule-cache";

const CUTOFF = "2026-10-20";
const peso = (n: number) =>
  `₱${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

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

const two = [
  sched({ id: "a" }),
  sched({
    id: "b",
    account_id: "a2",
    amount_due: 1000,
    remaining_amount: 1000,
  }),
];

function input(over: Partial<PaySheetInput> = {}): PaySheetInput {
  return {
    rows: two,
    lineIds: ["a", "b"],
    picked: {},
    custom: false,
    amounts: {},
    overdueCutoff: CUTOFF,
    ...over,
  };
}

describe("buildPaySheet", () => {
  it("pays every open installment in full by default and settles the row", () => {
    const pay = buildPaySheet(input());
    expect(pay.open.map((r) => r.id)).toEqual(["a", "b"]);
    expect(pay.plan.paidIds).toEqual(["a", "b"]);
    expect(pay.total).toBe(3000);
    expect(pay.settlesRow).toBe(true);
    expect(pay.accountIds).toEqual(["a1", "a2"]);
    expect(pay.pendingByAccount.a1).toEqual({
      paidAmount: 2000,
      partialAmount: 0,
      installments: 1,
      undoAmount: 0,
      undoInstallments: 0,
    });
    expect(pay.calls).toBe(1);
    expect(payButtonLabel(pay, peso)).toBe("Record ₱3,000 paid");
  });

  it("leaves an unticked installment unpaid and does not settle the row", () => {
    const pay = buildPaySheet(input({ picked: { b: false } }));
    expect(pay.plan.paidIds).toEqual(["a"]);
    expect(pay.total).toBe(2000);
    expect(pay.settlesRow).toBe(false);
    expect(pay.accountIds).toEqual(["a1"]);
  });

  it("skips installments already paid and keeps them settled", () => {
    const pay = buildPaySheet(
      input({
        rows: [sched({ id: "a", status: "paid", remaining_amount: 0 }), two[1]],
      }),
    );
    expect(pay.open.map((r) => r.id)).toEqual(["b"]);
    expect(pay.settlesRow).toBe(true);
  });

  it("pays only what is left of a part-paid installment and undo restores the part", () => {
    const pay = buildPaySheet(
      input({
        rows: [
          sched({
            id: "a",
            status: "partial",
            amount_paid: 400,
            remaining_amount: 1600,
          }),
        ],
        lineIds: ["a"],
      }),
    );
    expect(pay.total).toBe(1600);
    expect(pay.undo.reset.undoCalls.map((c) => c.scheduleId)).toEqual(["a"]);
    expect(pay.undo.restore.partials).toEqual([{ id: "a", amount: 400 }]);
  });

  it("with a different amount, a smaller one is a partial", () => {
    const pay = buildPaySheet(
      input({ custom: true, amounts: { a: "500", b: "1,000" } }),
    );
    expect(pay.plan.partials).toEqual([{ id: "a", amount: 500 }]);
    expect(pay.plan.paidIds).toEqual(["b"]);
    expect(pay.total).toBe(1500);
    expect(pay.settlesRow).toBe(false);
    expect(pay.pendingByAccount.a1.partialAmount).toBe(500);
    expect(pay.calls).toBe(2);
  });

  it("clamps an amount above what is left and counts it as paid", () => {
    const pay = buildPaySheet(
      input({ custom: true, amounts: { a: "2,500", b: "1000" } }),
    );
    expect(pay.clampedIds).toEqual(["a"]);
    expect(pay.plan.paidIds).toEqual(["a", "b"]);
    expect(pay.total).toBe(3000);
    expect(pay.settlesRow).toBe(true);
  });

  it("ignores blank and zero amounts and flags unreadable ones", () => {
    const pay = buildPaySheet(
      input({ custom: true, amounts: { a: "1,5", b: "0" } }),
    );
    expect(pay.plan.payments).toEqual([]);
    expect(pay.invalidIds).toEqual(["a"]);
    expect(payButtonLabel(pay, peso)).toBe("Check the amounts");

    const blank = buildPaySheet(
      input({ custom: true, amounts: { a: "", b: "" } }),
    );
    expect(blank.invalidIds).toEqual([]);
    expect(blank.total).toBe(0);
    expect(payButtonLabel(blank, peso)).toBe("Pick an installment");
  });

  it("never settles a row with an installment that couldn't be loaded", () => {
    const pay = buildPaySheet(input({ lineIds: ["a", "b", "gone"] }));
    expect(pay.settlesRow).toBe(false);
    expect(pay.total).toBe(3000);
  });

  it("rounds a typed amount to centavos", () => {
    const pay = buildPaySheet(
      input({ custom: true, amounts: { a: "100.555" }, picked: { b: false } }),
    );
    expect(pay.plan.partials).toEqual([{ id: "a", amount: 100.56 }]);
  });
});

describe("payFailureMessage", () => {
  it("keeps the default for one call and warns for several", () => {
    expect(payFailureMessage(1)).toBeUndefined();
    expect(payFailureMessage(2)).toMatch(/check what is recorded/);
  });
});
