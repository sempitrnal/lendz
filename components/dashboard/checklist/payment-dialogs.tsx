"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  markSchedulesPaidAction,
  applyPartialPaymentAction,
} from "@/lib/actions/schedules";
import { remainingOnInstallment } from "@/lib/payment-schedule/schedule-balances";
import {
  borrowerDetailsQueryKey,
  fetchBorrowerDetails,
  useInvalidateBorrowerDetails,
  type BorrowerDetailsResponse,
} from "@/lib/hooks/use-borrower-details";
import {
  borrowerCategoryColor,
  extractBorrowerMention,
  extractScheduleRefs,
  formatShortDate,
} from "@/lib/checklist/labels";
import { todayDateValue } from "@/lib/checklist/dates";
import { MentionPill } from "@/components/dashboard/checklist/checklist-label";
import { useBorrowersSearch } from "@/hooks/use-borrowers-search";
import type { DailyChecklistItem } from "@/lib/checklist/types";

type ScheduleDialogRow = {
  id: string;
  account_id: string;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  remaining_amount: number;
  status: string;
};

type ScheduleChoice = { status: "paid" | "partial" | null; amount: string };

type AccountSummary = {
  typeLabel: string;
  isCashAdvance: boolean;
  paid: number;
  left: number;
  pct: number;
  paidInstallments: number;
  installmentCount: number;
};

function accountSummary(
  details: BorrowerDetailsResponse | undefined,
  accountId: string,
): AccountSummary | null {
  const account = details?.accounts.find((a) => a.id === accountId);
  const m = details?.metrics[accountId] as
    | {
        totalPaid?: number;
        amountLeftToPay?: number;
        paidInstallments?: number;
        installmentCount?: number;
      }
    | undefined;
  if (!account || !m) return null;
  const isCashAdvance = account.type === "cash_advance";
  const base = isCashAdvance ? "cash advance" : "loan";
  const typeLabel =
    account.schedule_mode === "manual"
      ? `${base} · manual ${account.interest_type === "rolling" ? "rolling" : "flat"}`
      : base;
  const paid = Number(m.totalPaid ?? 0);
  const left = Number(m.amountLeftToPay ?? 0);
  const total = paid + left;
  return {
    typeLabel,
    isCashAdvance,
    paid,
    left,
    pct: total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0,
    paidInstallments: Number(m.paidInstallments ?? 0),
    installmentCount: Number(m.installmentCount ?? 0),
  };
}

type PendingPayment = {
  paidAmount: number;
  partialAmount: number;
  installments: number;
};

