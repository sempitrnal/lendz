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
import { MentionPill } from "@/components/dashboard/checklist/checklist-label";
import { chipClass, type ChipTone } from "@/components/dashboard/checklist/dom";
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

const STATE_CHIP: Record<ScheduleState, ChipTone> = {
  paid: "paid",
  partial: "partial",
  overdue: "overdue",
  unpaid: "neutral",
};

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
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`rounded border px-1.5 py-0.5 text-[11px] leading-none
            font-semibold lowercase ${
              summary.isCashAdvance
                ? `border-amber-300/60 bg-amber-100 text-amber-800
                  dark:border-amber-700 dark:bg-amber-900/40
                  dark:text-amber-200`
                : `border-violet-300/60 bg-violet-100 text-violet-800
                  dark:border-violet-700 dark:bg-violet-900/40
                  dark:text-violet-200`
            }`}
        >
          {summary.typeLabel}
        </span>
        {summary.installmentCount > 0 && (
          <span
            className={`text-xs font-semibold tabular-nums transition-colors ${
              pending.undoInstallments > 0
                ? "text-orange-600 dark:text-orange-400"
                : pending.installments > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-slate-700 dark:text-slate-300"
            }`}
          >
            {paidInstallments} of {summary.installmentCount} paid
          </span>
        )}
      </div>
      <div
        className="flex h-1.5 overflow-hidden rounded-full bg-slate-100
          dark:bg-slate-800"
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
          className="h-full bg-emerald-500/30 transition-[width] duration-300"
          style={{ width: width(paidAdded) }}
        />
        <div
          className="h-full bg-violet-500/35 transition-[width] duration-300"
          style={{ width: width(partialAdded) }}
        />
      </div>
      <div
        className="flex justify-between text-[11px] text-muted-foreground
          tabular-nums"
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

  const title = (
    <>
      <span>Update payment status</span>
      {borrower ? (
        <MentionPill
          name={borrower.name}
          href={`/borrowers/${borrower.id}`}
          checked={false}
          color={borrowerColor}
          asLink={false}
        />
      ) : null}
    </>
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
  const body = loading ? (
    <div
      className="py-6 text-center text-sm text-slate-500
        dark:text-muted-foreground"
    >
      Loading…
    </div>
  ) : rows.length === 0 ? (
    <div
      className="py-6 text-center text-sm text-slate-500
        dark:text-muted-foreground"
    >
      Couldn&apos;t find the linked schedule — it may have been removed.
    </div>
  ) : (
    <div className="space-y-3 pt-2">
      {rows.filter((row) => row.status !== "paid").length > 1 && (
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
          className="w-full cursor-pointer rounded-md border border-emerald-500
            bg-emerald-50 px-2 py-1.5 text-sm font-semibold text-emerald-900
            lowercase transition hover:bg-emerald-100 dark:border-emerald-400/50
            dark:bg-emerald-400/10 dark:text-emerald-200"
        >
          Mark all paid
        </button>
      )}
      {accountGroups.map((group, groupIndex) => {
        const summary = summaries?.[group.accountId] ?? null;
        return (
          <section
            data-tour="pay-account-card"
            key={group.accountId}
            // One container per account: its type and progress together
            // with its schedules, set apart from the other accounts.
            // Tapping the account's card (its type and progress) opens the
            // account page; the schedules and their buttons keep working.
            onClick={(e) => {
              if (
                (e.target as Element).closest(
                  "button, input, label, a, [data-schedule-card]",
                )
              )
                return;
              router.push(`/accounts/${group.accountId}`);
            }}
            className={`cursor-pointer space-y-2.5 rounded-2xl bg-slate-100/70
              p-3 dark:bg-muted/30 ${ENTER_ANIMATION}`}
            style={{ animationDelay: `${groupIndex * 80}ms` }}
          >
            {summary ? (
              <Link
                href={`/accounts/${group.accountId}`}
                className="block px-0.5"
              >
                <AccountSummaryHeader
                  summary={summary}
                  pending={pendingPayment(group.rows, choices)}
                />
              </Link>
            ) : summariesPending ? (
              <div className="space-y-1.5 px-0.5">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-1.5 animate-pulse rounded-full bg-muted" />
              </div>
            ) : null}
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
              const undoButton = (wide: boolean) => (
                <button
                  type="button"
                  onClick={() =>
                    setChoice(row.id, {
                      status: undoing ? null : "undo",
                    })
                  }
                  aria-pressed={undoing}
                  aria-label={`Undo ₱${paidSoFar.toLocaleString()} payment`}
                  className={`${ACTION_BUTTON} flex items-center justify-center
                    gap-1.5 ${wide ? "w-full" : "px-3"} ${
                      undoing
                        ? `border-orange-500 bg-orange-100 text-orange-900
                          dark:border-orange-400/50 dark:bg-orange-400/20
                          dark:text-orange-200`
                        : `border-dashed border-slate-300 bg-white/70
                          text-slate-600 hover:border-orange-500
                          hover:bg-orange-50 dark:border-border dark:bg-card
                          dark:text-muted-foreground`
                    }`}
                >
                  <Undo2 className="size-3.5" />
                  {wide ? "Undo payment" : "Undo"}
                </button>
              );
              return (
                <div
                  key={row.id}
                  data-schedule-card
                  className={`rounded-xl border p-3 shadow-sm
                    transition-[background-color,border-color,box-shadow]
                    duration-300 ${
                      undoing
                        ? SCHEDULE_CARD.undo
                        : isPaid
                          ? SCHEDULE_CARD.paid
                          : state === "partial"
                            ? SCHEDULE_CARD.partial
                            : SCHEDULE_CARD.plain
                    } ${ENTER_ANIMATION}`}
                  style={{
                    animationDelay: `${groupIndex * 80 + (rowIndex + 1) * 60}ms`,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className="text-sm font-semibold text-slate-800
                            dark:text-foreground"
                        >
                          {formatShortDate(row.due_date)}
                        </span>
                        {undoing ? (
                          <span className={chipClass("unpaid")}>
                            will reset to unpaid
                          </span>
                        ) : (
                          <span className={chipClass(STATE_CHIP[state])}>
                            {STATE_LABEL[state]}
                          </span>
                        )}
                      </div>
                      {row.principal_share !== undefined && (
                        <p className="text-xs">
                          <ProfitText
                            amount={installmentProfit(due, row.principal_share)}
                          />
                        </p>
                      )}
                      {state === "partial" && !undoing && (
                        <p className="text-xs text-muted-foreground
                          tabular-nums">
                          <span className={PAID_TEXT.partial}>
                            ₱{paidSoFar.toLocaleString()}
                          </span>{" "}
                          of ₱{due.toLocaleString()} paid
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={`text-base leading-tight font-semibold
                          tabular-nums ${
                            isPaid && !undoing
                              ? PAID_TEXT.paid
                              : "text-slate-800 dark:text-foreground"
                          }`}
                      >
                        ₱
                        {(isPaid && !undoing
                          ? paidSoFar
                          : undoing
                            ? due
                            : remaining
                        ).toLocaleString()}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {isPaid && !undoing ? "paid" : "due"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3">
                    {isPaid ? (
                      // Nothing left to pay — the only action is undo.
                      undoButton(true)
                    ) : (
                      <div
                        data-tour="pay-schedule-actions"
                        className={`grid gap-1.5 ${
                          hasPayment(row)
                            ? "grid-cols-[1fr_1fr_auto]"
                            : "grid-cols-2"
                          }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setChoice(row.id, {
                              status: chosen === "paid" ? null : "paid",
                            })
                          }
                          className={`${ACTION_BUTTON} ${
                            chosen === "paid"
                              ? `border-emerald-500 bg-emerald-200
                                text-emerald-950 dark:border-emerald-400/50
                                dark:bg-emerald-400/25 dark:text-emerald-200`
                              : `border-slate-300 bg-white text-slate-600
                                hover:border-emerald-500 hover:bg-emerald-50
                                dark:border-border dark:bg-card
                                dark:text-muted-foreground`
                            }`}
                        >
                          Paid
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setChoice(row.id, {
                              status: chosen === "partial" ? null : "partial",
                            })
                          }
                          className={`${ACTION_BUTTON} ${
                            chosen === "partial"
                              ? `border-violet-500 bg-violet-200 text-violet-950
                                dark:border-violet-400/50 dark:bg-violet-400/25
                                dark:text-violet-200`
                              : `border-slate-300 bg-white text-slate-600
                                hover:border-violet-500 hover:bg-violet-50
                                dark:border-border dark:bg-card
                                dark:text-muted-foreground`
                            }`}
                        >
                          Partial
                        </button>
                        {hasPayment(row) && undoButton(false)}
                      </div>
                    )}
                  </div>

                  {chosen === "partial" && (
                    <label
                      className="mt-2 flex cursor-text items-center gap-1.5
                        rounded-md border border-slate-300 bg-white px-2.5
                        py-1.5 transition-colors focus-within:border-violet-400
                        focus-within:ring-3 focus-within:ring-violet-500/15
                        dark:border-border dark:bg-background
                        dark:focus-within:border-violet-400/60"
                    >
                      <span className="text-sm font-semibold
                        text-muted-foreground">
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
                        className="min-w-0 flex-1 bg-transparent text-sm
                          font-semibold text-slate-700 outline-none
                          [appearance:textfield] dark:text-foreground
                          [&::-webkit-inner-spin-button]:appearance-none
                          [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <span
                        className={`shrink-0 text-xs tabular-nums ${
                          Number.parseFloat(choice?.amount || "0") > remaining
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-muted-foreground"
                          }`}
                      >
                        of ₱{remaining.toLocaleString()}
                      </span>
                    </label>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
  const buttons = (
    <>
      <Button
        variant="outline"
        data-tour="pay-cancel"
        onClick={onClose}
        disabled={submitting}
        className="lowercase"
      >
        Cancel
      </Button>
      <Button
        onClick={handleConfirm}
        disabled={loading || submitting}
        variant={undoOnly ? "destructive" : "default"}
        className="lowercase"
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
        <div className="px-5 pt-2 pb-3">
          <div
            className="flex flex-col items-start gap-1.5 text-xl font-semibold
              tracking-tight"
          >
            {title}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          <div className="mt-2">{body}</div>
        </div>
        <SheetFooter className="flex justify-end gap-2">{buttons}</SheetFooter>
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
        <DialogHeader className="gap-3 pb-2">
          <div className="space-y-1">
            <DialogTitle
              className="flex flex-col items-start gap-1.5 text-xl font-semibold
                tracking-tight"
            >
              {title}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {description}
            </DialogDescription>
          </div>
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
