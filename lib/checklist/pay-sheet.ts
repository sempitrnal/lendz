import {
  buildPaymentPlan,
  type PaymentPlan,
  type ScheduleChoice,
} from "@/lib/checklist/payment-plan";
import type { ScheduleDialogRow } from "@/lib/checklist/schedule-cache";
import { remainingOnInstallment } from "@/lib/payment-schedule/schedule-balances";
import { cents, parseAmountInput } from "@/lib/checklist/amount-input";
import {
  buildResetAndRestore,
  planCallCount,
} from "@/lib/checklist/payment-reset";

/** Same shape as the payment dialogs' `PendingPayment` (the header's input). */
export type AccountPending = {
  paidAmount: number;
  partialAmount: number;
  installments: number;
  undoAmount: number;
  undoInstallments: number;
};

export type PaySheetInput = {
  /** Live (or, offline, saved) rows of the item's linked installments. */
  rows: ScheduleDialogRow[];
  /** Every installment the item links, in label order. */
  lineIds: string[];
  /** Installments left ticked; a missing entry counts as ticked. */
  picked: Record<string, boolean>;
  /** "Pay a different amount": the typed amounts apply to every installment. */
  custom: boolean;
  /** One installment's own "Partial": overrides `custom` for that row. */
  customRows?: Record<string, boolean>;
  amounts: Record<string, string>;
  overdueCutoff: string;
};

export type PaySheetPlan = {
  /** The open installments, in label order. */
  open: ScheduleDialogRow[];
  choices: Record<string, ScheduleChoice>;
  plan: PaymentPlan;
  /** What the button records. */
  total: number;
  /** Ticked rows whose typed amount can't be read. */
  invalidIds: string[];
  /** Ticked rows whose typed amount is more than what is left (clamped). */
  clampedIds: string[];
  /** Every linked installment is paid once this lands. */
  settlesRow: boolean;
  accountIds: string[];
  pendingByAccount: Record<string, AccountPending>;
  /** Undo: reset what this pays on, then put back what was on it before. */
  undo: { reset: PaymentPlan; restore: PaymentPlan };
  /** How many server calls the pay makes. */
  calls: number;
  /** A ticked installment pays a typed amount. */
  custom: boolean;
  /** Installments left ticked. */
  tickedCount: number;
};

/** Whether an installment pays a typed amount: its own "Partial" wins over
 * the sheet-wide "Pay a different amount". */
export const isCustomRow = (
  id: string,
  custom: boolean,
  customRows?: Record<string, boolean>,
) => customRows?.[id] ?? custom;

/**
 * The pay sheet's choices: a ticked installment is paid in full, or with
 * "Pay a different amount" by its typed amount (a partial, clamped to what is
 * left; the full amount or more counts as paid). Unticked, blank, zero or
 * unreadable amounts pay nothing.
 */
export function buildPaySheet({
  rows,
  lineIds,
  picked,
  custom,
  customRows,
  amounts,
  overdueCutoff,
}: PaySheetInput): PaySheetPlan {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const open = [...new Set(lineIds)]
    .map((id) => byId.get(id))
    .filter((r): r is ScheduleDialogRow => !!r && r.status !== "paid")
    .filter((r) => cents(remainingOnInstallment(r)) > 0);

  const choices: Record<string, ScheduleChoice> = {};
  const invalidIds: string[] = [];
  const clampedIds: string[] = [];
  for (const row of open) {
    if (picked[row.id] === false) continue;
    if (!isCustomRow(row.id, custom, customRows)) {
      choices[row.id] = { status: "paid", amount: "" };
      continue;
    }
    const typed = parseAmountInput(amounts[row.id] ?? "");
    if (typed === null) {
      if ((amounts[row.id] ?? "").trim() !== "") invalidIds.push(row.id);
      continue;
    }
    const amount = cents(typed);
    // Both sides in centavos: `due - paid` carries float noise (113.37 -
    // 14.63 is 98.74000000000001), and the prefilled 98.74 must still count
    // as the whole rest, a `paid` choice, or the installment stays partial.
    const left = cents(remainingOnInstallment(row));
    if (amount > left) clampedIds.push(row.id);
    if (amount <= 0) continue;
    choices[row.id] =
      amount >= left
        ? { status: "paid", amount: "" }
        : { status: "partial", amount: String(amount) };
  }

  const plan = buildPaymentPlan(open, choices, overdueCutoff);
  const paying = new Map(plan.payments.map((p) => [p.scheduleId, p.amount]));
  const paidIds = new Set(plan.paidIds);

  const pendingByAccount: Record<string, AccountPending> = {};
  for (const row of open) {
    const amount = paying.get(row.id);
    if (amount === undefined) continue;
    const p = (pendingByAccount[row.account_id] ??= {
      paidAmount: 0,
      partialAmount: 0,
      installments: 0,
      undoAmount: 0,
      undoInstallments: 0,
    });
    if (paidIds.has(row.id)) {
      p.paidAmount = cents(p.paidAmount + amount);
      p.installments += 1;
    } else {
      p.partialAmount = cents(p.partialAmount + amount);
    }
  }

  const paidRows = open.filter((r) => paying.has(r.id));
  return {
    open,
    choices,
    plan,
    total: cents(plan.payments.reduce((sum, p) => sum + p.amount, 0)),
    invalidIds,
    clampedIds,
    settlesRow:
      lineIds.length > 0 &&
      lineIds.every((id) => {
        if (paidIds.has(id)) return true;
        const row = byId.get(id);
        // An installment that couldn't be loaded is never assumed paid.
        return !!row && row.status === "paid";
      }),
    accountIds: [...new Set(paidRows.map((r) => r.account_id))],
    pendingByAccount,
    undo: buildResetAndRestore(paidRows, overdueCutoff),
    calls: planCallCount(plan),
    custom: open.some(
      (r) => picked[r.id] !== false && isCustomRow(r.id, custom, customRows),
    ),
    tickedCount: open.filter((r) => picked[r.id] !== false).length,
  };
}

/** The pay sheet's primary button. */
export function payButtonLabel(
  pay: Pick<PaySheetPlan, "total" | "invalidIds" | "custom" | "tickedCount">,
  peso: (n: number) => string,
): string {
  if (pay.invalidIds.length > 0) return "Check the amounts";
  if (pay.total > 0) return `Record ${peso(pay.total)} paid`;
  // Ticked, but the typed amounts are blank or zero.
  return pay.custom && pay.tickedCount > 0
    ? "Enter an amount"
    : "Pick an installment";
}

/**
 * The error after a refused pay. One call either landed or didn't; with
 * several, some may have gone through.
 */
export function payFailureMessage(calls: number): string | undefined {
  return calls > 1
    ? "Couldn't save all of the payment — check what is recorded"
    : undefined; // useRecordPayments' default: it has been undone
}
