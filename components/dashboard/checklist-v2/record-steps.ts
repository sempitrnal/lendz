import { toast } from "sonner";
import type { RecordPaymentsInput } from "@/components/dashboard/checklist/use-record-payments";
import type { PaymentPlan } from "@/lib/checklist/payment-plan";
import { isEmptyPlan } from "@/lib/checklist/payment-reset";
import { fetchSchedules } from "@/lib/checklist/schedule-cache";
import {
  needsStepGuard,
  refuseWhileSyncing,
  resetTookEffect,
  resetUnconfirmedMessage,
  STILL_SYNCING,
} from "@/lib/checklist/step-guard";
import { isConnectionGood } from "@/lib/offline/connection";
import { getPendingOutboxCount } from "@/lib/offline/outbox";
import { peso } from "@/components/dashboard/checklist-v2/header";

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

export type StepsResult = {
  /** The step that was refused or held back; null when every step went through. */
  failedAt: number | null;
  /**
   * Why a step was held back without being sent:
   * - "syncing": online with offline changes still waiting (only before the
   *   first write; nothing was written and the caller may offer it again).
   * - "unconfirmed": the reset before it can't be confirmed live, so it
   *   wasn't sent; the reset may not have happened (the money may still be
   *   recorded).
   */
  heldBack?: "syncing" | "unconfirmed";
};

export type StepsOptions = {
  /** Once the guards pass, just before the first write. */
  onStart?(): void;
  /** Which words the "couldn't confirm the reset" message uses. */
  action?: "undo" | "save";
};

async function pendingOutbox(): Promise<number> {
  try {
    return await getPendingOutboxCount();
  } catch {
    return 0;
  }
}

/**
 * Records plans one after the other, each only once the one before it is
 * saved or queued: the server's reset deletes every payment on an
 * installment, so an amount recorded on top of it must come after it (Undo
 * of a pay, lowering a recorded payment). Empty plans are skipped. Stops at
 * the first refusal and returns its index (null when every step went
 * through); that step's `failureMessage` is the error the owner sees.
 *
 * Runs that reset or have several writes are guarded:
 * - Online with offline changes still waiting, nothing is sent (they would
 *   overtake the queued ones): "Still syncing…" and `heldBack: "syncing"`.
 *   Should that happen before a later step, that step is refused with its
 *   own message.
 * - After a reset that saved, the installments are re-read live before the
 *   next step; unless they read as reset, nothing more is sent and the
 *   owner is told to check (`heldBack: "unconfirmed"`). Offline (queued)
 *   there is nothing to re-read: the steps replay in order.
 */
export async function recordInSteps(
  recordPayments: RecordPayments,
  base: Pick<RecordPaymentsInput, "accountIds" | "borrowerId" | "paymentDate">,
  steps: PaymentStep[],
  options: StepsOptions = {},
): Promise<StepsResult> {
  const guarded = needsStepGuard(steps.map((s) => s.plan));
  let started = false;
  /** Installments the last step reset and the server says it saved. */
  let toVerify: string[] = [];

  for (const [index, step] of steps.entries()) {
    if (isEmptyPlan(step.plan)) continue;
    const { plan, failureMessage, onApplied, onFailed, onDone } = step;
    const notify = (message: string) => {
      if (failureMessage !== null) toast.error(message);
    };

    if (guarded) {
      const syncing = refuseWhileSyncing({
        connectionGood: isConnectionGood(),
        pending: await pendingOutbox(),
      });
      if (syncing && !started) {
        toast(STILL_SYNCING);
        return { failedAt: index, heldBack: "syncing" };
      }
      if (syncing) {
        onFailed?.();
        notify(failureMessage ?? STILL_SYNCING);
        return { failedAt: index };
      }
    }

    if (toVerify.length > 0) {
      let stillRecorded: number | null = null;
      let ok = false;
      try {
        const check = resetTookEffect(await fetchSchedules(toVerify), toVerify);
        ok = check.ok;
        stillRecorded = check.stillRecorded;
      } catch {
        // Couldn't re-read: can't confirm.
      }
      if (!ok) {
        onFailed?.();
        notify(
          resetUnconfirmedMessage(
            stillRecorded,
            options.action ?? "undo",
            peso,
          ),
        );
        return { failedAt: index, heldBack: "unconfirmed" };
      }
    }

    if (!started) {
      started = true;
      options.onStart?.();
    }
    const result = await recordPayments({
      ...base,
      plan,
      failureMessage,
      onApplied,
      onFailed,
    });
    if (result === "failed") return { failedAt: index };
    toVerify =
      result === "saved" ? plan.undoCalls.map((c) => c.scheduleId) : [];
    onDone?.();
  }
  return { failedAt: null };
}

/**
 * A toast's Undo button for a guarded run: the toast stays up until the run
 * actually starts (a "Still syncing" refusal leaves it, so Undo can be tapped
 * again), and a second tap while one is running does nothing.
 */
export function undoAction(
  run: (onStart: () => void) => Promise<StepsResult | void>,
  dismiss: () => void,
) {
  let busy = false;
  let done = false;
  return {
    label: "Undo",
    onClick: (event: { preventDefault(): void }) => {
      event.preventDefault();
      if (busy || done) return;
      busy = true;
      const start = () => {
        if (done) return;
        done = true;
        dismiss();
      };
      void run(start)
        .then((result) => {
          if (result?.heldBack === "syncing") return;
          // Ran (or had nothing to run): the toast goes either way.
          start();
        })
        .catch(() => {})
        .finally(() => {
          busy = false;
        });
    },
  };
}
