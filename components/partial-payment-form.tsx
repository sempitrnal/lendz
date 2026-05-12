"use client";

import { useFormStatus } from "react-dom";

function PartialSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`shrink-0 rounded-lg border-2 border-slate-900 bg-violet-200 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] transition hover:bg-violet-300 disabled:cursor-wait disabled:opacity-70 ${pending ? "" : ""}`}
    >
      {pending ? "…" : "Partial"}
    </button>
  );
}

export default function PartialPaymentForm({
  scheduleId,
  applyPartialPayment,
}: {
  scheduleId: string;
  applyPartialPayment: (formData: FormData) => Promise<void>;
}) {
  return (
    <form
      action={applyPartialPayment}
      className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <input type="hidden" name="scheduleId" value={scheduleId} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <label
          htmlFor={`partial-amt-${scheduleId}`}
          className="text-[10px] font-black uppercase tracking-wide text-slate-600"
        >
          Amount paid
        </label>
        <input
          id={`partial-amt-${scheduleId}`}
          name="paymentAmount"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          placeholder="0"
          required
          className="w-full min-w-0 rounded-md border-2 border-slate-900 bg-white px-2 py-1.5 text-sm font-semibold tabular-nums text-slate-900 shadow-[1px_1px_0px_0px_#0f172a] outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-[200px]">
        <label
          htmlFor={`partial-note-${scheduleId}`}
          className="text-[10px] font-black uppercase tracking-wide text-slate-600"
        >
          Note (optional)
        </label>
        <input
          id={`partial-note-${scheduleId}`}
          name="note"
          type="text"
          maxLength={500}
          placeholder="—"
          className="w-full rounded-md border-2 border-slate-900 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-[1px_1px_0px_0px_#0f172a] outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
        />
      </div>
      <PartialSubmitButton />
    </form>
  );
}
