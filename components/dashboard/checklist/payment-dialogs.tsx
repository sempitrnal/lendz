"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Undo2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProfitText } from "@/components/dashboard/checklist/profit-text";
import { installmentProfit } from "@/lib/checklist/profit";
import { Sheet, SheetFooter } from "@/components/dashboard/checklist-v2/sheet";
import { markSchedulesPaidAction } from "@/lib/actions/schedules";
import {
  amountPaidOnInstallment,
  remainingOnInstallment,
} from "@/lib/payment-schedule/schedule-balances";
import {
  applyPaymentsToCache,
  refreshCachedAccounts,
  actionWasQueued,
  loadAccountSummaries,
  loadSchedules,
  readCachedSchedules,
  readCachedSummaries,
  type AccountSummary,
  type ScheduleDialogRow,
} from "@/lib/checklist/schedule-cache";
import { getPendingOutboxCount } from "@/lib/offline/outbox";
import { useInvalidateBorrowerDetails } from "@/lib/hooks/use-borrower-details";
import {
  borrowerCategoryColor,
  NO_BORROWERS,
  extractBorrowerMention,
  extractScheduleRefs,
  formatShortDate,
} from "@/lib/checklist/labels";
import { overdueCutoffDateValue, todayDateValue } from "@/lib/checklist/dates";
import { useBorrowersSearch } from "@/hooks/use-borrowers-search";
import {
  ACCOUNT_SUMMARIES_KEY,
  useRecordPayments,
} from "@/components/dashboard/checklist/use-record-payments";
import {
  buildPaymentPlan,
  type ScheduleChoice,
} from "@/lib/checklist/payment-plan";
import type { DailyChecklistItem } from "@/lib/checklist/types";

/** A schedule with money on it, which the dialog lets you undo. */
const hasPayment = (row: ScheduleDialogRow) =>
  row.status === "paid" || amountPaidOnInstallment(row) > 0;

/** Each schedule is its own card; paid/part-paid ones get a soft glow. */
export const SCHEDULE_CARD = {
  plain: "border-slate-200 bg-white dark:border-border dark:bg-card",
  paid: "border-emerald-300/70 bg-emerald-50/80 shadow-[inset_0_0_18px_-6px_rgba(16,185,129,0.55)] dark:border-emerald-700/60 dark:bg-emerald-400/[0.07] dark:shadow-[inset_0_0_18px_-6px_rgba(52,211,153,0.45)]",
  partial:
    "border-violet-300/70 bg-violet-50/80 shadow-[inset_0_0_18px_-6px_rgba(139,92,246,0.5)] dark:border-violet-700/60 dark:bg-violet-400/[0.07] dark:shadow-[inset_0_0_18px_-6px_rgba(167,139,250,0.45)]",
  undo: "border-dashed border-orange-300 bg-orange-50/50 dark:border-orange-700 dark:bg-orange-400/[0.05]",
} as const;

type ScheduleState = "paid" | "partial" | "overdue" | "unpaid";

const STATE_LABEL: Record<ScheduleState, string> = {
  paid: "paid",
  partial: "partial",
  overdue: "overdue",
  unpaid: "unpaid",
};

export const ACTION_BUTTON =
  "cursor-pointer rounded-md border px-2 py-1.5 text-sm font-semibold lowercase transition";

export const PAID_TEXT = {
  paid: "font-semibold text-emerald-700 dark:text-emerald-300",
  partial: "font-semibold text-violet-700 dark:text-violet-300",
} as const;

/** Fade + rise used to stagger account cards and schedule rows in on open. */
export const ENTER_ANIMATION =
  "animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-300 ease-out motion-reduce:animate-none";

export type PendingPayment = {
  paidAmount: number;
  partialAmount: number;
  installments: number;
  /** Paid amounts that Undo would take back off the account. */
  undoAmount: number;
  /** Fully paid installments Undo would reopen. */
  undoInstallments: number;
};