/** What the selected Paid/Partial choices would add to an account. */
function pendingPayment(
  rows: ScheduleDialogRow[],
  choices: Record<string, ScheduleChoice>,
): PendingPayment {
  let paidAmount = 0;
  let partialAmount = 0;
  let installments = 0;
  for (const row of rows) {
    const choice = choices[row.id];
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
  return { paidAmount, partialAmount, installments };
}

function AccountSummaryHeader({
  summary,
  pending,
}: {
  summary: AccountSummary;
  pending: PendingPayment;
}) {
  const total = summary.paid + summary.left;
  const paidAdded = Math.min(pending.paidAmount, summary.left);
  const partialAdded = Math.min(
    pending.partialAmount,
    summary.left - paidAdded,
  );
  const added = paidAdded + partialAdded;
  const changed = added > 0;
  const paid = summary.paid + added;
  const left = Math.max(0, summary.left - added);
  const share = (amount: number) => (total > 0 ? (amount / total) * 100 : 0);
  const pct = Math.round(Math.min(100, share(paid)));
  const paidInstallments = Math.min(
    summary.installmentCount,
    summary.paidInstallments + pending.installments,
  );
  const highlight = changed
    ? "font-semibold text-emerald-600 dark:text-emerald-400"
    : "";

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
              pending.installments > 0
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
          style={{ width: `${share(summary.paid)}%` }}
        />
        <div
          className="h-full bg-emerald-500/30 transition-[width] duration-300"
          style={{ width: `${share(paidAdded)}%` }}
        />
        <div
          className="h-full bg-violet-500/35 transition-[width] duration-300"
          style={{ width: `${share(partialAdded)}%` }}
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
 * before the item is actually checked.
 */
export function ScheduleCheckDialog({
  item,
  onClose,
  onConfirmed,
}: {
  item: DailyChecklistItem | null;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const [rows, setRows] = useState<ScheduleDialogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [choices, setChoices] = useState<Record<string, ScheduleChoice>>({});
  const [submitting, setSubmitting] = useState(false);
  const refs = useMemo(
    () => (item ? extractScheduleRefs(item.label) : []),
    [item?.id, item?.label],
  );
  const borrower = useMemo(
    () => (item ? extractBorrowerMention(item.label) : null),
    [item?.id, item?.label],
  );
  const borrowerName = borrower?.name;
  const { data: borrowers = [] } = useBorrowersSearch();
  const borrowerColor = useMemo(
    () => borrowerCategoryColor(borrowers.find((b) => b.id === borrower?.id)),
    [borrowers, borrower?.id],
  );
  const invalidateBorrowerDetails = useInvalidateBorrowerDetails();
  const open = refs.length > 0;
  const { data: details, isPending: detailsPending } = useQuery({
    queryKey: borrowerDetailsQueryKey(borrower?.id ?? ""),
    queryFn: () => fetchBorrowerDetails(borrower!.id),
    enabled: open && !!borrower,
    // Show cached numbers instantly but refresh each time the dialog opens.
    staleTime: 0,
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
    setLoading(true);
    supabase
      .from("payment_schedules")
      .select(
        "id, account_id, due_date, amount_due, amount_paid, remaining_amount, status",
      )
      .in(
        "id",
        refs.map((r) => r.id),
      )
      .then(
        ({
          data,
          error,
        }: {
          data: ScheduleDialogRow[] | null;
          error: { message: string } | null;
        }) => {
          if (cancelled) return;
          if (error) {
            toast.error(error.message);
            setRows([]);
            setChoices({});
          } else {
            const order = new Map(refs.map((r, i) => [r.id, i]));
            const fetched = ((data ?? []) as ScheduleDialogRow[]).sort(
              (a, b) =>
                (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0) ||
                a.due_date.localeCompare(b.due_date),
            );
            setRows(fetched);
            const initial: Record<string, ScheduleChoice> = {};
            fetched.forEach((r) => {
              initial[r.id] = {
                status: null,
                amount: String(remainingOnInstallment(r)),
              };
            });
            setChoices(initial);
          }
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

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const paidIds = rows
        .filter(
          (row) => choices[row.id]?.status === "paid" && row.status !== "paid",
        )
        .map((row) => row.id);
      await Promise.all([
        paidIds.length > 0
          ? markSchedulesPaidAction(paidIds, todayDateValue())
          : Promise.resolve(),
        ...rows.map(async (row) => {
          const choice = choices[row.id];
          if (!choice?.status || choice.status === row.status) return;
          if (choice.status === "partial") {
            const amt = Number.parseFloat(choice.amount || "0");
            if (!Number.isFinite(amt) || amt <= 0) return;
            const fd = new FormData();
            fd.set("scheduleId", row.id);
            fd.set("paymentAmount", String(amt));
            fd.set("paymentDate", todayDateValue());
            await applyPartialPaymentAction(fd);
          }
        }),
      ]);
      if (borrower) invalidateBorrowerDetails(borrower.id);
      toast.success("Payment schedule updated");
      onConfirmed();
    } catch (err) {
      console.error("ScheduleCheckDialog confirm error:", err);
      toast.error("Failed to update payment schedule");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
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
            <DialogTitle
              className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xl
                font-semibold tracking-tight"
            >
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
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Mark {borrowerName ? `${borrowerName}'s` : "the"} linked
              collection{rows.length === 1 ? "" : "s"} as paid or partial before
              checking this off.
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
                className="w-full cursor-pointer rounded-md border
                  border-emerald-500 bg-emerald-50 px-2 py-1.5 text-xs font-bold
                  tracking-wide text-emerald-900 uppercase transition
                  hover:bg-emerald-100 dark:border-emerald-400/50
                  dark:bg-emerald-400/10 dark:text-emerald-200"
              >
                Mark all paid
              </button>
            )}
            {accountGroups.map((group) => {
              const summary = accountSummary(details, group.accountId);
              return (
                <div
                  key={group.accountId}
                  className="dark:border-border dark:bg-card dark:divide-border
                    divide-y divide-slate-200 rounded-lg border border-slate-200
                    bg-white"
                >
                  {summary ? (
                    <div className="p-3">
                      <AccountSummaryHeader
                        summary={summary}
                        pending={pendingPayment(group.rows, choices)}
                      />
                    </div>
                  ) : borrower && detailsPending ? (
                    <div className="space-y-1.5 p-3">
                      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                      <div className="h-1.5 animate-pulse rounded-full bg-muted" />
                    </div>
                  ) : null}
                  {group.rows.map((row) => {
                    const choice = choices[row.id];
                    const chosen = choice?.status ?? null;
                    return (
                      <div key={row.id} className="p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="text-sm font-semibold text-slate-700
                              dark:text-foreground"
                          >
                            {formatShortDate(row.due_date)}
                          </span>
                          <span
                            className="text-sm text-slate-500
                              dark:text-muted-foreground"
                          >
                            ₱{remainingOnInstallment(row).toLocaleString()} due
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setChoice(row.id, {
                                status: chosen === "paid" ? null : "paid",
                              })
                            }
                            disabled={row.status === "paid"}
                            className={`rounded-md border px-2 py-1.5 text-xs
                              font-bold tracking-wide uppercase transition ${
                                chosen === "paid"
                                  ? `border-emerald-500 bg-emerald-200
                                    text-emerald-950 dark:border-emerald-400/50
                                    dark:bg-emerald-400/25
                                    dark:text-emerald-200`
                                  : `border-slate-300 bg-white text-slate-600
                                    hover:border-emerald-500 hover:bg-emerald-50
                                    dark:border-border dark:bg-card
                                    dark:text-muted-foreground`
                              } ${
                                row.status === "paid"
                                  ? "cursor-not-allowed opacity-60"
                                  : "cursor-pointer"
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
                            className={`cursor-pointer rounded-md border px-2
                              py-1.5 text-xs font-bold tracking-wide uppercase
                              transition ${
                                chosen === "partial"
                                  ? `border-violet-500 bg-violet-200
                                    text-violet-950 dark:border-violet-400/50
                                    dark:bg-violet-400/25 dark:text-violet-200`
                                  : `border-slate-300 bg-white text-slate-600
                                    hover:border-violet-500 hover:bg-violet-50
                                    dark:border-border dark:bg-card
                                    dark:text-muted-foreground`
                              }`}
                          >
                            Partial
                          </button>
                        </div>
                        {chosen === "partial" && (
                          <label
                            className="mt-2 flex cursor-text items-center
                              gap-1.5 rounded-md border border-slate-300
                              bg-white px-2.5 py-1.5 transition-colors
                              focus-within:border-violet-400 focus-within:ring-3
                              focus-within:ring-violet-500/15 dark:border-border
                              dark:bg-background
                              dark:focus-within:border-violet-400/60"
                          >
                            <span
                              className="text-sm font-semibold
                                text-muted-foreground"
                            >
                              ₱
                            </span>
                            <input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              max={remainingOnInstallment(row)}
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
                                Number.parseFloat(choice?.amount || "0") >
                                remainingOnInstallment(row)
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-muted-foreground"
                                }`}
                            >
                              of ₱{remainingOnInstallment(row).toLocaleString()}
                            </span>
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={loading || submitting}>
            {submitting ? "Saving…" : "Confirm & check off"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type BulkPaidRow = {
  id: string;
  amount_due: number | null;
  amount_paid: number | null;
  remaining_amount: number | null;
  status: string;
};

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
  const [rows, setRows] = useState<BulkPaidRow[]>([]);
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
      setLoading(true);
      const all: BulkPaidRow[] = [];
      for (let i = 0; i < ids.length; i += 50) {
        const { data, error } = await supabase
          .from("payment_schedules")
          .select("id, amount_due, amount_paid, remaining_amount, status")
          .in("id", ids.slice(i, i + 50));
        if (error) {
          toast.error(error.message);
          break;
        }
        all.push(...((data ?? []) as BulkPaidRow[]));
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
    try {
      const result = await markSchedulesPaidAction(ids, paidDate);
      new Set(
        items.map((i) => extractBorrowerMention(i.label)?.id).filter(Boolean),
      ).forEach((id) => invalidateBorrowerDetails(id as string));
      toast.success(
        `Marked ${result.updated} collection${result.updated === 1 ? "" : "s"} paid`,
      );
      onConfirmed(items.map((i) => i.id));
    } catch (err) {
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
