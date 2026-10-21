import {
  buildPaymentPlan,
  type PaymentPlan,
  type ScheduleChoice,
} from "@/lib/checklist/payment-plan";
import { buildResetAndRestore } from "@/lib/checklist/payment-reset";
import { cents } from "@/lib/checklist/amount-input";
import { rowDisplayName } from "@/lib/checklist/row-name";
import type { RowView } from "@/lib/checklist/row-state";
import type { ScheduleDialogRow } from "@/lib/checklist/schedule-cache";
import { amountPaidOnInstallment } from "@/lib/payment-schedule/schedule-balances";

const peso = (n: number) =>
  `₱${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

/**
 * The rows "Mark all paid" is for: every unticked collection row (linked to
 * schedules), as in the old `BulkPaidDialog`. Rows already fully paid are
 * included so they get ticked (no payment is written for them). Ticked rows
 * are left alone: a row ticked without its payments recorded was ticked on
 * purpose, and paying it in bulk would record money the owner chose not to.
 */
export function bulkPaidRows(rows: RowView[]): RowView[] {
  return rows.filter(
    (r) => !r.item.is_checked && r.model !== null && r.lines.length > 0,
  );
}

/** Every schedule linked from `rows`, once each. */
export function bulkScheduleIds(rows: RowView[]): string[] {
  return [...new Set(rows.flatMap((r) => r.lines.map((l) => l.id)))];
}

/** One installment the bulk pay marks paid, and how its Undo takes it back. */
export type BulkUndoTarget = {
  scheduleId: string;
  accountId: string;
  borrowerId: string | null;
  /** The rows that list it (normally one). */
  itemIds: string[];
  /** Whose it is, for the error toasts. */
  name: string;
  /** Resets it (deletes every payment on it, the earlier ones too). */
  reset: PaymentPlan;
  /** Run after `reset`: re-records what was paid on it before. */
  restore: PaymentPlan;
  /** What `restore` puts back. */
  restoreAmount: number;
};

export type BulkPaid = {
  /** Linked schedules that couldn't be loaded; nothing may be marked then. */
  missing: string[];
  /** One call: every open installment marked paid. */
  plan: PaymentPlan;
  accountIds: string[];
  borrowerIds: string[];
  /**
   * Unticked rows fully paid once this pay lands (rows already fully paid
   * included): the ones it ticks, and the only ones Undo unticks.
   */
  tickIds: string[];
  targets: BulkUndoTarget[];
  summary: {
    borrowers: number;
    collections: number;
    alreadyPaid: number;
    total: number;
  };
};

/**
 * Works out "Mark all paid" for `rows` (see `bulkPaidRows`) from `schedules`,
 * which should be the live rows: what to mark, the summary the sheet shows
 * (the old `BulkPaidDialog`'s numbers), which items it ticks and how Undo
 * takes each installment back. A schedule linked from two rows counts once.
 */
export function buildBulkPaid(
  rows: RowView[],
  schedules: ScheduleDialogRow[],
  overdueCutoff: string,
): BulkPaid {
  const byId = new Map(schedules.map((s) => [s.id, s]));
  const missing = new Set<string>();
  const itemsBySchedule = new Map<string, string[]>();
  const rowBySchedule = new Map<string, RowView>();
  const open: ScheduleDialogRow[] = [];
  let alreadyPaid = 0;

  for (const row of rows) {
    for (const line of row.lines) {
      const s = byId.get(line.id);
      if (!s) {
        missing.add(line.id);
        continue;
      }
      const listed = itemsBySchedule.get(s.id);
      if (listed) {
        if (!listed.includes(row.item.id)) listed.push(row.item.id);
        continue;
      }
      itemsBySchedule.set(s.id, [row.item.id]);
      rowBySchedule.set(s.id, row);
      if (s.status === "paid") alreadyPaid += 1;
      else open.push(s);
    }
  }

  const plan = buildPaymentPlan(
    open,
    Object.fromEntries(
      open.map((s) => [s.id, { status: "paid", amount: "" } as ScheduleChoice]),
    ),
    overdueCutoff,
  );
  const paidNow = new Set(plan.paidIds);
  const paying = rows.filter((r) => r.lines.some((l) => paidNow.has(l.id)));

  const targets: BulkUndoTarget[] = open
    .filter((s) => paidNow.has(s.id))
    .map((s) => {
      const row = rowBySchedule.get(s.id)!;
      const { reset, restore } = buildResetAndRestore([s], overdueCutoff);
      return {
        scheduleId: s.id,
        accountId: s.account_id,
        borrowerId: row.model?.borrower?.id ?? null,
        itemIds: itemsBySchedule.get(s.id) ?? [],
        name: rowDisplayName(row),
        reset,
        restore,
        restoreAmount: cents(amountPaidOnInstallment(s)),
      };
    });

  return {
    missing: [...missing],
    plan,
    accountIds: [...new Set(open.map((s) => s.account_id))],
    borrowerIds: [
      ...new Set(paying.flatMap((r) => r.model?.borrower?.id ?? [])),
    ],
    tickIds: rows
      .filter(
        (r) =>
          !r.item.is_checked &&
          r.lines.every(
            (l) => paidNow.has(l.id) || byId.get(l.id)?.status === "paid",
          ),
      )
      .map((r) => r.item.id),
    targets,
    summary: {
      // Every row, as the old dialog counted (its borrowers, or the item).
      borrowers: new Set(rows.map((r) => r.model?.borrower?.id ?? r.item.id))
        .size,
      collections: plan.paidIds.length,
      alreadyPaid,
      total: cents(plan.payments.reduce((sum, p) => sum + p.amount, 0)),
    },
  };
}

/**
 * The error toast when the bulk pay is refused. One installment is one write
 * the server takes back whole (useRecordPayments' default says so); several
 * may partly land, so the toast says to check.
 */
export function bulkPayFailureText(collections: number): string | undefined {
  return collections > 1
    ? "Couldn't mark them all paid — check what is recorded"
    : undefined;
}

/** How one installment's Undo went: `recordInSteps`' failed step, or null. */
export type BulkUndoResult = {
  target: BulkUndoTarget;
  /** 0: the reset was refused; 1: the restore was; null: both went through. */
  failedAt: number | null;
};

function nameList(names: string[]): string {
  const unique = [...new Set(names)];
  if (unique.length <= 3) return unique.join(", ");
  return `${unique.slice(0, 3).join(", ")} and ${unique.length - 3} more`;
}

/**
 * Sums up a bulk Undo, run one installment at a time so each outcome is
 * known: which items to untick and the error toasts, in the words of the
 * one-row Undo. Only items the pay ticked (`tickedIds`) are unticked: those
 * with an installment it paid once at least one of their resets went
 * through; those it only ticked (already fully paid, nothing paid now)
 * always, since there is no payment of this action to take back.
 */
export function bulkUndoOutcome(
  results: BulkUndoResult[],
  tickedIds: string[],
): { untickIds: string[]; errors: string[] } {
  const ticked = new Set(tickedIds);
  const untick = new Set<string>();
  const paidFor = new Set(results.flatMap((r) => r.target.itemIds));
  for (const id of tickedIds) if (!paidFor.has(id)) untick.add(id);
  for (const { target, failedAt } of results) {
    if (failedAt === 0) continue;
    for (const id of target.itemIds) if (ticked.has(id)) untick.add(id);
  }

  const errors: string[] = [];
  const stillPaid = results.filter((r) => r.failedAt === 0);
  if (stillPaid.length > 0) {
    errors.push(
      results.length === 1
        ? "Couldn't undo — the payment is still recorded"
        : stillPaid.length === results.length
          ? "Couldn't undo — the payments are still recorded"
          : `Couldn't undo ${stillPaid.length} of ${results.length} collections — still recorded for ${nameList(
              stillPaid.map((r) => r.target.name),
            )}`,
    );
  }
  const notRestored = results.filter((r) => r.failedAt === 1);
  if (notRestored.length > 0) {
    const sum = cents(
      notRestored.reduce((s, r) => s + r.target.restoreAmount, 0),
    );
    const names = nameList(notRestored.map((r) => r.target.name));
    errors.push(
      results.length === 1
        ? `Couldn't put back the earlier ${peso(sum)} payment — re-enter it`
        : notRestored.length === 1
          ? `Couldn't put back the earlier ${peso(sum)} payment for ${names} — re-enter it`
          : `Couldn't put back ${notRestored.length} earlier payments (${peso(sum)}) for ${names} — re-enter them`,
    );
  }
  return { untickIds: [...untick], errors };
}
