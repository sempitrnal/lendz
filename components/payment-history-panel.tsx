"use client";

import { useState, useTransition } from "react";

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
  const [editing, setEditing] = useState(false);
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
      updatePayment(fd).then(() => setEditing(false));
    });
  }

  function handleDelete() {
    if (!confirm("Delete this payment entry?")) return;
    const fd = new FormData();
    fd.set("paymentId", payment.id);
    fd.set("scheduleId", payment.schedule_id);
    startTransition(() => {
      deletePayment(fd);
    });
  }

  if (editing) {
    return (
      <li className="flex flex-col gap-2 rounded-lg border-2 border-violet-400 bg-violet-50 p-3">
        <div className="flex flex-wrap gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase tracking-wide text-slate-600">
              Amount
            </label>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-24 rounded-md border-2 border-slate-900 bg-white px-2 py-1 text-sm font-semibold tabular-nums text-slate-900 shadow-[1px_1px_0px_0px_#0f172a] outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase tracking-wide text-slate-600">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-36 min-w-0 rounded-md border-2 border-slate-900 bg-white px-2 py-1 text-sm font-semibold text-slate-900 shadow-[1px_1px_0px_0px_#0f172a] outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase tracking-wide text-slate-600">
              Note
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="—"
              className="w-28 rounded-md border-2 border-slate-900 bg-white px-2 py-1 text-sm text-slate-900 shadow-[1px_1px_0px_0px_#0f172a] outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="rounded-md border-2 border-slate-900 bg-emerald-200 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-900 shadow-[1px_1px_0px_0px_#0f172a] transition hover:bg-emerald-300 disabled:opacity-70 cursor-pointer"
          >
            {isPending ? "…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={isPending}
            className="rounded-md border-2 border-slate-900 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-900 shadow-[1px_1px_0px_0px_#0f172a] transition hover:bg-slate-50 disabled:opacity-70 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border-2 border-slate-900 bg-white px-3 py-2">
      <div className="min-w-0 flex-1">
        <span className="font-black tabular-nums text-slate-900">
          {formatMoney(payment.amount)}
        </span>
        <span className="mx-1.5 text-slate-300">·</span>
        <span className="text-xs font-semibold text-slate-600">
          {formatDate(payment.payment_date)}
        </span>
        {payment.note ? (
          <>
            <span className="mx-1.5 text-slate-300">·</span>
            <span className="text-xs text-slate-500 truncate">{payment.note}</span>
          </>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-md border-2 border-slate-900 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="rounded-md border-2 border-rose-300 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-600 transition hover:bg-rose-50 hover:text-rose-900 disabled:opacity-70 cursor-pointer"
        >
          {isPending ? "…" : "Del"}
        </button>
      </div>
    </li>
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
      <p className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-slate-600">
        Payment history
        <span className="ml-2 font-semibold text-slate-500">
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
