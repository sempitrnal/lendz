"use client";

import { useState, type ChangeEvent } from "react";
import { useFormStatus } from "react-dom";

function PartialSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`shrink-0 rounded-lg border border-slate-300 bg-violet-200 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-slate-900 transition hover:bg-violet-300 disabled:cursor-wait disabled:opacity-70 dark:border-border/50 dark:bg-violet-400/25 dark:text-violet-100 dark:hover:bg-violet-400/40 ${pending ? "" : ""}`}
    >
      {pending ? "…" : "Partial"}
    </button>
  );
}

function formatAmount(raw: string) {
  if (!raw) return "";
  const [intPart, decPart] = raw.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${grouped}.${decPart}` : grouped;
}

export default function PartialPaymentForm({
  scheduleId,
  applyPartialPayment,
  autoFocus,
  dueDate,
}: {
  scheduleId: string;
  applyPartialPayment: (formData: FormData) => Promise<void>;
  autoFocus?: boolean;
  dueDate?: string;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");

  function handleAmountChange(e: ChangeEvent<HTMLInputElement>) {
    // keep only digits and a single decimal point
    let cleaned = e.target.value.replace(/[^\d.]/g, "");
    const firstDot = cleaned.indexOf(".");
    if (firstDot !== -1) {
      cleaned =
        cleaned.slice(0, firstDot + 1) +
        cleaned.slice(firstDot + 1).replace(/\./g, "");
    }
    setAmount(cleaned);
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-slate-600 hover:text-slate-900 transition-colors cursor-pointer dark:text-muted-foreground dark:hover:text-foreground"
      >
        <span className="flex size-4 items-center justify-center rounded border border-slate-300 bg-violet-200 text-[9px] font-black dark:border-border/50 dark:bg-violet-400/25 dark:text-violet-100">
          {open ? "−" : "+"}
        </span>
        Add partial payment
      </button>

      {open && (
        <form
          action={applyPartialPayment}
          className="mt-2 flex w-full flex-col gap-2 sm:w-max sm:flex-row sm:flex-wrap sm:items-end"
        >
          <input type="hidden" name="scheduleId" value={scheduleId} />
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`partial-amt-${scheduleId}`}
              className="text-[10px] font-black uppercase tracking-wide text-slate-600 dark:text-muted-foreground"
            >
              Amount paid
            </label>
            <input type="hidden" name="paymentAmount" value={amount} />
            <input
              id={`partial-amt-${scheduleId}`}
              type="text"
              inputMode="decimal"
              placeholder="0"
              required
              value={formatAmount(amount)}
              onChange={handleAmountChange}
              className="w-full sm:w-28 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-semibold tabular-nums text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:border-border/50 dark:bg-card dark:text-foreground dark:focus-visible:ring-border"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`partial-date-${scheduleId}`}
              className="text-[10px] font-black uppercase tracking-wide text-slate-600 dark:text-muted-foreground"
            >
              Date
            </label>
            <input
              id={`partial-date-${scheduleId}`}
              name="paymentDate"
              type="date"
              defaultValue={dueDate ?? new Date().toISOString().split("T")[0]}
              className="w-full sm:w-36 min-w-0 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-semibold text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:border-border/50 dark:bg-card dark:text-foreground dark:focus-visible:ring-border"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`partial-note-${scheduleId}`}
              className="text-[10px] font-black uppercase tracking-wide text-slate-600 dark:text-muted-foreground"
            >
              Note (optional)
            </label>
            <input
              id={`partial-note-${scheduleId}`}
              name="note"
              type="text"
              maxLength={500}
              placeholder="—"
              className="w-full sm:w-32 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:border-border/50 dark:bg-card dark:text-foreground dark:focus-visible:ring-border"
            />
          </div>
          <PartialSubmitButton />
        </form>
      )}
    </div>
  );
}