/** What the selected Paid/Partial choices would add to an account. */
function pendingPayment(
  rows: ScheduleDialogRow[],
  choices: Record<string, ScheduleChoice>,
): PendingPayment {
  let paidAmount = 0;
  let partialAmount = 0;
  let installments = 0;
  let undoAmount = 0;
  let undoInstallments = 0;
  for (const row of rows) {
    const choice = choices[row.id];
    if (choice?.status === "undo") {
      undoAmount += amountPaidOnInstallment(row);
      if (row.status === "paid") undoInstallments += 1;
      continue;
    }
    if (!choice?.status || row.status === "paid") continue;
    const remaining = remainingOnInstallment(row);
    if (choice.status === "paid") {
      paidAmount += remaining;
      installments += 1;
      continue;
    }
    const entered = Number.parseFloat(choice.amount || "0");
    if (!Number.isFinite(entered) || entered <= 0) continue;
    const applied = Math.min(entered, remaining);
    partialAmount += applied;
    if (applied >= remaining) installments += 1;
  }
  return {
    paidAmount,
    partialAmount,
    installments,
    undoAmount,
    undoInstallments,
  };
}

export function AccountSummaryHeader({
  summary,
  pending,
}: {
  summary: AccountSummary;
  pending: PendingPayment;
}) {
  const total = summary.paid + summary.left;
  // Undo moves money from paid back to left before any new payment lands.
  const undone = Math.min(pending.undoAmount, summary.paid);
  const basePaid = summary.paid - undone;
  const baseLeft = summary.left + undone;
  const paidAdded = Math.min(pending.paidAmount, baseLeft);
  const partialAdded = Math.min(pending.partialAmount, baseLeft - paidAdded);
  const added = paidAdded + partialAdded;
  const changed = added > 0 || undone > 0;
  const paid = basePaid + added;
  const left = Math.max(0, baseLeft - added);
  const share = (amount: number) => (total > 0 ? (amount / total) * 100 : 0);
  const pct = Math.round(Math.min(100, share(paid)));
  const paidInstallments = Math.max(
    0,
    Math.min(
      summary.installmentCount,
      summary.paidInstallments +
        pending.installments -
        pending.undoInstallments,
    ),
  );
  // Start empty so the bar fills on open instead of appearing pre-filled.
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const width = (amount: number) => `${filled ? share(amount) : 0}%`;
  const highlight = !changed
    ? ""
    : added >= undone
      ? "font-semibold text-emerald-600 dark:text-emerald-400"
      : "font-semibold text-orange-600 dark:text-orange-400";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold lowercase
            ${
              summary.isCashAdvance
                ? `bg-yellow-400/30 text-yellow-800 dark:bg-yellow-400/15
                  dark:text-yellow-300`
                : "bg-violet-500/15 text-[#7354a0] dark:text-[#d9cfe6]"
            }`}
        >
          {summary.typeLabel}
        </span>
        {summary.installmentCount > 0 && (
          <span
            className={`text-xs font-bold tabular-nums transition-colors ${
              pending.undoInstallments > 0
                ? "text-orange-600 dark:text-orange-400"
                : pending.installments > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground"
            }`}
          >
            {paidInstallments} of {summary.installmentCount} paid
          </span>
        )}
      </div>
      <div
        className="flex h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${pct}% paid`}
      >
        <div
          className="h-full bg-emerald-500 transition-[width] duration-500"
          style={{ width: width(basePaid) }}
        />
        <div
          className="h-full bg-emerald-500/35 transition-[width] duration-300"
          style={{ width: width(paidAdded) }}
        />
        <div
          className="h-full bg-[#7f5ead]/45 transition-[width] duration-300"
          style={{ width: width(partialAdded) }}
        />
      </div>
      <div
        className="flex justify-between text-[11px] font-semibold
          text-muted-foreground tabular-nums"
      >
        <span>
          <span className={highlight}>₱{paid.toLocaleString()}</span> paid ·{" "}
          {pct}%
        </span>
        <span>
          <span className={highlight}>₱{left.toLocaleString()}</span> left
        </span>
      </div>
    </div>
  );
}

