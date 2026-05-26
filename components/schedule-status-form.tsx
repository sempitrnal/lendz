"use client";

import { useState, useRef, useTransition } from "react";

const scheduleStatuses = ["pending", "paid", "overdue", "partial"] as const;

type Props = {
  scheduleId: string;
  currentStatus: string;
  dueDate?: string;
  updateScheduleStatus: (formData: FormData) => Promise<void>;
  isRollingManual?: boolean;
  applyPartialPayment?: (formData: FormData) => Promise<void>;
};

export default function ScheduleStatusForm({
  scheduleId,
  currentStatus,
  dueDate,
  updateScheduleStatus,
  isRollingManual,
  applyPartialPayment,
}: Props) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [paidDate, setPaidDate] = useState(() => {
    return dueDate ?? new Date().toISOString().split("T")[0];
  });
  const [paidAmount, setPaidAmount] = useState("");
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const visibleStatuses = scheduleStatuses.filter(
    (s) => !(isRollingManual && s === "partial")
  );

  function handleClick(status: string) {
    if (currentStatus === status) return;

    if (status === "paid") {
      setPendingStatus(status);
      setShowDatePicker(true);
      return;
    }

    const fd = new FormData();
    fd.set("scheduleId", scheduleId);
    fd.set("status", status);
    startTransition(() => {
      updateScheduleStatus(fd);
    });
  }

  function handleDateConfirm() {
    if (!pendingStatus) return;

    if (isRollingManual && applyPartialPayment) {
      const fd = new FormData();
      fd.set("scheduleId", scheduleId);
      fd.set("paymentAmount", paidAmount);
      fd.set("paymentDate", paidDate);
      startTransition(() => {
        applyPartialPayment(fd).then(() => {
          setShowDatePicker(false);
          setPendingStatus(null);
          setPaidAmount("");
        });
      });
      return;
    }

    const fd = new FormData();
    fd.set("scheduleId", scheduleId);
    fd.set("status", pendingStatus);
    fd.set("paidDate", paidDate);
    startTransition(() => {
      updateScheduleStatus(fd).then(() => {
        setShowDatePicker(false);
        setPendingStatus(null);
      });
    });
  }

  function handleDateCancel() {
    setShowDatePicker(false);
    setPendingStatus(null);
    setPaidAmount("");
  }

  return (
    <div className="flex flex-col gap-2">
      <form ref={formRef} className="inline-flex w-max overflow-hidden rounded-lg border-2 border-slate-900 bg-white shadow-[2px_2px_0px_0px_#0f172a]">
        <input type="hidden" name="scheduleId" value={scheduleId} />
        {visibleStatuses.map((status, i) => {
          const isActive = currentStatus === status;
          const isFirst = i === 0;
          const isLast = i === visibleStatuses.length - 1;
          const isDisabled = isActive || isPending;
          return (
            <button
              key={status}
              type="button"
              onClick={() => handleClick(status)}
              disabled={isDisabled}
              aria-pressed={isActive}
              className={`min-h-9 min-w-14 px-1.5 py-1.5 text-xs font-semibold capitalize tracking-wide transition sm:min-w-17 sm:px-2.5 border-slate-900 ${!isFirst ? "border-l-2" : ""} ${isFirst ? "rounded-l-[5px]" : ""} ${isLast ? "rounded-r-[5px]" : ""} ${
                isActive
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              } ${isDisabled ? "cursor-not-allowed opacity-80" : "cursor-pointer"}`}
            >
              {status}
            </button>
          );
        })}
      </form>

      {showDatePicker && (
        <div className="flex flex-col gap-2 rounded-lg border-2 border-slate-900 bg-white p-3 shadow-[2px_2px_0px_0px_#0f172a]">
          {isRollingManual && (
            <>
              <label className="text-[10px] font-black uppercase tracking-wide text-slate-600">
                Amount paid
              </label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder="0"
                required
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                className="w-full min-w-0 rounded-md border-2 border-slate-900 bg-white px-2 py-1.5 text-sm font-semibold tabular-nums text-slate-900 shadow-[1px_1px_0px_0px_#0f172a] outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              />
            </>
          )}
          <label className="text-[10px] font-black uppercase tracking-wide text-slate-600">
            {isRollingManual ? "Date paid" : "Payment date (optional)"}
          </label>
          <input
            type="date"
            value={paidDate}
            onChange={(e) => setPaidDate(e.target.value)}
            className="w-full min-w-0 rounded-md border-2 border-slate-900 bg-white px-2 py-1.5 text-sm font-semibold text-slate-900 shadow-[1px_1px_0px_0px_#0f172a] outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDateConfirm}
              disabled={isPending || (isRollingManual ? !paidAmount || Number(paidAmount) <= 0 : false)}
              className="flex-1 rounded-lg border-2 border-slate-900 bg-emerald-200 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70 cursor-pointer"
            >
              {isPending ? "…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={handleDateCancel}
              disabled={isPending}
              className="flex-1 rounded-lg border-2 border-slate-900 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wide text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
