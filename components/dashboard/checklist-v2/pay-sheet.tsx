"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AccountSummaryHeader } from "@/components/dashboard/checklist/payment-dialogs";
import { useRecordPayments } from "@/components/dashboard/checklist/use-record-payments";
import type { ScheduleDialogRow } from "@/lib/checklist/schedule-cache";
import {
  amountPaidOnInstallment,
  remainingOnInstallment,
} from "@/lib/payment-schedule/schedule-balances";
import { formatShortDate } from "@/lib/checklist/labels";
import { overdueCutoffDateValue, todayDateValue } from "@/lib/checklist/dates";
import { cents } from "@/lib/checklist/amount-input";
import {
  buildPaySheet,
  payButtonLabel,
  payFailureMessage,
} from "@/lib/checklist/pay-sheet";
import type { RowView } from "@/lib/checklist/row-state";
import { SheetFooter } from "@/components/dashboard/checklist-v2/sheet";
import { peso } from "@/components/dashboard/checklist-v2/header";
import {
  kindLabel,
  rowName,
} from "@/components/dashboard/checklist-v2/collect-row";
import {
  useAccountSummaries,
  useLiveSchedules,
} from "@/components/dashboard/checklist-v2/use-live-schedules";
import { heldBackPointer } from "@/lib/checklist/manual-accounts";
import {
  recordInSteps,
  undoAction,
} from "@/components/dashboard/checklist-v2/record-steps";
import {
  AmountInput,
  BorrowerTitle,
  SheetListSkeleton,
} from "@/components/dashboard/checklist-v2/sheet-parts";

/** The pay toast and its Undo (Global Constraints: 6000 ms for pay). */
const PAY_TOAST_MS = 6000;

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The pay sheet: one block per account (its summary header, then its open
 * installments, all ticked). Untick one to leave it unpaid; "Pay a different
 * amount" turns the amounts into inputs. `ScheduleCheckDialog` in check mode,
 * as a sheet: the same plan, actions and cache helpers.
 *
 * Render it inside `Sheet`, keyed per open, so each open starts clean.
 */
