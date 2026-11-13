"use client";

import { paidDay } from "@/lib/paid-day";
import { paymentTiming } from "@/lib/checklist/late-label";
import { useSchedulePayments } from "@/components/dashboard/checklist-v2/use-schedule-payments";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CHECKLIST_RELOAD_EVENT } from "@/components/dashboard/checklist-v2/use-checklist-items";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, HandCoins, Landmark, Plus, Undo2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cleanAmount, formatAmount } from "@/components/payment-fields";
import { cn } from "@/lib/utils";
import { ProfitText } from "@/components/dashboard/checklist/profit-text";
import { installmentProfit } from "@/lib/checklist/profit";
import { Sheet, SheetFooter } from "@/components/dashboard/checklist-v2/sheet";
import {
  deletePaymentEntryAction,
  markSchedulesPaidAction,
} from "@/lib/actions/schedules";
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
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className={`flex size-8 shrink-0 items-center justify-center
              rounded-full ${
                summary.isCashAdvance
                  ? `bg-amber-100 text-amber-700 dark:bg-amber-500/20
                    dark:text-amber-300`
                  : `bg-violet-100 text-violet-700 dark:bg-violet-500/20
                    dark:text-violet-300`
              }`}
          >
            {summary.isCashAdvance ? (
              <HandCoins className="size-4" />
            ) : (
              <Landmark className="size-4" />
            )}
          </span>
          <span
            className="truncate text-sm font-black text-card-foreground/80
              lowercase"
          >
            {summary.typeLabel}
          </span>
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
        className="flex h-2.5 overflow-hidden rounded-full bg-muted"
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
  /** The installment whose amount box was opened by a tap (it takes focus). */
  const [focusId, setFocusId] = useState<string | null>(null);
  /** What is being saved right now: an installment (add) or a payment (undo). */
  const [busyId, setBusyId] = useState<string | null>(null);
  /** The payment whose undo is waiting for a second tap. */
  const [sureUndoId, setSureUndoId] = useState<string | null>(null);
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
  const queryClient = useQueryClient();
  const invalidateBorrowerDetails = useInvalidateBorrowerDetails();
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
  // Each schedule's payments, for the history under it.
  const history = useSchedulePayments(scheduleIds, open);
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

  /** Shows fresh rows, keeping any Paid/Partial already picked. */
  const applyRows = (data: ScheduleDialogRow[]) => {
    const order = new Map(refs.map((r, i) => [r.id, i]));
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
        // A part-paid installment opens on Partial with an empty amount, so
        // adding the next payment is one tap; empty pays nothing.
        const partlyPaid =
          r.status !== "paid" && amountPaidOnInstallment(r) > 0;
        next[r.id] = prev[r.id]?.status
          ? prev[r.id]
          : partlyPaid
            ? { status: "partial", amount: "" }
            : { status: null, amount: String(remainingOnInstallment(r)) };
      }
      return next;
    });
    setLoading(false);
  };

  useEffect(() => {
    if (refs.length === 0) {
      setRows([]);
      setChoices({});
      return;
    }
    let cancelled = false;
    const ids = refs.map((r) => r.id);
    const show = applyRows;

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

  /** Re-reads the rows after a payment was added or undone here. */
  const reloadRows = async () => {
    try {
      applyRows(await loadSchedules(refs.map((r) => r.id)));
    } catch {
      // The saved copy already shows the change; the next open re-reads.
    }
  };

  /** Adds the typed partial payment now, without closing or checking off. */
  const addNow = async (row: ScheduleDialogRow) => {
    if (busyId) return;
    const typed = Number.parseFloat(choices[row.id]?.amount || "0");
    const amount = Math.min(
      Math.round(typed * 100) / 100,
      remainingOnInstallment(row),
    );
    if (!Number.isFinite(amount) || amount <= 0) return;
    const full = amount >= remainingOnInstallment(row);
    setBusyId(row.id);
    try {
      const result = await recordPayments({
        plan: {
          payments: [{ scheduleId: row.id, amount }],
          // The whole balance settles it: that is paid, not partial.
          paidIds: full ? [row.id] : [],
          partials: full ? [] : [{ id: row.id, amount }],
          undoCalls: [],
        },
        celebrateProfit: true,
        accountIds: [row.account_id],
        borrowerId: borrower ? borrower.id : null,
        paymentDate: todayDateValue(),
        onApplied: () => {
          toast.success(
            full
              ? `₱${amount.toLocaleString()} paid in full`
              : `₱${amount.toLocaleString()} payment added`,
          );
          // The saved copy already has it: show it at once.
          applyRows(readCachedSchedules(refs.map((r) => r.id)));
          setChoice(
            row.id,
            full
              ? { status: null, amount: "" }
              : { status: "partial", amount: "" },
          );
        },
      });
      if (result !== "failed") await reloadRows();
    } finally {
      setBusyId(null);
    }
  };

  /** Undoes one payment (the second tap confirms). */
  const undoPayment = async (row: ScheduleDialogRow, paymentId: string) => {
    if (busyId) return;
    if (sureUndoId !== paymentId) {
      setSureUndoId(paymentId);
      window.setTimeout(
        () => setSureUndoId((cur) => (cur === paymentId ? null : cur)),
        3500,
      );
      return;
    }
    setSureUndoId(null);
    setBusyId(paymentId);
    try {
      const fd = new FormData();
      fd.set("paymentId", paymentId);
      fd.set("scheduleId", row.id);
      await deletePaymentEntryAction(row.account_id, fd);
      // The server may have taken the row off the day's list.
      window.dispatchEvent(new Event(CHECKLIST_RELOAD_EVENT));
      await refreshCachedAccounts([row.account_id]).catch(() => {});
      if (borrower) invalidateBorrowerDetails(borrower.id);
      queryClient.invalidateQueries({ queryKey: [ACCOUNT_SUMMARIES_KEY] });
      queryClient.invalidateQueries({ queryKey: ["checklist-month-profit"] });
      queryClient.invalidateQueries({ queryKey: ["checklist-day-profit"] });
      await reloadRows();
      toast.success("Payment undone");
    } catch {
      toast.error("Couldn't undo that payment");
    } finally {
      setBusyId(null);
    }
  };

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
        className="flex size-12 shrink-0 items-center justify-center
          rounded-full bg-[color-mix(in_oklab,var(--cat)_22%,var(--card))]
          text-base font-black
          text-[color-mix(in_oklab,var(--cat)_45%,var(--foreground))] ring-1
          ring-black/5 ring-inset dark:ring-white/10"
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

  /** A small gradient marker for an installment's state; the words say the rest. */
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
          `size-3.5 shrink-0 rounded-full bg-linear-to-br shadow-sm ring-2
          ring-white/70 transition-colors duration-200 dark:ring-white/10`,
          shown === "paid" && "from-emerald-300 to-emerald-600",
          shown === "partial" && "from-violet-300 to-violet-600",
          shown === "overdue" && "from-rose-300 to-rose-600",
          shown === "unpaid" &&
            "from-slate-200 to-slate-400 dark:from-slate-500 dark:to-slate-700",
          shown === "undo" && "from-orange-300 to-orange-600",
        )}
      />
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
    <div className="space-y-3 lowercase">
      {mode === "check" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-muted/60 px-3 py-2">
            <p className="text-[11px] font-semibold text-muted-foreground">
              to pay
            </p>
            <p
              className="text-base font-black text-card-foreground/80
                tabular-nums"
            >
              {openRows.length} installment{openRows.length === 1 ? "" : "s"}
            </p>
          </div>
          <div
            className="rounded-xl bg-emerald-50 px-3 py-2
              dark:bg-emerald-500/10"
          >
            <p
              className="text-[11px] font-semibold text-emerald-700
                dark:text-emerald-400"
            >
              due
            </p>
            <p
              className="text-base font-black text-emerald-700 tabular-nums
                dark:text-emerald-300"
            >
              ₱{dueTotal.toLocaleString()}
            </p>
          </div>
        </div>
      )}
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
            className={`cursor-pointer overflow-hidden rounded-2xl bg-card
              shadow-sm ring-1 ring-black/5 dark:ring-white/10
              ${ENTER_ANIMATION}`}
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
            <ul className="space-y-2 px-3 pb-3">
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
                      "rounded-2xl p-3 ring-1 transition-colors duration-200",
                      undoing
                        ? `bg-orange-50 ring-orange-300/70
                          dark:bg-orange-500/10`
                        : chosen === "paid" || isPaid
                          ? `bg-emerald-50 ring-emerald-300/70
                            dark:bg-emerald-500/10 dark:ring-emerald-500/30`
                          : chosen === "partial" || state === "partial"
                            ? `bg-violet-50 ring-violet-300/70
                              dark:bg-violet-500/10 dark:ring-violet-500/30`
                            : "bg-muted/40 ring-transparent",
                      ENTER_ANIMATION,
                    )}
                    style={{
                      animationDelay: `${groupIndex * 80 + (rowIndex + 1) * 60}ms`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p
                          className="flex items-center gap-1.5 text-[15px]
                            font-bold"
                        >
                          {stateMark(state, chosen)}
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

                    {(state === "partial" ||
                      (history?.[row.id] ?? []).length > 0) &&
                      !undoing && (
                        <div
                          className="mt-2.5 rounded-xl bg-card/80 p-2.5 ring-1
                            ring-black/5 dark:ring-white/10"
                        >
                          <div
                            className="flex items-center justify-between gap-2"
                          >
                            <p
                              className="text-[11px] font-black
                                text-muted-foreground"
                            >
                              payment history
                              {state !== "partial" && (
                                <span className="ml-1.5 font-semibold">
                                  {(history?.[row.id] ?? []).length} · ₱
                                  {paidSoFar.toLocaleString()}
                                </span>
                              )}
                            </p>
                            {state === "partial" && chosen !== "paid" && (
                              <button
                                type="button"
                                onClick={() => {
                                  setChoice(row.id, {
                                    status: "partial",
                                    amount: choice?.amount ?? "",
                                  });
                                  setFocusId(row.id);
                                  // The box may already be open: focus it directly.
                                  requestAnimationFrame(() =>
                                    document
                                      .getElementById(
                                        `partial-amount-${row.id}`,
                                      )
                                      ?.focus(),
                                  );
                                }}
                                className="flex h-7 items-center gap-1
                                  rounded-full bg-linear-to-br from-[#9784d8]
                                  to-[#7a66c0] px-2.5 text-xs font-bold
                                  text-white lowercase shadow-sm
                                  shadow-[#7a66c0]/25 transition
                                  active:scale-95"
                              >
                                <Plus className="size-3.5" strokeWidth={3} />
                                add payment
                              </button>
                            )}
                          </div>
                          {history === undefined ? (
                            <p
                              className="mt-1.5 text-xs font-semibold
                                text-muted-foreground"
                            >
                              loading…
                            </p>
                          ) : (history[row.id] ?? []).length === 0 ? (
                            <p
                              className="mt-1.5 text-xs font-semibold
                                text-muted-foreground"
                            >
                              ₱{paidSoFar.toLocaleString()} recorded · no dated
                              payments
                            </p>
                          ) : (
                            <ul className="mt-1 divide-y divide-border/60">
                              {(history[row.id] ?? []).map((p, i) => {
                                const timing = p.payment_date
                                  ? paymentTiming(row.due_date, p.payment_date)
                                  : null;
                                return (
                                  <li
                                    key={i}
                                    className="flex items-center justify-between
                                      gap-2 py-1.5 text-xs font-semibold"
                                  >
                                    <span
                                      className="min-w-0 text-muted-foreground"
                                    >
                                      {p.payment_date
                                        ? paidDay(p.payment_date, (d) =>
                                            formatShortDate(d).toLowerCase(),
                                          )
                                        : "no date"}
                                      {timing && (
                                        <span
                                          className={cn(
                                            "ml-1.5",
                                            timing.tone === "late" &&
                                              "text-rose-600 dark:text-rose-400",
                                            timing.tone === "early" &&
                                              `text-emerald-600
                                                dark:text-emerald-400`,
                                          )}
                                        >
                                          {timing.text}
                                        </span>
                                      )}
                                    </span>
                                    <span
                                      className="flex shrink-0 items-center
                                        gap-2"
                                    >
                                      <span
                                        className="font-bold tabular-nums
                                          text-card-foreground/80"
                                      >
                                        ₱{p.amount.toLocaleString()}
                                      </span>
                                      {p.id && (
                                        <button
                                          type="button"
                                          disabled={busyId !== null}
                                          onClick={() =>
                                            void undoPayment(
                                              row,
                                              p.id as string,
                                            )
                                          }
                                          aria-label={`Undo ₱${p.amount.toLocaleString()} payment`}
                                          className={cn(
                                            `flex h-6 items-center gap-1
                                              rounded-full px-2 text-[11px]
                                              font-bold lowercase transition
                                              active:scale-95
                                              disabled:opacity-50`,
                                            sureUndoId === p.id
                                              ? `bg-linear-to-br from-orange-400
                                                to-orange-500 text-white
                                                shadow-sm shadow-orange-500/25`
                                              : `border border-orange-300/70
                                                bg-transparent
                                                text-orange-700/80
                                                hover:bg-orange-500/10
                                                dark:border-orange-400/30
                                                dark:text-orange-300/80`,
                                          )}
                                        >
                                          <Undo2 className="size-3" />
                                          {sureUndoId === p.id
                                            ? "sure?"
                                            : "undo"}
                                        </button>
                                      )}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      )}

                    <div className="mt-2.5 flex items-center gap-2">
                      {isPaid ? (
                        <button
                          type="button"
                          onClick={toggleUndo}
                          aria-pressed={undoing}
                          aria-label={`Undo ₱${paidSoFar.toLocaleString()} payment`}
                          className={cn(
                            `flex h-9 flex-1 items-center justify-center gap-1.5
                              rounded-full text-sm font-bold lowercase
                              transition active:scale-[0.97]`,
                            undoing
                              ? `bg-linear-to-br from-orange-400 to-orange-500
                                text-white shadow-sm shadow-orange-500/25`
                              : `border border-orange-300/70 bg-transparent
                                text-orange-700/80 hover:bg-orange-500/10
                                dark:border-orange-400/30
                                dark:text-orange-300/80`,
                          )}
                        >
                          <Undo2 className="size-3.5" />
                          {undoing ? "Will undo" : "Undo payment"}
                        </button>
                      ) : (
                        <>
                          {/* Paid and partial: two separate gradient buttons. */}
                          <div
                            data-tour="pay-schedule-actions"
                            className="grid h-10 flex-1 grid-cols-2 gap-2"
                          >
                            {(
                              [
                                [
                                  "paid",
                                  "Paid",
                                  `bg-linear-to-br from-emerald-400 to-emerald-500
                                    text-white shadow-sm shadow-emerald-500/25`,
                                  `border border-emerald-300/70 bg-transparent text-emerald-700/80 hover:bg-emerald-500/10 dark:border-emerald-400/30 dark:text-emerald-300/80`,
                                ],
                                [
                                  "partial",
                                  "Partial",
                                  `bg-linear-to-br from-[#9784d8] to-[#7a66c0]
                                    text-white shadow-sm shadow-[#7a66c0]/25`,
                                  `border border-[#9784d8]/40 bg-transparent text-[#7a66c0] hover:bg-[#9784d8]/10 dark:border-[#a99ad6]/30 dark:text-[#a99ad6]`,
                                ],
                              ] as const
                            ).map(([value, label, on, idle]) => (
                              <button
                                key={value}
                                type="button"
                                aria-pressed={chosen === value}
                                onClick={() => {
                                  setChoice(row.id, {
                                    status: chosen === value ? null : value,
                                  });
                                  if (value === "partial" && chosen !== value) {
                                    setFocusId(row.id);
                                  }
                                }}
                                className={cn(
                                  `rounded-full text-sm font-bold lowercase
                                    transition-all duration-200
                                    active:scale-[0.97]`,
                                  chosen === value ? on : idle,
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
                                  ? `bg-linear-to-br from-orange-400
                                    to-orange-600 text-white shadow-sm
                                    shadow-orange-500/25`
                                  : `border border-orange-300/70 bg-transparent
                                    text-orange-700/80 hover:bg-orange-500/10
                                    dark:border-orange-400/30
                                    dark:text-orange-300/80`,
                              )}
                            >
                              <Undo2 className="size-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {chosen === "partial" && (
                      <>
                        <label
                          className="mt-2 flex h-11 cursor-text items-center
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
                            type="text"
                            inputMode="decimal"
                            placeholder="0"
                            id={`partial-amount-${row.id}`}
                            aria-label="Amount paid"
                            autoFocus={focusId === row.id}
                            autoComplete="off"
                            onFocus={(e) => e.currentTarget.select()}
                            value={formatAmount(choice?.amount ?? "")}
                            onChange={(e) =>
                              setChoice(row.id, {
                                amount: cleanAmount(e.target.value),
                              })
                            }
                            className="min-w-0 flex-1 bg-transparent text-base
                              font-bold tabular-nums outline-none"
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
                        {/* Quick amounts, as shares of what is left. */}
                        <div className="mt-2 grid grid-cols-4 gap-1.5">
                          {(
                            [
                              [25, "25%"],
                              [50, "half"],
                              [75, "75%"],
                              [100, "full"],
                            ] as const
                          ).map(([pct, label]) => {
                            const amount = Math.round(remaining * pct) / 100;
                            const picked =
                              Number.parseFloat(choice?.amount || "0") ===
                              amount;
                            return (
                              <button
                                key={pct}
                                type="button"
                                onClick={() =>
                                  setChoice(row.id, { amount: String(amount) })
                                }
                                aria-label={`Pay ${label} of what is left, ₱${amount.toLocaleString()}`}
                                className={cn(
                                  `h-8 rounded-full text-xs font-bold lowercase
                                    transition active:scale-95`,
                                  pct === 100
                                    ? picked
                                      ? `bg-linear-to-br from-emerald-400
                                        to-emerald-500 text-white shadow-sm
                                        shadow-emerald-500/25`
                                      : `border border-emerald-300/70
                                        bg-transparent text-emerald-700/80
                                        hover:bg-emerald-500/10
                                        dark:border-emerald-400/30
                                        dark:text-emerald-300/80`
                                    : picked
                                      ? `bg-linear-to-br from-[#9784d8]
                                        to-[#7a66c0] text-white shadow-sm
                                        shadow-[#7a66c0]/25`
                                      : `border border-[#9784d8]/40
                                        bg-transparent text-[#7a66c0]
                                        hover:bg-[#9784d8]/10
                                        dark:border-[#a99ad6]/30
                                        dark:text-[#a99ad6]`,
                                )}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                        {(() => {
                          const typed = Number.parseFloat(
                            choice?.amount || "0",
                          );
                          const ok = Number.isFinite(typed) && typed > 0;
                          const shown = Math.min(
                            Math.round(typed * 100) / 100,
                            remaining,
                          );
                          // The whole balance settles it: pay in full, in green.
                          const isFull = ok && typed >= remaining;
                          return (
                            <button
                              type="button"
                              disabled={!ok || busyId !== null}
                              onClick={() => void addNow(row)}
                              className={cn(
                                `mt-2 flex h-10 w-full items-center
                                  justify-center gap-1.5 rounded-full bg-linear-to-br
                                  text-sm font-bold text-white lowercase shadow-sm
                                  transition active:scale-[0.98] disabled:opacity-40`,
                                isFull
                                  ? "from-emerald-400 to-emerald-500 shadow-emerald-500/25"
                                  : "from-[#9784d8] to-[#7a66c0] shadow-[#7a66c0]/25",
                              )}
                            >
                              {isFull ? (
                                <Check className="size-4" strokeWidth={3} />
                              ) : (
                                <Plus className="size-4" strokeWidth={3} />
                              )}
                              {busyId === row.id
                                ? isFull
                                  ? "paying…"
                                  : "adding…"
                                : isFull
                                  ? `pay full ₱${shown.toLocaleString()}`
                                  : ok
                                    ? `add ₱${shown.toLocaleString()} now`
                                    : "add now"}
                            </button>
                          );
                        })()}
                      </>
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
        className="flex h-8 shrink-0 items-center gap-1 rounded-full border
          border-emerald-300/70 bg-transparent px-3 text-xs font-bold
          text-emerald-700/80 lowercase transition hover:bg-emerald-500/10
          active:scale-95 dark:border-emerald-400/30 dark:text-emerald-300/80"
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
        className="h-12 rounded-xl font-bold lowercase"
      >
        Cancel
      </Button>
      <Button
        size="lg"
        onClick={handleConfirm}
        disabled={loading || submitting}
        variant={undoOnly ? "destructive" : "default"}
        className={cn(
          "h-12 flex-1 rounded-xl text-base font-black lowercase",
          !undoOnly &&
            `border-0 bg-linear-to-br from-emerald-500 to-emerald-700 text-white
            shadow-sm shadow-emerald-700/30 hover:opacity-95`,
        )}
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
