import {
  addManualScheduleAction,
  applyPartialPaymentAction,
} from "@/lib/actions/schedules";
import type { ManualAccount, NextCollectionItem } from "@/lib/checklist/labels";

export type ManualPaymentResult =
  | { ok: true; schedule: NextCollectionItem; rolloverAmount: number }
  /**
   * `unknown` is set when it isn't known whether the payment was saved: the
   * action threw (it may have committed before failing) or returned neither
   * an id nor an error. Without it the action reported the failure itself.
   */
  | { ok: false; error: string; unknown?: true };

/**
 * Records a payment on a manual account. Rolling accounts pay their open
 * schedule (the rest rolls over with interest); flat accounts get a new paid
 * schedule due on the paid date. Callers own the toasts and cache refresh.
 */
export async function recordManualPayment(input: {
  account: ManualAccount;
  amount: number;
  paidDate: string;
}): Promise<ManualPaymentResult> {
  const { account, amount, paidDate } = input;
  const open = account.rolling?.open ?? null;
  try {
    if (open) {
      const fd = new FormData();
      fd.set("scheduleId", open.id);
      fd.set("paymentAmount", String(amount));
      fd.set("paymentDate", paidDate);
      await applyPartialPaymentAction(fd);
      return {
        ok: true,
        schedule: {
          id: open.id,
          due_date: open.due_date,
          amount,
          type: account.type,
        },
        rolloverAmount: Math.max(0, open.amount - amount),
      };
    }
    const result = await addManualScheduleAction(account.id, {
      due_date: paidDate,
      amount_due: amount,
      status: "paid",
      paid_date: paidDate,
    });
    if (!result?.id) {
      return result?.error
        ? { ok: false, error: result.error }
        : {
            ok: false,
            error: "Couldn't add the payment (offline?)",
            unknown: true,
          };
    }
    return {
      ok: true,
      schedule: {
        id: result.id,
        due_date: paidDate,
        amount,
        type: account.type,
      },
      rolloverAmount: 0,
    };
  } catch (err) {
    console.error("recordManualPayment error:", err);
    return { ok: false, error: "Couldn't add the payment", unknown: true };
  }
}
