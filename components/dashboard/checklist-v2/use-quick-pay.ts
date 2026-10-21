"use client";

import { useRef } from "react";
import { toast } from "sonner";
import { useRecordPayments } from "@/components/dashboard/checklist/use-record-payments";
import {
  loadAccountSummaries,
  loadSchedules,
  readCachedSchedules,
  readCachedSummaries,
  type AccountSummary,
  type ScheduleDialogRow,
} from "@/lib/checklist/schedule-cache";
import { heldBackPointer } from "@/lib/checklist/manual-accounts";
import { buildQuickPay } from "@/lib/checklist/quick-pay";
import { overdueCutoffDateValue, todayDateValue } from "@/lib/checklist/dates";
import type { RowView } from "@/lib/checklist/row-state";
import { peso } from "@/components/dashboard/checklist-v2/header";
import { recordInSteps } from "@/components/dashboard/checklist-v2/record-steps";

/** The pay toast and its Undo (Global Constraints: 6000 ms for pay). */
const PAY_TOAST_MS = 6000;

/**
 * One-tap pay for collection rows: pays what is left on the given
 * installments in full, ticks the item once the row is fully paid, and shows
 * a toast whose Undo resets the installments (putting back any part payment
 * they had before) and unticks the item.
 */
export function useQuickPay(
  setChecked: (ids: string[], checked: boolean) => void,
) {
  const recordPayments = useRecordPayments();
  /** Rows with a pay still being worked out, so a double tap pays once. */
  const busy = useRef(new Set<string>());

  return async (
    row: RowView,
    lineIds: string[],
    /** The toast text, given the ₱ amount paid. */
    message: (amount: string) => string,
  ) => {
    const itemId = row.item.id;
    if (busy.current.has(itemId) || lineIds.length === 0) return;
    busy.current.add(itemId);
    try {
      // Live rows when online (like the pay dialog), so a payment recorded
      // or removed elsewhere since the day loaded is counted; the saved copy
      // only offline or when the live load fails. Every line of the row is
      // loaded so "fully paid" is judged on the same numbers.
      const allIds = [...new Set([...lineIds, ...row.lines.map((l) => l.id)])];
      // The account types too: a manual account's pay gets no Undo.
      const summariesLoad = loadAccountSummaries(lineIds).catch(
        (): Record<string, AccountSummary> | null =>
          readCachedSummaries(lineIds),
      );
      let schedules: ScheduleDialogRow[];
      try {
        schedules = await loadSchedules(allIds);
      } catch {
        schedules = readCachedSchedules(allIds);
      }
      const summaries = await summariesLoad;
      const loaded = new Set(schedules.map((s) => s.id));
      if (!lineIds.every((id) => loaded.has(id))) {
        // Never pay from the label's amounts.
        toast.error("Couldn't load this payment. Try again when online.");
        return;
      }
      const quick = buildQuickPay(
        row.lines,
        lineIds,
        schedules,
        overdueCutoffDateValue(),
      );
      if (!quick) {
        toast.error("Nothing left to pay here.");
        return;
      }

      const borrowerId = row.model?.borrower?.id ?? null;
      const paymentDate = todayDateValue();
      // Only a tick this pay set is taken back by its Undo or a failure.
      const tick = quick.settlesRow && !row.item.is_checked;
      const base = { accountIds: quick.accountIds, borrowerId, paymentDate };
      const heldBack = heldBackPointer(quick.accountIds, summaries);
      let toastId: string | number | undefined;
      /** The pay's server result; set below before any toast (and Undo) shows. */
      let paid: Promise<"saved" | "queued" | "failed"> | null = null;

      const undo = async () => {
        // Never let the reset race the pay it takes back.
        if (!paid || (await paid) === "failed") return;
        const restored = quick.restore.payments.reduce(
          (sum, p) => sum + p.amount,
          0,
        );
        // The reset deletes every payment on the installment; the restore
        // then puts back what was there before this pay.
        await recordInSteps(recordPayments, base, [
          {
            plan: quick.undo,
            failureMessage: "Couldn't undo — the payment is still recorded",
            // Still paid after a refusal: the tick stays.
            onDone: () => {
              if (tick) setChecked([itemId], false);
            },
          },
          {
            plan: quick.restore,
            failureMessage: `Couldn't put back the earlier ${peso(
              restored,
            )} payment — re-enter it`,
          },
        ]);
      };

      paid = recordPayments({
        ...base,
        plan: quick.pay,
        onApplied: () => {
          if (tick) setChecked([itemId], true);
          toastId = toast(
            message(peso(quick.amount)),
            heldBack
              ? { duration: PAY_TOAST_MS, description: heldBack }
              : {
                  duration: PAY_TOAST_MS,
                  action: { label: "Undo", onClick: () => void undo() },
                },
          );
        },
        onFailed: () => {
          if (tick) setChecked([itemId], false);
          if (toastId !== undefined) toast.dismiss(toastId);
        },
      });
      await paid;
    } finally {
      busy.current.delete(itemId);
    }
  };
}