export function PaySheet({
  row,
  startPartial,
  setChecked,
  onClose,
  onEditRecorded,
  onOpenBorrower,
  onMore,
}: {
  row: RowView;
  /** Opened from the swipe's Partial: start with the amount inputs. */
  startPartial: boolean;
  setChecked(ids: string[], checked: boolean): void;
  onClose(): void;
  onEditRecorded(): void;
  onOpenBorrower(): void;
  onMore(): void;
}) {
  const lineIds = useMemo(() => row.lines.map((l) => l.id), [row.lines]);
  const live = useLiveSchedules(lineIds);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [custom, setCustom] = useState(startPartial);
  /** Only the amounts typed so far; the rest show what is left. */
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const recordPayments = useRecordPayments();

  const amountOf = (r: ScheduleDialogRow) =>
    typed[r.id] ?? String(cents(remainingOnInstallment(r)));
  const amounts = Object.fromEntries(live.rows.map((r) => [r.id, amountOf(r)]));
  const pay = buildPaySheet({
    rows: live.rows,
    lineIds,
    picked,
    custom,
    amounts,
    overdueCutoff: overdueCutoffDateValue(),
  });

  const { data: summaries, isPending: summariesPending } =
    useAccountSummaries(lineIds);

  const byAccount = new Map<string, ScheduleDialogRow[]>();
  for (const r of pay.open) {
    const list = byAccount.get(r.account_id) ?? [];
    list.push(r);
    byAccount.set(r.account_id, list);
  }
  const groups = [...byAccount.entries()];

  const name = rowName(row);
  const borrowerId = row.model?.borrower?.id ?? null;
  const lineById = new Map(row.lines.map((l) => [l.id, l]));
  const openLeft = cents(
    pay.open.reduce((sum, r) => sum + cents(remainingOnInstallment(r)), 0),
  );
  const hasRecorded = live.rows.some(
    (r) => r.status === "paid" || amountPaidOnInstallment(r) > 0,
  );
  const loaded = new Set(live.rows.map((r) => r.id));
  const missing = lineIds.filter((id) => !loaded.has(id)).length;
  const ready = live.status === "ready";
  const canRecord =
    ready && !submitting && pay.total > 0 && pay.invalidIds.length === 0;

  const record = async () => {
    if (!canRecord) return;
    // Everything is read now: the sheet closes as soon as the pay shows.
    const itemId = row.item.id;
    // Tick only when this pay newly settles the row.
    const tick = pay.settlesRow && !row.item.is_checked;
    const base = {
      accountIds: pay.accountIds,
      borrowerId,
      paymentDate: todayDateValue(),
    };
    const restored = cents(
      pay.undo.restore.payments.reduce((sum, p) => sum + p.amount, 0),
    );
    let toastId: string | number | undefined;
    /** The pay's server result; set before the toast (and its Undo) shows. */
    let paid: Promise<"saved" | "queued" | "failed"> | null = null;
    // A manual account's pay (or one whose account couldn't be checked) is
    // never reset from here: no Undo, the account page instead.
    const heldBack = heldBackPointer(pay.accountIds, summaries);

    const undo = async (onStart: () => void) => {
      // Never let the reset race the pay it takes back.
      if (!paid || (await paid) === "failed") return;
      const result = await recordInSteps(
        recordPayments,
        base,
        [
          {
            plan: pay.undo.reset,
            failureMessage: "Couldn't undo — the payment is still recorded",
            // Still paid after a refusal: the tick stays.
            onDone: () => {
              if (tick) setChecked([itemId], false);
            },
          },
          {
            plan: pay.undo.restore,
            failureMessage: `Couldn't put back the earlier ${peso(
              restored,
            )} payment — re-enter it`,
          },
        ],
        { onStart, action: "undo" },
      );
      // The reset may not have happened: it is still paid, so tick it again.
      if (result.heldBack === "unconfirmed" && tick) setChecked([itemId], true);
      return result;
    };

    setSubmitting(true);
    try {
      paid = recordPayments({
        ...base,
        plan: pay.plan,
        failureMessage: payFailureMessage(pay.calls),
        onApplied: () => {
          if (tick) setChecked([itemId], true);
          toastId = toast(
            `${name} · ${peso(pay.total)} paid`,
            heldBack
              ? { duration: PAY_TOAST_MS, description: heldBack }
              : {
                  duration: PAY_TOAST_MS,
                  action: undoAction(undo, () => {
                    if (toastId !== undefined) toast.dismiss(toastId);
                  }),
                },
          );
          onClose();
        },
        onFailed: () => {
          if (tick) setChecked([itemId], false);
          if (toastId !== undefined) toast.dismiss(toastId);
        },
      });
      await paid;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="px-5 pt-2 pb-3">
        <div className="flex items-start justify-between gap-3">
          <BorrowerTitle
            name={name}
            onOpen={borrowerId ? onOpenBorrower : undefined}
          />
          <button
            type="button"
            onClick={onMore}
            className="shrink-0 pt-1 text-sm font-medium text-muted-foreground
              active:opacity-70"
          >
            More
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          {ready || live.rows.length > 0 ? (
            <>
              {pay.open.length} installment{pay.open.length === 1 ? "" : "s"} ·{" "}
              {peso(openLeft)} due
            </>
          ) : (
            "Loading…"
          )}
        </p>

        <div className="mt-3">
          {live.status === "error" ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Couldn&apos;t load this payment. Try again when online.
            </p>
          ) : live.rows.length === 0 && !ready ? (
            <SheetListSkeleton />
          ) : pay.open.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing left to pay here.
            </p>
          ) : (
            <ul className="space-y-2">
              {groups.map(([accountId, accountRows]) => {
                const summary = summaries?.[accountId] ?? null;
                return (
                  <li
                    key={accountId}
                    className="space-y-2.5 rounded-2xl bg-muted/40 p-3"
                  >
                    {summary ? (
                      <AccountSummaryHeader
                        summary={summary}
                        pending={
                          pay.pendingByAccount[accountId] ?? {
                            paidAmount: 0,
                            partialAmount: 0,
                            installments: 0,
                            undoAmount: 0,
                            undoInstallments: 0,
                          }
                        }
                      />
                    ) : summariesPending ? (
                      <div className="space-y-1.5">
                        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                        <div
                          className="h-1.5 animate-pulse rounded-full bg-muted"
                        />
                      </div>
                    ) : null}
                    {accountRows.map((r) => {
                      const on = picked[r.id] !== false;
                      const line = lineById.get(r.id);
                      const kind = sentence(kindLabel(line?.type ?? ""));
                      const late =
                        line?.overdue && line.daysOverdue > 0
                          ? line.daysOverdue
                          : 0;
                      const paidSoFar = amountPaidOnInstallment(r);
                      // Centavos, as the plan compares them.
                      const left = cents(remainingOnInstallment(r));
                      const invalid = pay.invalidIds.includes(r.id);
                      const clamped = pay.clampedIds.includes(r.id);
                      const toggle = () =>
                        setPicked((p) => ({ ...p, [r.id]: !on }));
                      return (
                        <div
                          key={r.id}
                          className={cn(
                            `flex items-center gap-3 rounded-xl border p-3
                              transition-colors`,
                            on
                              ? "border-primary/40 bg-primary/5"
                              : "border-border bg-background",
                          )}
                        >
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={on}
                            aria-label={`Pay ${kind.toLowerCase()} ${formatShortDate(
                              r.due_date,
                            ).toLowerCase()}, ${peso(left)} left`}
                            onClick={toggle}
                            className="flex min-w-0 flex-1 items-center gap-3
                              text-left"
                          >
                            <span
                              className={cn(
                                `flex size-5 shrink-0 items-center
                                  justify-center rounded-md border`,
                                on
                                  ? `border-primary bg-primary
                                    text-primary-foreground`
                                  : "border-muted-foreground/40",
                              )}
                            >
                              {on && (
                                <Check className="size-3.5" strokeWidth={3} />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium">
                                {kind}
                              </span>
                              <span
                                className="block text-xs text-muted-foreground"
                              >
                                {formatShortDate(r.due_date).toLowerCase()}
                                {late > 0 && (
                                  <span
                                    className="text-rose-600 dark:text-rose-400"
                                  >
                                    {" "}
                                    · {late}d late
                                  </span>
                                )}
                                {paidSoFar > 0 &&
                                  ` · ${peso(paidSoFar)} already paid`}
                              </span>
                            </span>
                            {!custom && (
                              <span
                                className="shrink-0 text-sm font-semibold
                                  tabular-nums"
                              >
                                {peso(left)}
                              </span>
                            )}
                          </button>
                          {custom && (
                            <div className="w-28 shrink-0 space-y-0.5">
                              <AmountInput
                                value={amountOf(r)}
                                onChange={(v) =>
                                  setTyped((t) => ({ ...t, [r.id]: v }))
                                }
                                label={`Amount for ${kind.toLowerCase()} ${formatShortDate(
                                  r.due_date,
                                ).toLowerCase()}`}
                                invalid={on && invalid}
                              />
                              <p
                                className={cn(
                                  "text-right text-[11px] tabular-nums",
                                  on && invalid
                                    ? "text-destructive"
                                    : on && clamped
                                      ? "text-amber-600 dark:text-amber-400"
                                      : "text-muted-foreground",
                                )}
                              >
                                {on && invalid
                                  ? "Not a number"
                                  : `of ${peso(left)}`}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </li>
                );
              })}
            </ul>
          )}
          {ready && missing > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {missing === 1
                ? "1 installment couldn't be found — it may have been removed."
                : `${missing} installments couldn't be found — they may have been removed.`}
            </p>
          )}
        </div>

        <div className="mt-3 flex flex-col items-start gap-1">
          {pay.open.length > 0 && (
            <button
              type="button"
              onClick={() => setCustom((v) => !v)}
              className="text-sm font-medium text-primary active:opacity-70"
            >
              {custom ? "Use full amounts" : "Pay a different amount"}
            </button>
          )}
          {hasRecorded && (
            <button
              type="button"
              onClick={onEditRecorded}
              className="text-sm font-medium text-muted-foreground
                active:opacity-70"
            >
              Edit recorded payments
            </button>
          )}
        </div>
      </div>

      <SheetFooter>
        <Button
          size="lg"
          disabled={!canRecord}
          onClick={() => void record()}
          className="h-12 w-full text-base"
        >
          {live.status === "loading"
            ? "Loading…"
            : live.status === "error"
              ? "Couldn't load"
              : payButtonLabel(pay, peso)}
        </Button>
      </SheetFooter>
    </>
  );
}
