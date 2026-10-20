"use client";

import { useRef } from "react";
import { toast } from "sonner";
import { useRecordPayments } from "@/components/dashboard/checklist/use-record-payments";
import {
  loadSchedules,
  readCachedSchedules,
} from "@/lib/checklist/schedule-cache";
import { buildQuickPay } from "@/lib/checklist/quick-pay";
import { overdueCutoffDateValue, todayDateValue } from "@/lib/checklist/dates";
import type { RowView } from "@/lib/checklist/row-state";
import { peso } from "@/components/dashboard/checklist-v2/header";

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
      let schedules = readCachedSchedules(lineIds);
      if (schedules.length < new Set(lineIds).size) {
        try {
          schedules = await loadSchedules(lineIds);
        } catch {
          toast.error("Couldn't load this payment. Try again when online.");
          return;
        }
      }
      const quick = buildQuickPay(
        row.lines,
        lineIds,
        schedules,
        overdueCutoffDateValue(),
      );
      if (!quick) {
        toast.error(
          schedules.length < new Set(lineIds).size
            ? "Couldn't load this payment. Try again when online."
            : "Nothing left to pay here.",
        );
        return;
      }

      const borrowerId = row.model?.borrower?.id ?? null;
      const paymentDate = todayDateValue();
      // Only a tick this pay set is taken back by its Undo or a failure.
      const tick = quick.settlesRow && !row.item.is_checked;
      const base = { accountIds: quick.accountIds, borrowerId, paymentDate };
      let toastId: string | number | undefined;

      const undo = async () => {
        // Never let the reset race the pay it takes back.
        if ((await paid) === "failed") return;
        const undone = await recordPayments({
          ...base,
          plan: quick.undo,
          onApplied: () => {
            if (tick) setChecked([itemId], false);
          },
          onFailed: () => {
            if (tick) setChecked([itemId], true);
          },
        });
        // The reset deletes every payment on the installment; put back what
        // was there before this pay, after the reset has gone through.
        if (undone !== "failed" && quick.restore.payments.length > 0) {
          await recordPayments({ ...base, plan: quick.restore });
        }
      };

      const paid = recordPayments({
        ...base,
        plan: quick.pay,
        onApplied: () => {
          if (tick) setChecked([itemId], true);
          toastId = toast(message(peso(quick.amount)), {
            duration: PAY_TOAST_MS,
            action: { label: "Undo", onClick: () => void undo() },
          });
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
