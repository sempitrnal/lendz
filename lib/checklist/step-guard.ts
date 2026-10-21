import type { PaymentPlan } from "@/lib/checklist/payment-plan";
import type { ScheduleDialogRow } from "@/lib/checklist/schedule-cache";
import { isEmptyPlan } from "@/lib/checklist/payment-reset";
import { amountPaidOnInstallment } from "@/lib/payment-schedule/schedule-balances";
import { cents } from "@/lib/checklist/amount-input";

/**
 * Guards for multi-step payment writes (`record-steps.ts`): Undo, lowering a
 * recorded payment, bulk Undo. The server's reset deletes every payment on an
 * installment and doesn't report a failed write, and a write sent straight to
 * the server can overtake older ones still waiting in the offline outbox.
 */

/**
 * Whether a run needs the guards: it resets an installment, or it has more
 * than one write that must land in order. A plain pay doesn't.
 */
export function needsStepGuard(plans: PaymentPlan[]): boolean {
  const real = plans.filter((p) => !isEmptyPlan(p));
  return real.length > 1 || real.some((p) => p.undoCalls.length > 0);
}

/**
 * Online with offline changes still waiting: a write now would reach the
 * server before them (the outbox replays later), so it must wait. Offline
 * (connection not good) every write queues behind them, in order.
 */
export function refuseWhileSyncing(state: {
  connectionGood: boolean;
  pending: number;
}): boolean {
  return state.connectionGood && state.pending > 0;
}

export const STILL_SYNCING =
  "Still syncing offline changes — try again in a moment";

/**
 * Whether the installments a reset was sent for now read as reset (live
 * rows): not paid and nothing recorded on them (to the centavo). A missing
 * row can't be confirmed. `stillRecorded` is what is still on the ones that
 * weren't.
 */
export function resetTookEffect(
  rows: ScheduleDialogRow[],
  resetIds: string[],
): { ok: boolean; stillRecorded: number } {
  const byId = new Map(rows.map((r) => [r.id, r]));
  let ok = true;
  let stillRecorded = 0;
  for (const id of new Set(resetIds)) {
    const row = byId.get(id);
    if (!row) {
      ok = false;
      continue;
    }
    const recorded = cents(amountPaidOnInstallment(row));
    if (row.status === "paid" || recorded > 0) {
      ok = false;
      stillRecorded += recorded;
    }
  }
  return { ok, stillRecorded: cents(stillRecorded) };
}

/**
 * The message when a reset can't be confirmed (the re-read failed, or shows
 * the money still there), so nothing more was written.
 */
export function resetUnconfirmedMessage(
  stillRecorded: number | null,
  action: "undo" | "save",
  peso: (n: number) => string,
): string {
  const head =
    action === "undo"
      ? "Couldn't undo — check what is recorded on the account"
      : "Couldn't save the new amount — check what is recorded on the account";
  return stillRecorded !== null && stillRecorded > 0
    ? `${head} (${peso(stillRecorded)} still recorded)`
    : head;
}
