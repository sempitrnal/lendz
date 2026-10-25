import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  markSchedulesPaidAction,
  applyPartialPaymentAction,
  updateScheduleStatusAction,
} from "@/lib/actions/schedules";
import {
  actionWasQueued,
  applyPaymentsToCache,
  readCachedSchedules,
  refreshCachedAccounts,
  undoPaymentsInCache,
} from "@/lib/checklist/schedule-cache";
import { celebrate } from "@/lib/checklist/celebrate";
import { profitGained } from "@/lib/checklist/profit";
import type { PaymentPlan } from "@/lib/checklist/payment-plan";
import { getPendingOutboxCount } from "@/lib/offline/outbox";
import { useInvalidateBorrowerDetails } from "@/lib/hooks/use-borrower-details";

export const ACCOUNT_SUMMARIES_KEY = "checklist-account-summaries";

export type RecordPaymentsInput = {
  plan: PaymentPlan;
  accountIds: string[];
  borrowerId: string | null;
  paymentDate: string;
  /**
   * Celebrate ("+₱500!" and a cha-ching) when this earns profit. Only for a
   * real payment: an Undo or an edit also records payments and must stay quiet.
   */
  celebrateProfit?: boolean;
  /** After the local result shows, before the server answers. */
  onApplied?: () => void;
  /** After a refusal, once the local result is put back. */
  onFailed?: () => void;
  /**
   * The error toast after a refusal; defaults to the payment one. null shows
   * none: the caller reports the outcome itself (a bulk Undo sums them up).
   */
  failureMessage?: string | null;
};

const DEFAULT_FAILURE_MESSAGE =
  "Couldn't save the payment — it has been undone";

/**
 * Records a payment plan: shows the result locally at once, then makes the
 * server calls. Returns "queued" when the service worker held the calls for
 * later, and "failed" after undoing the local result. Shows no success toast.
 */
export function useRecordPayments() {
  const queryClient = useQueryClient();
  const invalidateBorrowerDetails = useInvalidateBorrowerDetails();

  return async ({
    plan,
    accountIds,
    borrowerId,
    paymentDate,
    celebrateProfit = false,
    onApplied,
    onFailed,
    failureMessage = DEFAULT_FAILURE_MESSAGE,
  }: RecordPaymentsInput): Promise<"saved" | "queued" | "failed"> => {
    const queuedBefore = await getPendingOutboxCount();

    // Show the result now. Line statuses read the saved schedules, so those are
    // updated here; the server catches up below, and a failure puts both back.
    // What this earns, read before the saved copy changes.
    const gained = celebrateProfit
      ? profitGained(
          plan.payments,
          new Map(
            readCachedSchedules(plan.payments.map((p) => p.scheduleId)).map(
              (r) => [r.id, r],
            ),
          ),
        )
      : 0;
    undoPaymentsInCache(plan.undoCalls.map((c) => c.scheduleId));
    applyPaymentsToCache(plan.payments);
    onApplied?.();
    // Only partial choices (nothing marked paid) get the partial sound.
    celebrate(
      gained,
      undefined,
      celebrateProfit && plan.partials.length > 0 && plan.paidIds.length === 0,
    );

    try {
      await Promise.all([
        plan.paidIds.length > 0
          ? markSchedulesPaidAction(plan.paidIds, paymentDate)
          : Promise.resolve(),
        ...plan.partials.map(async ({ id, amount }) => {
          const fd = new FormData();
          fd.set("scheduleId", id);
          fd.set("paymentAmount", String(amount));
          fd.set("paymentDate", paymentDate);
          await applyPartialPaymentAction(fd);
        }),
        ...plan.undoCalls.map(({ accountId, scheduleId, status }) => {
          const fd = new FormData();
          fd.set("scheduleId", scheduleId);
          fd.set("status", status);
          return updateScheduleStatusAction(accountId, fd);
        }),
      ]);
      // Re-download so the saved copy matches what the server recorded.
      void refreshCachedAccounts(accountIds).catch(() => {});
      if (borrowerId) invalidateBorrowerDetails(borrowerId);
      queryClient.invalidateQueries({ queryKey: [ACCOUNT_SUMMARIES_KEY] });
      queryClient.invalidateQueries({ queryKey: ["checklist-month-profit"] });
      return "saved";
    } catch (err) {
      if (await actionWasQueued(queuedBefore)) {
        // The service worker queued the action calls; they sync later and the
        // local result stands.
        queryClient.invalidateQueries({ queryKey: [ACCOUNT_SUMMARIES_KEY] });
        return "queued";
      }
      console.error("useRecordPayments error:", err);
      // Put the saved numbers back to what the server has.
      void refreshCachedAccounts(accountIds).catch(() => {});
      queryClient.invalidateQueries({ queryKey: [ACCOUNT_SUMMARIES_KEY] });
      queryClient.invalidateQueries({ queryKey: ["checklist-month-profit"] });
      onFailed?.();
      if (failureMessage !== null) toast.error(failureMessage);
      return "failed";
    }
  };
}
