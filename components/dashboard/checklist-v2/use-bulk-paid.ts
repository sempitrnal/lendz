"use client";

import { useRef } from "react";
import { toast } from "sonner";
import { useRecordPayments } from "@/components/dashboard/checklist/use-record-payments";
import { useInvalidateBorrowerDetails } from "@/lib/hooks/use-borrower-details";
import { recordInSteps } from "@/components/dashboard/checklist-v2/record-steps";
import {
  bulkPayFailureText,
  bulkUndoOutcome,
  type BulkPaid,
  type BulkUndoResult,
} from "@/lib/checklist/bulk-paid";
import { markedPaidText, QUEUED_SUFFIX } from "@/lib/checklist/list-menu";
import { todayDateValue } from "@/lib/checklist/dates";

/** The mark all paid toast and its Undo (Global Constraints: 6000 ms). */
const BULK_TOAST_MS = 6000;

type Outcome = "saved" | "queued" | "failed";

/**
 * "Mark all paid": marks every open installment of the bulk sheet paid in
 * one call (the old `BulkPaidDialog`'s `markSchedulesPaidAction`, with the
 * same cache updates through `useRecordPayments`), ticks the rows it settles
 * and shows a toast with Undo.
 *
 * Undo takes back one installment at a time, like the one-row Undo: reset
 * (which deletes every payment on it), then re-record any earlier part
 * payment, dated today. Run that way each outcome is known, so the toasts can
 * say exactly what is still recorded and nothing is unticked that is still
 * paid.
 */
export function useBulkPaid(
  setChecked: (ids: string[], checked: boolean) => void,
) {
  const recordPayments = useRecordPayments();
  const invalidateBorrowerDetails = useInvalidateBorrowerDetails();
  /** A pay under way: a second confirm does nothing. */
  const busy = useRef(false);

  return async (bulk: BulkPaid, paymentDate: string) => {
    const count = bulk.plan.paidIds.length;
    if (busy.current || count === 0 || bulk.missing.length > 0) return;
    if (!paymentDate) return;
    busy.current = true;
    try {
      const tickIds = bulk.tickIds;
      const toastId = `bulk-paid-${Date.now()}`;
      /** The pay's server result; set before any toast (and Undo) shows. */
      let paid: Promise<Outcome> | null = null;
      let undone = false;

      const undo = async () => {
        // Once only, and never ahead of the pay it takes back.
        if (undone || !paid) return;
        undone = true;
        if ((await paid) === "failed") return;
        const today = todayDateValue();
        // One after the other: server actions run one at a time anyway, and
        // the offline check (did the outbox grow?) can't then mistake
        // another installment's queued write for this one's.
        const results: BulkUndoResult[] = [];
        const ticked = new Set(tickIds);
        const unticked = new Set<string>();
        for (const target of bulk.targets) {
          const { failedAt } = await recordInSteps(
            recordPayments,
            {
              accountIds: [target.accountId],
              borrowerId: target.borrowerId,
              paymentDate: today,
            },
            [
              // The toasts are summed up below.
              {
                plan: target.reset,
                failureMessage: null,
                // Reset: its rows are no longer fully paid. Only ticks this
                // pay set are taken back (the rule `bulkUndoOutcome` states).
                onDone: () => {
                  const ids = target.itemIds.filter(
                    (id) => ticked.has(id) && !unticked.has(id),
                  );
                  for (const id of ids) unticked.add(id);
                  if (ids.length > 0) setChecked(ids, false);
                },
              },
              { plan: target.restore, failureMessage: null },
            ],
          );
          results.push({ target, failedAt });
        }
        for (const error of bulkUndoOutcome(results, tickIds).errors) {
          toast.error(error);
        }
      };

      const showToast = (text: string) =>
        toast(text, {
          id: toastId,
          duration: BULK_TOAST_MS,
          action: { label: "Undo", onClick: () => void undo() },
        });

      paid = recordPayments({
        plan: bulk.plan,
        accountIds: bulk.accountIds,
        // Several borrowers: their pages are refreshed below.
        borrowerId: null,
        paymentDate,
        failureMessage: bulkPayFailureText(count),
        onApplied: () => {
          if (tickIds.length > 0) setChecked(tickIds, true);
          showToast(markedPaidText(count));
        },
        onFailed: () => {
          if (tickIds.length > 0) setChecked(tickIds, false);
          toast.dismiss(toastId);
        },
      });
      const outcome = await paid;
      if (outcome === "saved") {
        for (const id of bulk.borrowerIds) invalidateBorrowerDetails(id);
      } else if (outcome === "queued" && !undone) {
        // Not on the server yet: say so rather than claim it is recorded.
        showToast(`${markedPaidText(count)}${QUEUED_SUFFIX}`);
      }
    } finally {
      busy.current = false;
    }
  };
}
