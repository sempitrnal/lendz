import {
  buildPaymentPlan,
  type PaymentPlan,
  type ScheduleChoice,
} from "@/lib/checklist/payment-plan";
import type { ScheduleDialogRow } from "@/lib/checklist/schedule-cache";
import { amountPaidOnInstallment } from "@/lib/payment-schedule/schedule-balances";
import { cents, parseAmountInput } from "@/lib/checklist/amount-input";
import {
  buildResetAndRestore,
  planCallCount,
  planOnReset,
} from "@/lib/checklist/payment-reset";

/** An installment with money recorded on it: a card in the edit sheet. */
export type RecordedCard = {
  row: ScheduleDialogRow;
  /** What is recorded on it now. */
  recorded: number;
  /** The whole installment. */
  due: number;
};

/** The installments of `lineIds` (label order) with money recorded. */
export function recordedCards(
  rows: ScheduleDialogRow[],
  lineIds: string[],
): RecordedCard[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return [...new Set(lineIds)]
    .map((id) => byId.get(id))
    .filter((r): r is ScheduleDialogRow => !!r)
    .map((row) => ({
      row,
      recorded: cents(amountPaidOnInstallment(row)),
      due: cents(Math.max(0, Number(row.amount_due ?? 0))),
    }))
    .filter((c) => c.row.status === "paid" || c.recorded > 0);
}

/** A card's new amount: typed, clamped to 0..due; null when unreadable. */
export function cardTarget(card: RecordedCard, typed: string): number | null {
  const value = parseAmountInput(typed);
  if (value === null) return null;
  return cents(Math.min(card.due, Math.max(0, value)));
}

export type EditPlan = {
  /** Every amount reads as a number. */
  valid: boolean;
  /** Some card's amount differs from what is recorded. */
  changed: boolean;
  /** What will be recorded across the cards after saving. */
  total: number;
  /** Everything goes to zero ("Remove payment"). */
  removesAll: boolean;
  /**
   * Saving. `first` resets every lowered installment and adds to every
   * raised one; `then` (only after `first` is saved or queued) records the
   * new, lower amount on each reset installment that keeps some.
   */
  first: PaymentPlan;
  then: PaymentPlan;
  /** What `first` takes off the lowered installments. */
  removed: number;
  /** What `then` puts back on them. */
  readded: number;
  /** Undo: reset the changed installments, then put back what they had. */
  undo: { reset: PaymentPlan; restore: PaymentPlan };
  accountIds: string[];
};

/**
 * Turns the edit sheet's amounts into the writes to make. A raised amount is
 * added on top (paid in full when it reaches the whole installment); a
 * lowered one is a reset followed by the new amount, since the server can
 * only delete every payment on an installment.
 */
export function buildEditPlan(
  cards: RecordedCard[],
  amounts: Record<string, string>,
  overdueCutoff: string,
): EditPlan {
  let valid = true;
  let total = 0;
  const changedRows: ScheduleDialogRow[] = [];
  const lowered: ScheduleDialogRow[] = [];
  const keep: Record<string, number> = {};
  const firstChoices: Record<string, ScheduleChoice> = {};
  let removed = 0;
  let readded = 0;

  for (const card of cards) {
    const target = cardTarget(card, amounts[card.row.id] ?? "");
    if (target === null) {
      valid = false;
      total += card.recorded;
      continue;
    }
    total += target;
    if (target === card.recorded) continue;
    changedRows.push(card.row);
    // A raise adds on top, unless the installment is already marked paid
    // (nothing can be added to it): then it is reset like a lowered one.
    if (target > card.recorded && card.row.status !== "paid") {
      firstChoices[card.row.id] =
        target >= card.due
          ? { status: "paid", amount: "" }
          : {
              status: "partial",
              amount: String(cents(target - card.recorded)),
            };
      continue;
    }
    firstChoices[card.row.id] = { status: "undo", amount: "" };
    lowered.push(card.row);
    removed += card.recorded;
    if (target > 0) {
      keep[card.row.id] = target;
      readded += target;
    }
  }

  const first = buildPaymentPlan(
    cards.map((c) => c.row),
    firstChoices,
    overdueCutoff,
  );
  total = cents(total);
  return {
    valid,
    changed: changedRows.length > 0,
    total,
    removesAll: valid && cards.length > 0 && total === 0,
    first,
    then: planOnReset(lowered, keep, overdueCutoff),
    removed: cents(removed),
    readded: cents(readded),
    undo: buildResetAndRestore(changedRows, overdueCutoff),
    accountIds: [...new Set(changedRows.map((r) => r.account_id))],
  };
}

/** The edit sheet's button; it is enabled only when it reads "Save…" or "Remove payment". */
export function editButtonLabel(
  edit: Pick<EditPlan, "valid" | "changed" | "removesAll" | "total">,
  peso: (n: number) => string,
): string {
  if (!edit.valid) return "Check the amounts";
  if (!edit.changed) return "Change an amount to save";
  return edit.removesAll ? "Remove payment" : `Save · ${peso(edit.total)} paid`;
}

export const canSaveEdit = (edit: Pick<EditPlan, "valid" | "changed">) =>
  edit.valid && edit.changed;

/** The error toasts for a refused save, saying what happened to the money. */
export function editFailureMessages(
  edit: Pick<EditPlan, "first" | "then" | "removed" | "readded">,
  peso: (n: number) => string,
): { first: string; then: string } {
  return {
    first:
      planCallCount(edit.first) > 1
        ? "Couldn't save all the changes — check the recorded payments"
        : "Couldn't save the changes — nothing was changed",
    then:
      planCallCount(edit.then) > 1
        ? `The earlier ${peso(edit.removed)} was removed but some of the new ${peso(
            edit.readded,
          )} couldn't be recorded — check and re-enter it`
        : `The earlier ${peso(edit.removed)} was removed but the new ${peso(
            edit.readded,
          )} couldn't be recorded — re-enter ${peso(edit.readded)}`,
  };
}

/** The error toasts for a refused Undo of an edit. */
export function editUndoFailureMessages(
  edit: Pick<EditPlan, "undo">,
  peso: (n: number) => string,
): { reset: string; restore: string } {
  const restored = cents(
    edit.undo.restore.payments.reduce((sum, p) => sum + p.amount, 0),
  );
  return {
    reset:
      planCallCount(edit.undo.reset) > 1
        ? "Couldn't undo all the changes — check the recorded payments"
        : "Couldn't undo — the change is still saved",
    restore: `Couldn't put back the earlier ${peso(restored)} — re-enter it`,
  };
}