/**
 * Shown when checking off a checklist item that was inserted via `/next` —
 * lets the user mark the linked payment_schedules row(s) as paid/partial
 * before the item is actually checked. Schedules that already have payments
 * can be undone (reset to unpaid). With `mode="edit"` it is opened from an
 * already ticked item to undo or change what was recorded; saving leaves the
 * tick alone.
 */
export function ScheduleCheckDialog({
  item,
  mode = "check",
  variant = "dialog",
  lineIds,
  onClose,
  onConfirmed,
  onFailed,
}: {
  item: DailyChecklistItem | null;
  mode?: "check" | "edit";
  /** A centred dialog (the classic widget) or a bottom drawer (the mobile screen). */
  variant?: "dialog" | "drawer";
  /** Only these installments of the item (default: all it links). */
  lineIds?: string[];
  onClose: () => void;
  /**
   * Called as soon as the choices are applied locally, before the server
   * answers. `settlesAll`: every linked installment is paid once this lands.
   */
  onConfirmed: (result: { settlesAll: boolean }) => void;
  /** Called if the server then rejects them, to undo whatever onConfirmed did. */
  onFailed?: () => void;
}) {
  const [rows, setRows] = useState<ScheduleDialogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [choices, setChoices] = useState<Record<string, ScheduleChoice>>({});
  const [submitting, setSubmitting] = useState(false);
  const lineKey = lineIds?.join(",") ?? "";
  const refs = useMemo(
    () =>
      item
        ? extractScheduleRefs(item.label).filter(
            (r) => !lineKey || lineKey.split(",").includes(r.id),
          )
        : [],
    [item?.id, item?.label, lineKey],
  );
  const borrower = useMemo(
    () => (item ? extractBorrowerMention(item.label) : null),
    [item?.id, item?.label],
  );
  const borrowerName = borrower?.name;
  const { data: borrowers = NO_BORROWERS } = useBorrowersSearch();
  const borrowerColor = useMemo(
    () => borrowerCategoryColor(borrowers.find((b) => b.id === borrower?.id)),
    [borrowers, borrower?.id],
  );
  const recordPayments = useRecordPayments();
  const router = useRouter();
  const open = refs.length > 0;
  const scheduleIds = useMemo(() => refs.map((r) => r.id).sort(), [refs]);
  const { data: summaries, isPending: summariesPending } = useQuery({
    queryKey: [ACCOUNT_SUMMARIES_KEY, ...scheduleIds],
    queryFn: () => loadAccountSummaries(scheduleIds),
    // Offline the cache answers; React Query would otherwise pause the fetch.
    networkMode: "always",
    // Keyed on schedule ids (known immediately) so it runs in parallel with
    // the row fetch instead of waiting for it.
    enabled: open && scheduleIds.length > 0,
    // Cached numbers show instantly; reopening within a short while doesn't
    // refetch, and a saved payment invalidates the query anyway.
    staleTime: 30_000,
    placeholderData: () => readCachedSummaries(scheduleIds) ?? undefined,
  });
  const accountGroups = useMemo(() => {
    const groups = new Map<string, ScheduleDialogRow[]>();
    for (const row of rows) {
      const list = groups.get(row.account_id) ?? [];
      list.push(row);
      groups.set(row.account_id, list);
    }
    return [...groups.entries()].map(([accountId, accountRows]) => ({
      accountId,
      rows: accountRows,
    }));
  }, [rows]);

  useEffect(() => {
    if (refs.length === 0) {
      setRows([]);
      setChoices({});
      return;
    }
    let cancelled = false;
    const ids = refs.map((r) => r.id);
    const order = new Map(refs.map((r, i) => [r.id, i]));
    const show = (data: ScheduleDialogRow[]) => {
      const sorted = [...data].sort(
        (a, b) =>
          (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0) ||
          a.due_date.localeCompare(b.due_date),
      );
      setRows(sorted);
      // Keep any Paid/Partial already picked on the saved rows; untouched
      // rows take the fresh remaining amount.
      setChoices((prev) => {
        const next: Record<string, ScheduleChoice> = {};
        for (const r of sorted) {
          next[r.id] = prev[r.id]?.status
            ? prev[r.id]
            : { status: null, amount: String(remainingOnInstallment(r)) };
        }
        return next;
      });
      setLoading(false);
    };

    // Saved rows show at once; the load below refreshes them.
    const cached = readCachedSchedules(ids);
    setChoices({});
    if (cached.length > 0) show(cached);
    else {
      setRows([]);
      setLoading(true);
    }
    loadSchedules(ids).then(
      (data) => {
        if (!cancelled) show(data);
      },
      (err: unknown) => {
        if (cancelled || cached.length > 0) return;
        toast.error(err instanceof Error ? err.message : String(err));
        setRows([]);
        setChoices({});
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [refs]);

  const setChoice = (id: string, patch: Partial<ScheduleChoice>) => {
    setChoices((prev) => ({
      ...prev,
      [id]: {
        status: prev[id]?.status ?? null,
        amount: prev[id]?.amount ?? "",
        ...patch,
      },
    }));
  };

  const undoRows = rows.filter((row) => choices[row.id]?.status === "undo");
  // Only undos are picked: the button says so instead of "check off".
  const undoOnly =
    undoRows.length > 0 &&
    rows.every(
      (row) => !choices[row.id]?.status || choices[row.id]?.status === "undo",
    );

  const handleConfirm = async () => {
    // Everything is read up front: the dialog's state resets once it closes.
    const plan = buildPaymentPlan(rows, choices, overdueCutoffDateValue());
    const undoneCount = undoRows.length;
    const paidNow = new Set(plan.paidIds);
    // Every installment this dialog shows ends up paid (the item may link
    // more that it doesn't show).
    const settlesAll =
      rows.length > 0 &&
      rows.every((r) => r.status === "paid" || paidNow.has(r.id)) &&
      !undoRows.length;
    const accountIds = [...new Set(rows.map((r) => r.account_id))];

    setSubmitting(true);
    try {
      await recordPayments({
        plan,
        // A real payment: "+₱500!" when it earns profit.
        celebrateProfit: true,
        accountIds,
        borrowerId: borrower ? borrower.id : null,
        paymentDate: todayDateValue(),
        onApplied: () => {
          toast.success(
            undoneCount > 0 && plan.payments.length === 0
              ? `Undid ${undoneCount} payment${undoneCount === 1 ? "" : "s"}`
              : "Payment schedule updated",
          );
          onConfirmed({ settlesAll });
        },
        onFailed,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openRows = rows.filter((row) => row.status !== "paid");
  const dueTotal = openRows.reduce(
    (sum, row) => sum + remainingOnInstallment(row),
    0,
  );
  const initials = (borrowerName ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i, all) => (i === 0 || i === all.length - 1 ? w[0] : ""))
    .join("")
    .toUpperCase();

  const title = (
    <span className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        style={{ "--cat": borrowerColor ?? "#94a3b8" } as React.CSSProperties}
        className="flex size-12 shrink-0 items-center justify-center rounded-2xl
          bg-[color-mix(in_oklab,var(--cat)_22%,var(--card))] text-base
          font-black text-[color-mix(in_oklab,var(--cat)_45%,var(--foreground))]
          ring-1 ring-black/5 ring-inset dark:ring-white/10"
      >
        {initials || "₱"}
      </span>
      <span className="min-w-0">
        {borrower ? (
          <Link
            href={`/borrowers/${borrower.id}`}
            className="block truncate text-xl font-black tracking-tight
              lowercase"
          >
            {borrower.name}
          </Link>
        ) : (
          <span className="block text-xl font-black tracking-tight">
            Payment status
          </span>
        )}
        <span
          className="block text-sm font-semibold text-muted-foreground
            tabular-nums"
        >
          {mode === "edit"
            ? "Undo or change what's recorded"
            : loading
              ? "Loading…"
              : openRows.length === 0
                ? "All paid"
                : `${openRows.length} to pay · ₱${dueTotal.toLocaleString()} due`}
        </span>
      </span>
    </span>
  );
  const description =
    mode === "edit" ? (
      <>Undo or change what&apos;s been recorded.</>
    ) : (
      <>
        Mark {borrowerName ? `${borrowerName}'s` : "the"} linked collection
        {rows.length === 1 ? "" : "s"} as paid or partial before checking this
        off.
      </>
    );

  /** The left mark for an installment: its state at a glance. */
  const stateMark = (state: ScheduleState, chosen: string | null) => {
    const shown =
      chosen === "undo"
        ? "undo"
        : chosen === "paid" || state === "paid"
          ? "paid"
          : chosen === "partial"
            ? "partial"
            : state;
    return (
      <span
        aria-hidden="true"
        className={cn(
          `flex size-9 shrink-0 items-center justify-center rounded-full text-sm
          font-black transition-colors duration-200`,
          shown === "paid" && "bg-emerald-500 text-white",
          shown === "partial" &&
            "border-[2.5px] border-[#7f5ead] bg-[#7f5ead]/10 text-[#7f5ead]",
          shown === "overdue" && "bg-[#d14d5a] text-white",
          shown === "unpaid" && "border-2 border-border text-muted-foreground",
          shown === "undo" &&
            "border-2 border-dashed border-orange-500 text-orange-600",
        )}
      >
        {shown === "paid" ? (
          <Check className="size-4.5" strokeWidth={3.5} />
        ) : shown === "overdue" ? (
          "!"
        ) : shown === "undo" ? (
          <Undo2 className="size-4" />
        ) : shown === "partial" ? (
          "½"
        ) : null}
      </span>
    );
  };

  const body = loading ? (
    <div className="space-y-2 pt-1" aria-busy="true">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="h-32 animate-pulse rounded-3xl border border-border
            bg-muted/40"
        />
      ))}
    </div>
  ) : rows.length === 0 ? (
    <div
      className="py-8 text-center text-sm font-semibold text-muted-foreground"
    >
      Couldn&apos;t find the linked schedule — it may have been removed.
    </div>
  ) : (
    <div className="space-y-3">
      {accountGroups.map((group, groupIndex) => {
        const summary = summaries?.[group.accountId] ?? null;
        return (
          <section
            data-tour="pay-account-card"
            key={group.accountId}
            // Tapping the account's own part (its type and progress) opens
            // the account page; the installments keep their buttons.
            onClick={(e) => {
              if (
                (e.target as Element).closest(
                  "button, input, label, a, [data-schedule-card]",
                )
              )
                return;
              router.push(`/accounts/${group.accountId}`);
            }}
            className={`cursor-pointer overflow-hidden rounded-3xl border
              border-border bg-card shadow-sm ${ENTER_ANIMATION}`}
            style={{ animationDelay: `${groupIndex * 80}ms` }}
          >
            <div className="px-4 pt-3.5 pb-3">
              {summary ? (
                <Link href={`/accounts/${group.accountId}`} className="block">
                  <AccountSummaryHeader
                    summary={summary}
                    pending={pendingPayment(group.rows, choices)}
                  />
                </Link>
              ) : summariesPending ? (
                <div className="space-y-2">
                  <div className="h-4 w-24 animate-pulse rounded-full bg-muted" />
                  <div className="h-2 animate-pulse rounded-full bg-muted" />
                </div>
              ) : null}
            </div>
            <ul className="divide-y divide-border border-t border-border">
              {group.rows.map((row, rowIndex) => {
                const choice = choices[row.id];
                const chosen = choice?.status ?? null;
                const paidSoFar = amountPaidOnInstallment(row);
                const due = Math.max(0, Number(row.amount_due ?? 0));
                const remaining = remainingOnInstallment(row);
                const state: ScheduleState =
                  row.status === "paid"
                    ? "paid"
                    : paidSoFar > 0
                      ? "partial"
                      : row.due_date < overdueCutoffDateValue()
                        ? "overdue"
                        : "unpaid";
                const undoing = chosen === "undo";
                const isPaid = state === "paid";
                const toggleUndo = () =>
                  setChoice(row.id, { status: undoing ? null : "undo" });
                return (
                  <li
                    key={row.id}
                    data-schedule-card
                    className={cn(
                      "px-4 py-3 transition-colors duration-200",
                      undoing
                        ? "bg-orange-500/5"
                        : chosen === "paid"
                          ? "bg-emerald-500/[0.07]"
                          : chosen === "partial"
                            ? "bg-[#7f5ead]/[0.07]"
                            : "",
                      ENTER_ANIMATION,
                    )}
                    style={{
                      animationDelay: `${groupIndex * 80 + (rowIndex + 1) * 60}ms`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {stateMark(state, chosen)}
                      <div className="min-w-0 flex-1">
                        <p
                          className="flex items-center gap-1.5 text-[15px]
                            font-bold"
                        >
                          {formatShortDate(row.due_date)}
                          <span
                            className={cn(
                              "text-[11px] font-bold lowercase",
                              undoing
                                ? "text-orange-600"
                                : state === "overdue"
                                  ? "text-[#d14d5a] dark:text-[#f0a0a8]"
                                  : state === "partial"
                                    ? "text-[#7f5ead]"
                                    : state === "paid"
                                      ? "text-emerald-600 dark:text-emerald-300"
                                      : "text-muted-foreground",
                            )}
                          >
                            {undoing ? "resets to unpaid" : STATE_LABEL[state]}
                          </span>
                        </p>
                        <p
                          className="text-xs font-semibold text-muted-foreground
                            tabular-nums"
                        >
                          {state === "partial" && !undoing ? (
                            <>
                              <span className="font-bold text-[#7f5ead]">
                                ₱{paidSoFar.toLocaleString()}
                              </span>{" "}
                              of ₱{due.toLocaleString()} paid
                            </>
                          ) : row.principal_share !== undefined ? (
                            <ProfitText
                              amount={installmentProfit(
                                due,
                                row.principal_share,
                              )}
                            />
                          ) : null}
                        </p>
                      </div>
                      <p
                        className={cn(
                          "shrink-0 text-lg font-black tabular-nums",
                          isPaid && !undoing
                            ? "text-emerald-600 dark:text-emerald-300"
                            : "text-foreground/75",
                        )}
                      >
                        ₱
                        {(isPaid && !undoing
                          ? paidSoFar
                          : undoing
                            ? due
                            : remaining
                        ).toLocaleString()}
                      </p>
                    </div>

                    <div className="mt-2.5 flex items-center gap-2 pl-12">
                      {isPaid ? (
                        <button
                          type="button"
                          onClick={toggleUndo}
                          aria-pressed={undoing}
                          aria-label={`Undo ₱${paidSoFar.toLocaleString()} payment`}
                          className={cn(
                            `flex h-9 flex-1 items-center justify-center gap-1.5
                              rounded-full text-sm font-bold transition
                              active:scale-[0.97]`,
                            undoing
                              ? "bg-orange-500 text-white"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          <Undo2 className="size-3.5" />
                          {undoing ? "Will undo" : "Undo payment"}
                        </button>
                      ) : (
                        <>
                          {/* Paid or partial, as one rounded switch. */}
                          <div
                            data-tour="pay-schedule-actions"
                            className="grid h-9 flex-1 grid-cols-2 rounded-full
                              bg-muted p-1"
                          >
                            {(
                              [
                                ["paid", "Paid", "bg-emerald-500 text-white"],
                                [
                                  "partial",
                                  "Partial",
                                  "bg-[#7f5ead] text-white",
                                ],
                              ] as const
                            ).map(([value, label, on]) => (
                              <button
                                key={value}
                                type="button"
                                aria-pressed={chosen === value}
                                onClick={() =>
                                  setChoice(row.id, {
                                    status: chosen === value ? null : value,
                                  })
                                }
                                className={cn(
                                  `rounded-full text-sm font-bold transition-all
                                    duration-200 active:scale-[0.97]`,
                                  chosen === value
                                    ? `${on} shadow-sm`
                                    : "text-muted-foreground",
                                )}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          {hasPayment(row) && (
                            <button
                              type="button"
                              onClick={toggleUndo}
                              aria-pressed={undoing}
                              aria-label={`Undo ₱${paidSoFar.toLocaleString()} payment`}
                              className={cn(
                                `flex size-9 shrink-0 items-center
                                  justify-center rounded-full transition
                                  active:scale-90`,
                                undoing
                                  ? "bg-orange-500 text-white"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              <Undo2 className="size-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {chosen === "partial" && (
                      <label
                        className="mt-2 ml-12 flex h-11 cursor-text items-center
                          gap-1.5 rounded-2xl border border-border bg-card
                          px-3.5 transition focus-within:border-[#7f5ead]
                          focus-within:ring-4 focus-within:ring-[#7f5ead]/15"
                      >
                        <span
                          className="text-sm font-bold text-muted-foreground"
                        >
                          ₱
                        </span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={remaining}
                          step="0.01"
                          placeholder="0"
                          aria-label="Amount paid"
                          autoFocus
                          onFocus={(e) => e.currentTarget.select()}
                          value={choice?.amount ?? ""}
                          onChange={(e) =>
                            setChoice(row.id, { amount: e.target.value })
                          }
                          className="min-w-0 flex-1 bg-transparent text-base
                            font-bold tabular-nums outline-none
                            [appearance:textfield]
                            [&::-webkit-inner-spin-button]:appearance-none
                            [&::-webkit-outer-spin-button]:appearance-none"
                        />
                        <span
                          className={`shrink-0 text-xs font-semibold
                            tabular-nums ${
                              Number.parseFloat(choice?.amount || "0") >
                              remaining
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-muted-foreground"
                            }`}
                        >
                          of ₱{remaining.toLocaleString()}
                        </span>
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );

  const markAll =
    openRows.length > 1 ? (
      <button
        type="button"
        onClick={() =>
          setChoices((prev) => {
            const next = { ...prev };
            for (const row of rows) {
              if (row.status === "paid") continue;
              next[row.id] = {
                status: "paid",
                amount: prev[row.id]?.amount ?? "",
              };
            }
            return next;
          })
        }
        className="flex h-8 shrink-0 items-center gap-1 rounded-full
          bg-emerald-500/15 px-3 text-xs font-bold text-emerald-700 transition
          active:scale-95 dark:text-emerald-300"
      >
        <Check className="size-3.5" strokeWidth={3} />
        Mark all paid
      </button>
    ) : null;

  const buttons = (
    <>
      <Button
        variant="outline"
        size="lg"
        data-tour="pay-cancel"
        onClick={onClose}
        disabled={submitting}
        className="h-12 rounded-2xl font-bold"
      >
        Cancel
      </Button>
      <Button
        size="lg"
        onClick={handleConfirm}
        disabled={loading || submitting}
        variant={undoOnly ? "destructive" : "default"}
        className="h-12 flex-1 rounded-2xl text-base font-bold"
      >
        {submitting
          ? "Saving…"
          : undoOnly
            ? `Undo ${undoRows.length} payment${undoRows.length === 1 ? "" : "s"}`
            : mode === "edit"
              ? "Save changes"
              : "Confirm & check off"}
      </Button>
    </>
  );

  if (variant === "drawer") {
    return (
      <Sheet open={open} onClose={onClose} label="Update payment status">
        <div className="px-4 pt-2 pb-4">
          <div className="flex items-center justify-between gap-2 px-1 pb-4">
            {title}
            {markAll}
          </div>
          {body}
        </div>
        <SheetFooter className="flex gap-2">{buttons}</SheetFooter>
      </Sheet>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="gap-2 pb-1">
          <DialogTitle className="flex items-center justify-between gap-2">
            {title}
            {markAll}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {description}
          </DialogDescription>
        </DialogHeader>
        {body}
        <DialogFooter className="gap-2">{buttons}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Confirms marking every linked collection in a category paid at once. */
export function BulkPaidDialog({
  items,
  categoryName,
  onClose,
  onConfirmed,
}: {
  items: DailyChecklistItem[] | null;
  categoryName: string;
  onClose: () => void;
  onConfirmed: (itemIds: string[]) => void;
}) {
  const open = !!items && items.length > 0;
  const invalidateBorrowerDetails = useInvalidateBorrowerDetails();
  const [rows, setRows] = useState<ScheduleDialogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paidDate, setPaidDate] = useState(todayDateValue());
  const ids = useMemo(
    () => [
      ...new Set(
        (items ?? []).flatMap((i) =>
          extractScheduleRefs(i.label).map((r) => r.id),
        ),
      ),
    ],
    [items],
  );

  useEffect(() => {
    if (ids.length === 0) return;
    let cancelled = false;
    void (async () => {
      // Saved rows show at once; the load below refreshes them.
      const cached = readCachedSchedules(ids);
      if (cached.length > 0) {
        setRows(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }
      let all = cached;
      try {
        all = await loadSchedules(ids);
      } catch (err) {
        if (cached.length === 0) {
          toast.error(err instanceof Error ? err.message : String(err));
        }
      }
      if (cancelled) return;
      setRows(all);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [ids]);

  const openRows = rows.filter((r) => r.status !== "paid");
  const total = openRows.reduce((sum, r) => sum + remainingOnInstallment(r), 0);
  const borrowerCount = new Set(
    (items ?? []).map((i) => extractBorrowerMention(i.label)?.id ?? i.id),
  ).size;

  const handleConfirm = async () => {
    if (!items || !paidDate) return;
    setSubmitting(true);
    const queuedBefore = await getPendingOutboxCount();
    try {
      const result = await markSchedulesPaidAction(ids, paidDate);
      applyPaymentsToCache(
        openRows.map((r) => ({
          scheduleId: r.id,
          amount: remainingOnInstallment(r),
        })),
      );
      void refreshCachedAccounts(rows.map((r) => r.account_id)).catch(() => {});
      new Set(
        items.map((i) => extractBorrowerMention(i.label)?.id).filter(Boolean),
      ).forEach((id) => invalidateBorrowerDetails(id as string));
      toast.success(
        `Marked ${result.updated} collection${result.updated === 1 ? "" : "s"} paid`,
      );
      onConfirmed(items.map((i) => i.id));
    } catch (err) {
      if (await actionWasQueued(queuedBefore)) {
        // Queued by the service worker; reflect it locally until it syncs.
        applyPaymentsToCache(
          openRows.map((r) => ({
            scheduleId: r.id,
            amount: remainingOnInstallment(r),
          })),
        );
        onConfirmed(items.map((i) => i.id));
        return;
      }
      console.error("BulkPaidDialog confirm error:", err);
      toast.error("Failed to mark as paid");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !submitting) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="gap-3 pb-2">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full
              bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40
              dark:text-emerald-300"
          >
            <Check className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <DialogTitle className="text-xl font-semibold tracking-tight">
              Mark all as paid
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Records the full amount as paid for every unchecked item in{" "}
              {categoryName} and checks them off.
            </DialogDescription>
          </div>
        </DialogHeader>

        {loading ? (
          <div
            className="py-6 text-center text-sm text-slate-500
              dark:text-muted-foreground"
          >
            Loading…
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <div
              className="dark:border-border dark:bg-card rounded-lg border
                border-slate-200 bg-white p-3 text-sm"
            >
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-muted-foreground">
                  Borrowers
                </span>
                <span className="font-semibold">{borrowerCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-muted-foreground">
                  Collections to mark paid
                </span>
                <span className="font-semibold">{openRows.length}</span>
              </div>
              {rows.length - openRows.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-muted-foreground">
                    Already paid
                  </span>
                  <span className="font-semibold">
                    {rows.length - openRows.length}
                  </span>
                </div>
              )}
              <div className="mt-1 flex justify-between border-t pt-1">
                <span className="text-slate-500 dark:text-muted-foreground">
                  Total
                </span>
                <span className="font-semibold">₱{total.toLocaleString()}</span>
              </div>
            </div>
            <div>
              <label
                className="dark:text-muted-foreground mb-1.5 block text-xs
                  font-medium text-slate-500"
              >
                Payment date
              </label>
              <input
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
                className="dark:border-border dark:bg-background
                  dark:text-foreground w-full rounded-md border border-slate-300
                  bg-white px-2 py-1.5 text-sm font-semibold text-slate-600
                  outline-none focus-visible:ring-2
                  focus-visible:ring-slate-900"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || submitting || !paidDate}
          >
            {submitting ? "Saving…" : "Mark all paid"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
