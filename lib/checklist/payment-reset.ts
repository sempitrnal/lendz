import {
  buildPaymentPlan,
  type PaymentPlan,
  type ScheduleChoice,
} from "@/lib/checklist/payment-plan";
import type { ScheduleDialogRow } from "@/lib/checklist/schedule-cache";
import { amountPaidOnInstallment } from "@/lib/payment-schedule/schedule-balances";
import { cents } from "@/lib/checklist/amount-input";

/**
 * The server can only reset an installment (it deletes every payment on it),
 * never take part of a payment off. So lowering or taking back what is
 * recorded is two steps run one after the other: reset, then record the
 * amount that should stay. These helpers build both plans.
 */

/** The installment as the reset leaves it: nothing paid, all of it owed. */
export function resetCopy(
  row: ScheduleDialogRow,
  overdueCutoff: string,
): ScheduleDialogRow {
  const due = Math.max(0, Number(row.amount_due ?? 0));
  return {
    ...row,
    status: row.due_date < overdueCutoff ? "overdue" : "pending",
    amount_paid: 0,
    remaining_amount: due,
  };
}

/** Resets every row (Undo of the old dialog: back to pending or overdue). */
export function resetPlan(
  rows: ScheduleDialogRow[],
  overdueCutoff: string,
): PaymentPlan {
  return buildPaymentPlan(
    rows,
    Object.fromEntries(
      rows.map((r) => [r.id, { status: "undo", amount: "" } as ScheduleChoice]),
    ),
    overdueCutoff,
  );
}

/**
 * Records `amounts[id]` on the reset copy of each row: the whole installment
 * counts as paid, anything less is a partial, zero or less records nothing.
 * Run it only after the reset has gone through.
 */
export function planOnReset(
  rows: ScheduleDialogRow[],
  amounts: Record<string, number>,
  overdueCutoff: string,
): PaymentPlan {
  const copies = rows.map((r) => resetCopy(r, overdueCutoff));
  const choices: Record<string, ScheduleChoice> = {};
  for (const copy of copies) {
    const amount = amounts[copy.id];
    if (!(amount > 0)) continue;
    choices[copy.id] =
      // Centavos on both sides, so float noise can't turn a full amount
      // into a partial.
      cents(amount) >= cents(copy.amount_due)
        ? { status: "paid", amount: "" }
        : { status: "partial", amount: String(cents(amount)) };
  }
  return buildPaymentPlan(copies, choices, overdueCutoff);
}

/**
 * Puts `rowsBefore` back as they were: `reset` clears them, then `restore`
 * (run after it) re-records what each had paid.
 */
export function buildResetAndRestore(
  rowsBefore: ScheduleDialogRow[],
  overdueCutoff: string,
): { reset: PaymentPlan; restore: PaymentPlan } {
  return {
    reset: resetPlan(rowsBefore, overdueCutoff),
    restore: planOnReset(
      rowsBefore,
      Object.fromEntries(
        rowsBefore.map((r) => [r.id, amountPaidOnInstallment(r)]),
      ),
      overdueCutoff,
    ),
  };
}

/** How many server calls a plan makes (all paid ids go in one call). */
export function planCallCount(plan: PaymentPlan): number {
  return (
    (plan.paidIds.length > 0 ? 1 : 0) +
    plan.partials.length +
    plan.undoCalls.length
  );
}

export const isEmptyPlan = (plan: PaymentPlan) => planCallCount(plan) === 0;
