import type { RecordPaymentsInput } from "@/components/dashboard/checklist/use-record-payments";
import type { PaymentPlan } from "@/lib/checklist/payment-plan";
import { isEmptyPlan } from "@/lib/checklist/payment-reset";

type RecordPayments = (
  input: RecordPaymentsInput,
) => Promise<"saved" | "queued" | "failed">;

export type PaymentStep = {
  plan: PaymentPlan;
  /** null: no error toast, the caller reports the refusal itself. */
  failureMessage?: string | null;
  onApplied?(): void;
  onFailed?(): void;
  /** Once the step is saved or queued, before the next one starts. */
  onDone?(): void;
};

/**
 * Records plans one after the other, each only once the one before it is
 * saved or queued: the server's reset deletes every payment on an
 * installment, so an amount recorded on top of it must come after it (Undo
 * of a pay, lowering a recorded payment). Empty plans are skipped. Stops at
 * the first refusal and returns its index (null when every step went
 * through); that step's `failureMessage` is the error the owner sees.
 */
export async function recordInSteps(
  recordPayments: RecordPayments,
  base: Pick<RecordPaymentsInput, "accountIds" | "borrowerId" | "paymentDate">,
  steps: PaymentStep[],
): Promise<{ failedAt: number | null }> {
  for (const [index, step] of steps.entries()) {
    if (isEmptyPlan(step.plan)) continue;
    const { plan, failureMessage, onApplied, onFailed, onDone } = step;
    const result = await recordPayments({
      ...base,
      plan,
      failureMessage,
      onApplied,
      onFailed,
    });
    if (result === "failed") return { failedAt: index };
    onDone?.();
  }
  return { failedAt: null };
}
