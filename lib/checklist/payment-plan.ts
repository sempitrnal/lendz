import type { ScheduleDialogRow } from "@/lib/checklist/schedule-cache";
import { remainingOnInstallment } from "@/lib/payment-schedule/schedule-balances";

export type ScheduleChoice = {
  status: "paid" | "partial" | "undo" | null;
  amount: string;
};

export type PaymentPlan = {
  /** What each chosen Paid/Partial puts toward its schedule. */
  payments: { scheduleId: string; amount: number }[];
  /** Schedules to mark paid in one call. */
  paidIds: string[];
  /** Partial payments to apply one by one. */
  partials: { id: string; amount: number }[];
  undoCalls: {
    accountId: string;
    scheduleId: string;
    status: "pending" | "overdue";
  }[];
};

/**
 * Turns the per-row choices into the writes to make. Paid pays what is left;
 * Partial pays the typed amount, capped at what is left (zero, negative and
 * non-numeric amounts pay nothing); Undo resets to pending, or overdue once
 * past due. Rows without a choice are skipped.
 */
export function buildPaymentPlan(
  rows: ScheduleDialogRow[],
  choices: Record<string, ScheduleChoice>,
  overdueCutoff: string,
): PaymentPlan {
  const plan: PaymentPlan = {
    payments: [],
    paidIds: [],
    partials: [],
    undoCalls: [],
  };

  for (const row of rows) {
    const choice = choices[row.id];
    if (!choice?.status) continue;

    if (choice.status === "undo") {
      plan.undoCalls.push({
        accountId: row.account_id,
        scheduleId: row.id,
        status: row.due_date < overdueCutoff ? "overdue" : "pending",
      });
      continue;
    }

    if (choice.status === "paid") {
      if (row.status === "paid") continue;
      plan.payments.push({
        scheduleId: row.id,
        amount: remainingOnInstallment(row),
      });
      plan.paidIds.push(row.id);
      continue;
    }

    const typed = Number.parseFloat(choice.amount || "0");
    if (!Number.isFinite(typed) || typed <= 0) continue;
    const amount = Math.min(typed, remainingOnInstallment(row));
    if (amount <= 0) continue;
    plan.payments.push({ scheduleId: row.id, amount });
    plan.partials.push({ id: row.id, amount });
  }

  return plan;
}
