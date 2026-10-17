"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { addManualScheduleAction } from "@/lib/actions/schedules";
import {
  formatShortDate,
  type ManualFlatAccount,
} from "@/lib/checklist/labels";
import { todayDateValue } from "@/lib/checklist/dates";
import type { AccountSummary } from "@/lib/checklist/schedule-cache";
import { useInvalidateBorrowerDetails } from "@/lib/hooks/use-borrower-details";
import { MentionPill } from "@/components/dashboard/checklist/checklist-label";
import {
  ACTION_BUTTON,
  AccountSummaryHeader,
  ENTER_ANIMATION,
  SCHEDULE_CARD,
} from "@/components/dashboard/checklist/payment-dialogs";

const OFF_BUTTON =
  "border-slate-300 bg-white text-slate-600 dark:border-border dark:bg-card dark:text-muted-foreground";

const FIELD_LABEL =
  "mb-1.5 block text-xs font-medium text-slate-500 dark:text-muted-foreground";

const DATE_INPUT =
  "w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-semibold text-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:border-border dark:bg-background dark:text-foreground";

/** Peso input styled like the partial-amount field in the update dialog. */
function PesoInput({
  value,
  onChange,
  label,
  hint,
  warn,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  hint?: string;
  warn?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <label
      className="flex cursor-text items-center gap-1.5 rounded-md border
        border-slate-300 bg-white px-2.5 py-1.5 transition-colors
        focus-within:border-slate-400 focus-within:ring-3
        focus-within:ring-slate-500/15 dark:border-border dark:bg-background"
    >
      <span className="text-sm font-semibold text-muted-foreground">₱</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step="0.01"
        placeholder="0"
        aria-label={label}
        autoFocus={autoFocus}
        onFocus={(e) => e.currentTarget.select()}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent text-base font-semibold
          text-slate-700 outline-none [appearance:textfield] sm:text-sm
          dark:text-foreground [&::-webkit-inner-spin-button]:appearance-none
          [&::-webkit-outer-spin-button]:appearance-none"
      />
      {hint && (
        <span
          className={`shrink-0 text-xs tabular-nums ${
            warn
              ? "text-amber-600 dark:text-amber-400"
              : "text-muted-foreground"
          }`}
        >
          {hint}
        </span>
      )}
    </label>
  );
}

/** "Today" or a picked date — the picker only shows once you ask for it. */
function DateChoice({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const today = todayDateValue();
  const [picking, setPicking] = useState(value !== today);
  return (
    <div>
      <span className={FIELD_LABEL}>{label}</span>
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => {
            setPicking(false);
            onChange(today);
          }}
          className={`${ACTION_BUTTON} ${
            !picking
              ? `border-slate-900 bg-slate-900 text-white dark:border-slate-100
                dark:bg-slate-100 dark:text-slate-900`
              : `${OFF_BUTTON} hover:border-slate-400`
            }`}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => setPicking(true)}
          className={`${ACTION_BUTTON} ${
            picking
              ? `border-slate-900 bg-slate-900 text-white dark:border-slate-100
                dark:bg-slate-100 dark:text-slate-900`
              : `${OFF_BUTTON} hover:border-slate-400`
            }`}
        >
          {picking && value !== today ? formatShortDate(value) : "Pick date"}
        </button>
      </div>
      {picking && (
        <input
          type="date"
          value={value}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className={`${DATE_INPUT} mt-1.5`}
        />
      )}
    </div>
  );
}

/**
 * Records a payment on a manual flat account from the daily notes `/next`
 * dropdown: amount and the date it was paid, saved as a paid schedule due
 * that day. Styled after the update payment status dialog.
 */
