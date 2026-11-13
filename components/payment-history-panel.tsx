"use client";

import { paidDay } from "@/lib/paid-day";
import { useState, useTransition } from "react";
import { Banknote, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";

export type SchedulePayment = {
  id: string;
  schedule_id: string;
  amount: number;
  payment_date: string | null;
  note: string | null;
  created_at: string;
};

type Props = {
  payments: SchedulePayment[];
  updatePayment: (formData: FormData) => Promise<void>;
  deletePayment: (formData: FormData) => Promise<void>;
};

function formatMoney(value: number) {
  return `₱${value.toLocaleString()}`;
}

/** An input in the details dialog: soft, rounded, green when focused. */
const fieldClass =
  "h-11 w-full rounded-xl border border-border bg-muted/40 px-3 text-sm font-semibold text-card-foreground/80 outline-none transition-colors focus-visible:border-emerald-500/60 focus-visible:ring-4 focus-visible:ring-emerald-500/15";

function PaymentRow({
  payment,
  updatePayment,
  deletePayment,
}: {
  payment: SchedulePayment;
  updatePayment: (formData: FormData) => Promise<void>;
  deletePayment: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(payment.amount));
  const [date, setDate] = useState(payment.payment_date ?? "");
  const [note, setNote] = useState(payment.note ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const fd = new FormData();
    fd.set("paymentId", payment.id);
    fd.set("amount", amount);
    fd.set("paymentDate", date);
    fd.set("note", note);
    startTransition(() => {
      updatePayment(fd).then(() => setOpen(false));
    });
  }

  function handleDelete() {
    if (!confirm("delete this payment entry?")) return;
    const fd = new FormData();
    fd.set("paymentId", payment.id);
    fd.set("scheduleId", payment.schedule_id);
    startTransition(() => {
      deletePayment(fd).then(() => setOpen(false));
    });
  }

  return (
    <>
      <li>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-xl bg-muted/50 px-3
            lowercase py-2.5 text-left transition-colors active:bg-muted"
        >
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center
              rounded-full bg-emerald-100 text-emerald-700
              dark:bg-emerald-500/20 dark:text-emerald-300"
          >
            <Banknote className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span
              className="block text-sm font-bold text-card-foreground/80
                tabular-nums"
            >
              {formatMoney(payment.amount)}
            </span>
            <span
              className="block truncate text-xs font-semibold
                text-muted-foreground"
            >
              {payment.payment_date
                ? paidDay(payment.payment_date, formatDate, { capital: true })
                : formatDate(payment.payment_date)}
              {payment.note ? ` · ${payment.note}` : ""}
            </span>
          </span>
          <ChevronRight
            className="size-4 shrink-0 text-muted-foreground/60"
            aria-hidden="true"
          />
        </button>
      </li>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl lowercase sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-black tracking-tight">
              payment details
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="px-1 text-xs font-bold text-muted-foreground">
                amount
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={fieldClass + " tabular-nums"}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="px-1 text-xs font-bold text-muted-foreground">
                date
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={fieldClass + " min-w-0"}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="px-1 text-xs font-bold text-muted-foreground">
                note
              </span>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                placeholder="—"
                className={fieldClass}
              />
            </label>
          </div>

          <DialogFooter
            className="flex flex-row gap-2 border-t-0 bg-transparent pt-1
              sm:justify-between"
          >
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="h-11 flex-1 cursor-pointer rounded-xl bg-rose-50
                text-sm font-bold text-rose-600 transition-colors
                active:bg-rose-100 disabled:opacity-70 dark:bg-rose-500/15
                dark:text-rose-300 dark:active:bg-rose-500/25"
            >
              {isPending ? "…" : "delete"}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="h-11 flex-1 cursor-pointer rounded-xl bg-emerald-600
                text-sm font-bold text-white transition-colors
                active:bg-emerald-700 disabled:opacity-70"
            >
              {isPending ? "…" : "save"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function PaymentHistoryPanel({
  payments,
  updatePayment,
  deletePayment,
}: Props) {
  if (payments.length === 0) return null;

  const total = payments.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="mt-2 lowercase">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <p className="text-xs font-bold text-muted-foreground">
          payment history
        </p>
        <p
          className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px]
            font-bold text-emerald-800 tabular-nums dark:bg-emerald-500/15
            dark:text-emerald-300"
        >
          {payments.length} payment{payments.length !== 1 ? "s" : ""} ·{" "}
          {formatMoney(total)}
        </p>
      </div>
      <ul className="flex flex-col gap-1.5">
        {payments.map((p) => (
          <PaymentRow
            key={p.id}
            payment={p}
            updatePayment={updatePayment}
            deletePayment={deletePayment}
          />
        ))}
      </ul>
    </div>
  );
}
