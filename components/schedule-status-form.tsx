"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Check,
  TriangleAlert,
  ChartPie,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";
import { toast } from "sonner";
import { useInvalidateBorrowerDetails } from "@/lib/hooks/use-borrower-details";

const scheduleStatuses = ["pending", "paid", "overdue", "partial"] as const;

const statusIcons: Record<string, LucideIcon> = {
  pending: Clock,
  paid: Check,
  overdue: TriangleAlert,
  partial: ChartPie,
};

type Props = {
  scheduleId: string;
  currentStatus: string;
  dueDate?: string;
  updateScheduleStatus: (formData: FormData) => Promise<void>;
  isRollingManual?: boolean;
  applyPartialPayment?: (formData: FormData) => Promise<void>;
  borrowerId?: string;
};

export default function ScheduleStatusForm({
  scheduleId,
  currentStatus,
  dueDate,
  updateScheduleStatus,
  isRollingManual,
  applyPartialPayment,
  borrowerId,
}: Props) {
  const router = useRouter();
  const invalidateBorrowerDetails = useInvalidateBorrowerDetails();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [paidDate, setPaidDate] = useState(() => {
    return dueDate ?? new Date().toISOString().split("T")[0];
  });
  const [paidAmount, setPaidAmount] = useState("");
  const [submittingStatus, setSubmittingStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const visibleStatuses = scheduleStatuses.filter(
    (s) => !(isRollingManual && s === "partial"),
  );

  function getStatusClasses(status: string, isActive: boolean) {
    const map: Record<string, { active: string; idle: string }> = {
      paid: {
        active:
          "border-emerald-500 bg-emerald-300 text-emerald-950  dark:border-emerald-400/50 dark:bg-emerald-400/25 dark:text-emerald-200 dark:shadow-none",
        idle: "border-slate-300 bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-900 hover:border-emerald-500 dark:border-border dark:bg-card dark:text-muted-foreground dark:hover:bg-emerald-400/10 dark:hover:text-emerald-300",
      },
      partial: {
        active:
          "border-violet-500 bg-violet-300 text-violet-950  dark:border-violet-400/50 dark:bg-violet-400/25 dark:text-violet-200 dark:shadow-none",
        idle: "border-slate-300 bg-white text-slate-600 hover:bg-violet-50 hover:text-violet-900 hover:border-violet-500 dark:border-border dark:bg-card dark:text-muted-foreground dark:hover:bg-violet-400/10 dark:hover:text-violet-300",
      },
      overdue: {
        active:
          "border-rose-500 bg-rose-300 text-rose-950  dark:border-rose-400/50 dark:bg-rose-400/25 dark:text-rose-200 dark:shadow-none",
        idle: "border-slate-300 bg-white text-slate-600 hover:bg-rose-50 hover:text-rose-900 hover:border-rose-500 dark:border-border dark:bg-card dark:text-muted-foreground dark:hover:bg-rose-400/10 dark:hover:text-rose-300",
      },
      pending: {
        active:
          "border-amber-500 bg-amber-300 text-amber-950 dark:border-amber-400/50 dark:bg-amber-400/25 dark:text-amber-200 dark:shadow-none",
        idle: "border-slate-300 bg-white text-slate-600 hover:bg-amber-50 hover:text-amber-900 hover:border-amber-500 dark:border-border dark:bg-card dark:text-muted-foreground dark:hover:bg-amber-400/10 dark:hover:text-amber-300",
      },
    };
    const c = map[status] ?? map.pending;
    return isActive ? c.active : c.idle;
  }

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
    setSubmittingStatus(status);
    startTransition(() => {
      updateScheduleStatus(fd)
        .then(() => {
          triggerHaptic("success");
          toast.success(`Schedule marked as ${status}`);
          router.refresh();
          if (borrowerId) invalidateBorrowerDetails(borrowerId);
        })
        .catch(() => {
          triggerHaptic("error");
          toast.error("Failed to update schedule");
        })
        .finally(() => setSubmittingStatus(null));
    });
  }

  function handleDateConfirm() {
    if (!pendingStatus) return;

    setSubmittingStatus(pendingStatus);

    if (isRollingManual && applyPartialPayment) {
      const fd = new FormData();
      fd.set("scheduleId", scheduleId);
      fd.set("paymentAmount", paidAmount);
      fd.set("paymentDate", paidDate);
      startTransition(() => {
        applyPartialPayment(fd)
          .then(() => {
            triggerHaptic("success");
            toast.success("Payment recorded");
            router.refresh();
            if (borrowerId) invalidateBorrowerDetails(borrowerId);
          })
          .catch(() => {
            triggerHaptic("error");
            toast.error("Failed to record payment");
          })
          .finally(() => {
            setShowDatePicker(false);
            setPendingStatus(null);
            setPaidAmount("");
            setSubmittingStatus(null);
          });
      });
      return;
    }

    const fd = new FormData();
    fd.set("scheduleId", scheduleId);
    fd.set("status", pendingStatus);
    fd.set("paidDate", paidDate);
    startTransition(() => {
      updateScheduleStatus(fd)
        .then(() => {
          triggerHaptic("success");
          toast.success(`Schedule marked as ${pendingStatus}`);
          router.refresh();
          if (borrowerId) invalidateBorrowerDetails(borrowerId);
        })
        .catch(() => {
          triggerHaptic("error");
          toast.error("Failed to update schedule");
        })
        .finally(() => {
          setShowDatePicker(false);
          setPendingStatus(null);
          setSubmittingStatus(null);
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
      <form ref={formRef} className="flex flex-wrap gap-1.5">
        <input type="hidden" name="scheduleId" value={scheduleId} />
        {visibleStatuses.map((status) => {
          const isActive = currentStatus === status;
          const isSubmitting = submittingStatus === status;
          const isDisabled = isActive || isPending;
          const Icon = statusIcons[status] ?? Clock;
          return (
            <button
              key={status}
              type="button"
              onClick={() => handleClick(status)}
              disabled={isDisabled}
              aria-pressed={isActive}
              className={`inline-flex min-h-7 items-center justify-center gap-1
              rounded-md border-2 px-2 py-1 text-[12px] font-bold tracking-wide
              capitalize transition active:translate-x-px active:translate-y-px
              active:shadow-none sm:min-h-9 sm:gap-1.5 sm:rounded-lg sm:px-2.5
              sm:py-1.5 sm:text-xs ${getStatusClasses(status, isActive)}
              ${isDisabled ? (isActive ? "cursor-default" : "cursor-not-allowed opacity-60") : "cursor-pointer"}`}
            >
              {isSubmitting ? (
                <Loader2
                  className="size-3 shrink-0 animate-spin sm:size-3.5"
                  aria-hidden
                />
              ) : (
                <Icon className="size-3 shrink-0 sm:size-3.5" aria-hidden />
              )}
              <span>{status}</span>
            </button>
          );
        })}
      </form>

      {showDatePicker && (
        <div
          className="dark:border-border dark:bg-card flex flex-col gap-2
            rounded-lg border-2 border-slate-300 bg-white p-3"
        >
          {isRollingManual && (
            <>
              <label
                className="dark:text-muted-foreground text-[10px] font-black
                  tracking-wide text-slate-600 uppercase"
              >
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
                className="dark:border-border dark:bg-card dark:text-foreground
                  dark:focus-visible:ring-border w-full min-w-0 rounded-md
                  border-2 border-slate-900 bg-white px-2 py-1.5 text-sm
                  font-semibold text-slate-600 tabular-nums outline-none
                  focus-visible:ring-2 focus-visible:ring-slate-900"
              />
            </>
          )}
          <label
            className="dark:text-muted-foreground text-[10px] font-black
              tracking-wide text-slate-600 uppercase"
          >
            {isRollingManual ? "Date paid" : "Payment date (optional)"}
          </label>
          <input
            type="date"
            value={paidDate}
            onChange={(e) => setPaidDate(e.target.value)}
            className="dark:border-border dark:bg-card dark:text-foreground
              dark:focus-visible:ring-border w-full min-w-0 rounded-md border-2
              border-slate-300 bg-white px-2 py-1.5 text-sm font-semibold
              text-slate-600 outline-none focus-visible:ring-2
              focus-visible:ring-slate-900"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDateConfirm}
              disabled={
                isPending ||
                (isRollingManual
                  ? !paidAmount || Number(paidAmount) <= 0
                  : false)
              }
              className="dark:border-border flex-1 cursor-pointer rounded-lg
                border-2 border-slate-300 bg-emerald-200 px-3 py-1.5 text-xs
                font-black tracking-wide text-slate-600 uppercase transition
                hover:bg-emerald-300 disabled:cursor-not-allowed
                disabled:opacity-70 dark:bg-emerald-800/40 dark:text-emerald-100
                dark:hover:bg-emerald-800/60"
            >
              {isPending ? "…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={handleDateCancel}
              disabled={isPending}
              className="dark:border-border dark:bg-card dark:text-foreground
                dark:hover:bg-muted flex-1 cursor-pointer rounded-lg border-2
                border-slate-300 bg-white px-3 py-1.5 text-xs font-black
                tracking-wide text-slate-600 uppercase transition
                hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
