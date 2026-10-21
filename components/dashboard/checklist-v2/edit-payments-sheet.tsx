"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRecordPayments } from "@/components/dashboard/checklist/use-record-payments";
import { formatShortDate } from "@/lib/checklist/labels";
import { overdueCutoffDateValue, todayDateValue } from "@/lib/checklist/dates";
import {
  buildEditPlan,
  canSaveEdit,
  cardTarget,
  editButtonLabel,
  editFailureMessages,
  editUndoFailureMessages,
  recordedCards,
} from "@/lib/checklist/edit-payments";
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
import { recordInSteps } from "@/components/dashboard/checklist-v2/record-steps";
import {
  AmountInput,
  BorrowerTitle,
  SheetListSkeleton,
} from "@/components/dashboard/checklist-v2/sheet-parts";

/** The edit toast and its Undo (Global Constraints: 6000 ms). */
const EDIT_TOAST_MS = 6000;

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Edit recorded payments: one card per installment with money on it, an
 * amount input plus "Paid in full" and "Not paid". `ScheduleCheckDialog` in
 * edit mode, as a sheet. Saving leaves the tick alone unless nothing is paid
 * any more, then it unticks.
 *
 * Render it inside `Sheet`, keyed per open, so each open starts clean.
 */
export function EditPaymentsSheet({
  row,
  setChecked,
  onClose,
  onOpenBorrower,
}: {
  row: RowView;
  setChecked(ids: string[], checked: boolean): void;
  onClose(): void;
  onOpenBorrower(): void;
}) {
  const lineIds = useMemo(() => row.lines.map((l) => l.id), [row.lines]);
  const live = useLiveSchedules(lineIds);
  /** Only the amounts typed so far; the rest show what is recorded. */
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const recordPayments = useRecordPayments();

  const cards = recordedCards(live.rows, lineIds);
  const amounts = Object.fromEntries(
    cards.map((c) => [c.row.id, typed[c.row.id] ?? String(c.recorded)]),
  );
  const edit = buildEditPlan(cards, amounts, overdueCutoffDateValue());
  const recordedNow = cards.reduce((sum, c) => sum + c.recorded, 0);

  const name = rowName(row);
  const borrowerId = row.model?.borrower?.id ?? null;
  const lineById = new Map(row.lines.map((l) => [l.id, l]));
  const loaded = new Set(live.rows.map((r) => r.id));
  const allLoaded = lineIds.every((id) => loaded.has(id));
  const { data: summaries, isPending: summariesPending } =
    useAccountSummaries(lineIds);
  const cardAccounts = [...new Set(cards.map((c) => c.row.account_id))];
  // Manual accounts (or ones that couldn't be checked) are only changed on
  // the account page: a reset would orphan a rolled-over schedule or turn a
  // recorded payment into money owed.
  const heldBack =
    summariesPending && !summaries
      ? null
      : heldBackPointer(cardAccounts, summaries);
  const checking = summariesPending && !summaries && cards.length > 0;
  const locked = checking || heldBack !== null;
  const ready = live.status === "ready";
  const canSave = ready && !submitting && !locked && canSaveEdit(edit);

  const save = async () => {
    if (!canSave || locked) return;
    // Everything is read now: the sheet closes as soon as the change shows.
    const itemId = row.item.id;
    // Untick only when nothing on the row is paid any more. An installment
    // that couldn't be loaded might still be paid, so then leave the tick.
    const untick = edit.removesAll && allLoaded && row.item.is_checked;
    const base = {
      accountIds: edit.accountIds,
      borrowerId,
      paymentDate: todayDateValue(),
    };
    const failure = editFailureMessages(edit, peso);
    const undoFailure = editUndoFailureMessages(edit, peso);
    let toastId: string | number | undefined;
    /** The save's result; set before the toast (and its Undo) shows. */
    let saved: Promise<{ failedAt: number | null }> | null = null;

    const undo = async () => {
      // Never let the undo race the save it takes back, and only take back
      // a save that fully went through.
      if (!saved || (await saved).failedAt !== null) return;
      const { failedAt } = await recordInSteps(recordPayments, base, [
        { plan: edit.undo.reset, failureMessage: undoFailure.reset },
        { plan: edit.undo.restore, failureMessage: undoFailure.restore },
      ]);
      // The money is back on the row only when both steps went through.
      if (failedAt === null && untick) setChecked([itemId], true);
    };

    setSubmitting(true);
    try {
      saved = recordInSteps(recordPayments, base, [
        {
          // Resets the lowered installments, adds to the raised ones.
          plan: edit.first,
          failureMessage: failure.first,
          onApplied: () => {
            toastId = toast(
              edit.removesAll
                ? `${name} · payment removed`
                : `${name} · ${peso(edit.total)} paid`,
              {
                duration: EDIT_TOAST_MS,
                action: { label: "Undo", onClick: () => void undo() },
              },
            );
            onClose();
          },
          onFailed: () => {
            if (toastId !== undefined) toast.dismiss(toastId);
          },
          // Unticks only once the payments are really gone.
          onDone: () => {
            if (untick) setChecked([itemId], false);
          },
        },
        {
          // The new, lower amounts, on the installments just reset.
          plan: edit.then,
          failureMessage: failure.then,
          onFailed: () => {
            if (toastId !== undefined) toast.dismiss(toastId);
          },
        },
      ]);
      await saved;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="px-5 pt-2 pb-3">
        <BorrowerTitle
          name={name}
          onOpen={borrowerId ? onOpenBorrower : undefined}
        />
        <p className="text-sm text-muted-foreground">
          {ready || live.rows.length > 0
            ? `Recorded payments · ${peso(recordedNow)}`
            : "Loading…"}
        </p>

        <div className="mt-3">
          {live.status === "error" ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Couldn&apos;t load the payments. Try again when online.
            </p>
          ) : live.rows.length === 0 && !ready ? (
            <SheetListSkeleton />
          ) : cards.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No payments recorded here.
            </p>
          ) : (
            <ul className="space-y-2">
              {cards.map((card) => {
                const id = card.row.id;
                const line = lineById.get(id);
                const kind = sentence(kindLabel(line?.type ?? ""));
                const date = formatShortDate(card.row.due_date).toLowerCase();
                const target = cardTarget(card, amounts[id]);
                return (
                  <li
                    key={id}
                    className="rounded-xl border border-border bg-background
                      p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{kind}</p>
                        <p className="text-xs text-muted-foreground">
                          {date} · due {peso(card.due)}
                        </p>
                      </div>
                      <AmountInput
                        disabled={locked}
                        value={amounts[id]}
                        onChange={(v) => setTyped((t) => ({ ...t, [id]: v }))}
                        label={`Amount paid for ${kind.toLowerCase()} ${date}`}
                        invalid={target === null}
                        className="w-32 shrink-0"
                      />
                    </div>
                    {target === null && (
                      <p
                        className="mt-1 text-right text-[11px] text-destructive"
                      >
                        Not a number
                      </p>
                    )}
                    <div className="mt-2 flex gap-2">
                      <ShortcutChip
                        disabled={locked}
                        active={target === card.due}
                        onClick={() =>
                          setTyped((t) => ({ ...t, [id]: String(card.due) }))
                        }
                      >
                        Paid in full
                      </ShortcutChip>
                      <ShortcutChip
                        disabled={locked}
                        active={target === 0}
                        onClick={() => setTyped((t) => ({ ...t, [id]: "0" }))}
                      >
                        Not paid
                      </ShortcutChip>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {heldBack && cards.length > 0 && (
            <p
              className="mt-3 rounded-lg bg-amber-500/10 p-3 text-sm
                text-amber-800 dark:text-amber-300"
              role="note"
            >
              {heldBack}.{" "}
              {borrowerId && (
                <button
                  type="button"
                  onClick={onOpenBorrower}
                  className="font-semibold underline underline-offset-2"
                >
                  Open the borrower page
                </button>
              )}
            </p>
          )}
        </div>
      </div>

      <SheetFooter>
        <Button
          size="lg"
          variant={edit.removesAll && edit.changed ? "destructive" : "default"}
          disabled={!canSave}
          onClick={() => void save()}
          className="h-12 w-full text-base"
        >
          {live.status === "loading" || checking
            ? "Loading…"
            : live.status === "error"
              ? "Couldn't load"
              : heldBack && cards.length > 0
                ? "Change it on the account page"
                : editButtonLabel(edit, peso)}
        </Button>
      </SheetFooter>
    </>
  );
}

function ShortcutChip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick(): void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        `shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium
        transition-colors active:scale-95 disabled:opacity-50`,
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}
