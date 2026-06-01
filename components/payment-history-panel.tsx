"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

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

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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
    if (!confirm("Delete this payment entry?")) return;
    const fd = new FormData();
    fd.set("paymentId", payment.id);
    fd.set("scheduleId", payment.schedule_id);
    startTransition(() => {
      deletePayment(fd).then(() => setOpen(false));
    });
  }

  return (
    <>
      <li
        onClick={() => setOpen(true)}
        className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-slate-200 bg-green-300 px-3 py-2 transition hover:bg-green-400 dark:border-border dark:bg-card dark:hover:bg-muted"
      >
        <div className="min-w-0 flex-1">
          <span className="font-black tabular-nums text-slate-900 dark:text-foreground">
            {formatMoney(payment.amount)}
          </span>
          <span className="mx-1.5 text-slate-300 dark:text-border">·</span>
          <span className="text-xs font-semibold text-slate-600 dark:text-muted-foreground">
            {formatDate(payment.payment_date)}
          </span>
          {payment.note ? (
            <>
              <span className="mx-1.5 text-slate-300 dark:text-border">·</span>
              <span className="text-xs text-slate-500 truncate dark:text-muted-foreground">{payment.note}</span>
            </>
          ) : null}
        </div>
      </li>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-foreground">
              Payment Details
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase tracking-wide text-slate-600 dark:text-muted-foreground">
                Amount
              </label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-semibold tabular-nums text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:border-border dark:bg-card dark:text-foreground dark:focus-visible:ring-border"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase tracking-wide text-slate-600 dark:text-muted-foreground">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-semibold text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:border-border dark:bg-card dark:text-foreground dark:focus-visible:ring-border"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase tracking-wide text-slate-600 dark:text-muted-foreground">
                Note
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                placeholder="—"
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:border-border dark:bg-card dark:text-foreground dark:focus-visible:ring-border"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-row gap-2 border-t-0 bg-transparent pt-0 sm:justify-between">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wide text-rose-500 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-70 cursor-pointer dark:border-rose-400/40 dark:bg-card dark:text-rose-300 dark:hover:bg-rose-400/10 dark:hover:text-rose-200"
            >
              {isPending ? "…" : "Delete"}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="rounded-md border border-slate-300 bg-emerald-100 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-emerald-900 transition hover:bg-emerald-200 disabled:opacity-70 cursor-pointer dark:border-border dark:bg-emerald-400/25 dark:text-emerald-100 dark:hover:bg-emerald-400/40"
            >
              {isPending ? "…" : "Save"}
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
    <div className="mt-2">
      <p className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-slate-600 dark:text-muted-foreground">
        Payment history
        <span className="ml-2 font-semibold text-slate-500 dark:text-muted-foreground">
          ({payments.length} payment{payments.length !== 1 ? "s" : ""} · total {formatMoney(total)})
        </span>
      </p>
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
