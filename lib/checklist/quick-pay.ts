import {
  buildPaymentPlan,
  type PaymentPlan,
  type ScheduleChoice,
} from "@/lib/checklist/payment-plan";
import type { LineState } from "@/lib/checklist/row-state";
import type { ScheduleDialogRow } from "@/lib/checklist/schedule-cache";
import { amountPaidOnInstallment } from "@/lib/payment-schedule/schedule-balances";

export type QuickPay = {
  /** Marks every targeted installment paid (what is left of it). */
  pay: PaymentPlan;
  /** Takes the payment back: resets the paid installments to unpaid. */
  undo: PaymentPlan;
  /**
   * Run after `undo` (not together: the reset deletes every payment on the
   * installment) to put back what was already paid on it before this pay.
   */
  restore: PaymentPlan;
  accountIds: string[];
  /** What this pay puts toward the installments. */
  amount: number;
  /** Whether every installment of the row is paid once this pay lands. */
  settlesRow: boolean;
};

const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * The one-tap pay of a collection row: pays what is left on `targetIds` in
 * full, plus the plans its Undo runs. Every amount (what is paid, what Undo
 * puts back) comes from `schedules`, never from the row's own state, so pass
 * the freshest rows there are. Returns null when an installment isn't
 * among `schedules` (load it first) or there is nothing left to pay.
 */
export function buildQuickPay(
  lines: { id: string; state: LineState }[],
  targetIds: string[],
  schedules: ScheduleDialogRow[],
  overdueCutoff: string,
): QuickPay | null {
  if (targetIds.length === 0) return null;
  const byId = new Map(schedules.map((s) => [s.id, s]));
  const targets: ScheduleDialogRow[] = [];
  for (const id of new Set(targetIds)) {
    const row = byId.get(id);
    if (!row) return null;
    targets.push(row);
  }

  const choices = (status: ScheduleChoice["status"], ids: string[]) =>
    Object.fromEntries(ids.map((id) => [id, { status, amount: "" }]));

  const pay = buildPaymentPlan(
    targets,
    choices(
      "paid",
      targets.map((t) => t.id),
    ),
    overdueCutoff,
  );
  if (pay.payments.length === 0) return null;

  const paidNow = new Set(pay.paidIds);
  const paidTargets = targets.filter((t) => paidNow.has(t.id));
  const undo = buildPaymentPlan(
    paidTargets,
    choices("undo", [...paidNow]),
    overdueCutoff,
  );

  // What was already on each installment, re-applied to its reset copy.
  const before = paidTargets
    .map((t) => ({ row: t, paid: amountPaidOnInstallment(t) }))
    .filter((b) => b.paid > 0);
  const restore = buildPaymentPlan(
    before.map(({ row }) => ({
      ...row,
      status: "pending",
      amount_paid: 0,
      remaining_amount: row.amount_due,
    })),
    Object.fromEntries(
      before.map(({ row, paid }) => [
        row.id,
        { status: "partial", amount: String(paid) },
      ]),
    ),
    overdueCutoff,
  );

  return {
    pay,
    undo,
    restore,
    accountIds: [...new Set(targets.map((t) => t.account_id))],
    amount: cents(pay.payments.reduce((sum, p) => sum + p.amount, 0)),
    settlesRow: lines.every((l) => {
      if (paidNow.has(l.id)) return true;
      // The rows passed in (live when online) win over the row's own state.
      const live = byId.get(l.id);
      return live ? live.status === "paid" : l.state === "paid";
    }),
  };
}
