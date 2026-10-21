import {
  addManualScheduleAction,
  applyPartialPaymentAction,
} from "@/lib/actions/schedules";
import type { ManualAccount, NextCollectionItem } from "@/lib/checklist/labels";
import { actionWasQueued } from "@/lib/checklist/schedule-cache";
import { getPendingOutboxCount } from "@/lib/offline/outbox";

export type ManualPaymentResult =
  | { ok: true; schedule: NextCollectionItem; rolloverAmount: number }
  /**
   * `unknown` is set when it isn't known whether the payment was saved: the
   * action threw (it may have committed before failing) or returned neither
   * an id nor an error. Without it the action reported the failure itself.
   */
  | { ok: false; error: string; unknown?: true }
  /**
   * The service worker queued the call (offline or a slow connection): it
   * replays when the connection is back, so the payment will be recorded and
   * must not be tried again. Shaped as a failure with `unknown` so a caller
   * that doesn't know about `queued` keeps treating it as before.
   * `schedule` is the rolling account's open schedule the payment goes
   * against; a flat account's new schedule has no id yet (null).
   */
  | {
      ok: false;
      error: string;
      unknown: true;
      queued: true;
      schedule: NextCollectionItem | null;
      rolloverAmount: number;
    };

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
  const queuedBefore = await pendingCount();
  const queued = async (error: string): Promise<ManualPaymentResult | null> =>
    queuedBefore !== null && (await wasQueued(queuedBefore))
      ? {
          ok: false,
          error,
          unknown: true,
          queued: true,
          schedule: open
            ? {
                id: open.id,
                due_date: open.due_date,
                amount,
                type: account.type,
              }
            : null,
          rolloverAmount: open ? Math.max(0, open.amount - amount) : 0,
        }
      : null;
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
      if (!result?.error) {
        const held = await queued("Couldn't add the payment (offline?)");
        if (held) return held;
      }
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
    const held = await queued("Couldn't add the payment");
    if (held) return held;
    console.error("recordManualPayment error:", err);
    return { ok: false, error: "Couldn't add the payment", unknown: true };
  }
}

/** The outbox count before the call; null when it can't be read. */
async function pendingCount(): Promise<number | null> {
  try {
    return await getPendingOutboxCount();
  } catch {
    return null;
  }
}

async function wasQueued(before: number): Promise<boolean> {
  try {
    return await actionWasQueued(before);
  } catch {
    return false;
  }
}