export function ManualPaymentDialog({
  account,
  borrower,
  onClose,
  onSaved,
}: {
  account: ManualFlatAccount | null;
  borrower: { id: string; name: string; color: string | null } | null;
  onClose: () => void;
  /** Called with the new schedule once it is saved. */
  onSaved: (schedule: { id: string }) => void;
}) {
  return (
    <Dialog
      open={!!account}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        {account && (
          // Keyed so each open starts from a fresh form.
          <ManualPaymentBody
            key={account.id}
            account={account}
            borrower={borrower}
            onClose={onClose}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ManualPaymentBody({
  account,
  borrower,
  onClose,
  onSaved,
}: {
  account: ManualFlatAccount;
  borrower: { id: string; name: string; color: string | null } | null;
  onClose: () => void;
  onSaved: (schedule: { id: string }) => void;
}) {
  const invalidateBorrowerDetails = useInvalidateBorrowerDetails();
  const [amount, setAmount] = useState("");
  const [paidDate, setPaidDate] = useState(todayDateValue());
  const [submitting, setSubmitting] = useState(false);

  const paid = Number.parseFloat(amount || "0");
  const amountOk = Number.isFinite(paid) && paid > 0;
  const overRemaining = amountOk && paid > account.remaining;
  const canSave = amountOk && !submitting;

  const isCashAdvance = account.type === "cash_advance";
  const summary: AccountSummary = {
    typeLabel: isCashAdvance ? "cash advance" : "loan",
    isCashAdvance,
    paid: Math.max(0, account.total - account.remaining),
    left: account.remaining,
    pct: 0,
    paidInstallments: 0,
    installmentCount: 0,
  };
  const pending = {
    paidAmount: amountOk ? paid : 0,
    partialAmount: 0,
    installments: 0,
    undoAmount: 0,
    undoInstallments: 0,
  };

  const handleConfirm = async () => {
    if (!canSave) return;
    setSubmitting(true);
    try {
      const result = await addManualScheduleAction(account.id, {
        due_date: paidDate,
        amount_due: paid,
        status: "paid",
        paid_date: paidDate,
      });
      if (!result?.id) {
        toast.error(result?.error ?? "Couldn't add the payment (offline?)");
        return;
      }
      if (borrower) invalidateBorrowerDetails(borrower.id);
      toast.success(`₱${paid.toLocaleString()} payment recorded`);
      onSaved({ id: result.id });
    } catch (err) {
      console.error("ManualPaymentDialog confirm error:", err);
      toast.error("Couldn't add the payment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <DialogHeader className="gap-3 pb-2">
        <div className="space-y-1">
          <DialogTitle
            className="flex flex-col items-start gap-1.5 text-xl font-semibold
              tracking-tight"
          >
            <span>Add payment</span>
            {borrower ? (
              <MentionPill
                name={borrower.name}
                href={`/borrowers/${borrower.id}`}
                checked={false}
                color={borrower.color}
                asLink={false}
              />
            ) : null}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Record a payment on this manual flat{" "}
            {isCashAdvance ? "cash advance" : "loan"}
            {account.release_date
              ? ` released ${formatShortDate(account.release_date.slice(0, 10))}`
              : ""}
            .
          </DialogDescription>
        </div>
      </DialogHeader>

      <form
        className="space-y-3 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          void handleConfirm();
        }}
      >
        <section
          className={`space-y-2.5 rounded-2xl bg-slate-100/70 p-3
            dark:bg-muted/30 ${ENTER_ANIMATION}`}
        >
          <div className="px-0.5">
            <AccountSummaryHeader summary={summary} pending={pending} />
          </div>

          <div
            className={`space-y-3 rounded-xl border p-3 shadow-sm
              transition-[background-color,border-color,box-shadow] duration-300
              ${amountOk ? SCHEDULE_CARD.paid : SCHEDULE_CARD.plain}
              ${ENTER_ANIMATION}`}
            style={{ animationDelay: "60ms" }}
          >
            <div>
              <span className={FIELD_LABEL}>Amount paid</span>
              <PesoInput
                label="Amount paid"
                value={amount}
                onChange={setAmount}
                autoFocus
                hint={`of ₱${account.remaining.toLocaleString()} left`}
                warn={overRemaining}
              />
            </div>

            <DateChoice
              label="Payment date"
              value={paidDate}
              onChange={setPaidDate}
            />
          </div>
        </section>
        {/* Lets Enter in the amount field submit the form. */}
        <button type="submit" hidden />
      </form>

      <DialogFooter className="gap-2">
        <Button
          variant="outline"
          onClick={onClose}
          disabled={submitting}
          className="lowercase"
        >
          Cancel
        </Button>
        <Button
          onClick={() => void handleConfirm()}
          disabled={!canSave}
          className="lowercase"
        >
          {submitting ? "Saving…" : "Add payment"}
        </Button>
      </DialogFooter>
    </>
  );
}
