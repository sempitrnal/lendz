import { describe, expect, it } from "vitest";
import {
  buildPaySheet,
  isCustomRow,
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

  it("a row's own Partial pays a typed amount while the others pay in full", () => {
    const pay = buildPaySheet(
      input({ customRows: { a: true }, amounts: { a: "500", b: "1" } }),
    );
    // b is not in partial mode, so its typed 1 is ignored: paid in full.
    expect(pay.plan.partials).toEqual([{ id: "a", amount: 500 }]);
    expect(pay.plan.paidIds).toEqual(["b"]);
    expect(pay.total).toBe(1500);
    expect(pay.custom).toBe(true);
  });

  it("an empty box on a row set to Partial pays nothing for it", () => {
    const pay = buildPaySheet(
      input({ customRows: { a: true }, amounts: { a: "" } }),
    );
    expect(pay.plan.paidIds).toEqual(["b"]);
    expect(pay.total).toBe(1000);
    expect(pay.invalidIds).toEqual([]);
  });

  it("a row can go back to full while the sheet-wide switch is on", () => {
    const pay = buildPaySheet(
      input({
        custom: true,
        customRows: { a: false },
        amounts: { a: "5", b: "400" },
      }),
    );
    expect(pay.plan.paidIds).toEqual(["a"]);
    expect(pay.plan.partials).toEqual([{ id: "b", amount: 400 }]);
  });

  it("isCustomRow lets a row's own choice win over the sheet-wide one", () => {
    expect(isCustomRow("a", false, undefined)).toBe(false);
    expect(isCustomRow("a", true, undefined)).toBe(true);
    expect(isCustomRow("a", true, { a: false })).toBe(false);
    expect(isCustomRow("a", false, { a: true })).toBe(true);
    expect(isCustomRow("b", false, { a: true })).toBe(false);
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
    expect(payButtonLabel(blank, peso)).toBe("Enter an amount");
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

describe("buildPaySheet with float noise in what is left", () => {
  // 113.37 - 14.63 is 98.74000000000001 in floating point.
  const noisy = sched({
    id: "n",
    amount_due: 113.37,
    amount_paid: 14.63,
    remaining_amount: 98.74,
    status: "partial",
  });
  const run = (typed: string, row = noisy) =>
    buildPaySheet(
      input({
        rows: [row],
        lineIds: [row.id],
        custom: true,
        amounts: { [row.id]: typed },
      }),
    );

  it("has noise to begin with", () => {
    expect(113.37 - 14.63).not.toBe(98.74);
  });

  it("the prefilled rest (98.74) is a paid choice that settles the row", () => {
    const pay = run("98.74");
    expect(pay.choices.n).toEqual({ status: "paid", amount: "" });
    expect(pay.plan.paidIds).toEqual(["n"]);
    expect(pay.plan.partials).toEqual([]);
    expect(pay.clampedIds).toEqual([]);
    expect(pay.settlesRow).toBe(true);
    expect(pay.total).toBe(98.74);
  });

  it("98.75 clamps and counts as the whole rest", () => {
    const pay = run("98.75");
    expect(pay.clampedIds).toEqual(["n"]);
    expect(pay.plan.paidIds).toEqual(["n"]);
    expect(pay.settlesRow).toBe(true);
  });

  it("98.73 stays a partial", () => {
    const pay = run("98.73");
    expect(pay.clampedIds).toEqual([]);
    expect(pay.plan.partials).toEqual([{ id: "n", amount: 98.73 }]);
    expect(pay.settlesRow).toBe(false);
  });

  it("holds for many noisy due/paid pairs", () => {
    let noisyPairs = 0;
    for (let due = 100; due < 200; due += 7.37) {
      for (let paid = 0.01; paid < 50; paid += 3.13) {
        const d = Math.round(due * 100) / 100;
        const p = Math.round(paid * 100) / 100;
        if (d - p !== Math.round((d - p) * 100) / 100) noisyPairs += 1;
        const row = sched({
          id: "x",
          amount_due: d,
          amount_paid: p,
          remaining_amount: d - p,
          status: "partial",
        });
        const shown = String(Math.round((d - p) * 100) / 100);
        const pay = run(shown, row);
        expect(pay.plan.paidIds).toEqual(["x"]);
        expect(pay.settlesRow).toBe(true);
        expect(pay.clampedIds).toEqual([]);
      }
    }
    expect(noisyPairs).toBeGreaterThan(0);
  });

  it("an installment with only noise left is not open", () => {
    const pay = buildPaySheet(
      input({
        rows: [
          sched({
            id: "z",
            amount_due: 0.3,
            amount_paid: 0.1 + 0.2,
            status: "partial",
          }),
        ],
        lineIds: ["z"],
      }),
    );
    expect(pay.open).toEqual([]);
  });
});

describe("payButtonLabel in custom mode", () => {
  it("asks for an amount when installments are ticked but nothing is typed", () => {
    const pay = buildPaySheet(
      input({ custom: true, amounts: { a: "", b: "0" } }),
    );
    expect(payButtonLabel(pay, peso)).toBe("Enter an amount");
    const none = buildPaySheet(input({ picked: { a: false, b: false } }));
    expect(payButtonLabel(none, peso)).toBe("Pick an installment");
  });
});
