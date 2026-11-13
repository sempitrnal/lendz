"use client";

import { useState, useTransition, type FormEvent } from "react";
import { triggerHaptic } from "@/lib/haptics";
import { toast } from "sonner";
import { useInvalidateBorrowerDetails } from "@/lib/hooks/use-borrower-details";
import { Plus } from "lucide-react";
import type { ScheduleOptimisticAction } from "@/components/account/schedule-optimistic";
import { AmountField, DateField } from "@/components/payment-fields";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

const FORM_ID = (scheduleId: string) => `partial-form-${scheduleId}`;

const inputClasses = `w-full rounded-lg border border-slate-200 bg-white px-3
  py-2 text-sm font-semibold text-slate-900 outline-none transition
  focus:border-violet-400 focus:ring-2 focus:ring-violet-100
  dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100
  dark:focus:border-violet-600 dark:focus:ring-violet-900/30`;

const labelClasses = "text-xs font-bold text-slate-600 dark:text-slate-300";

export default function PartialPaymentForm({
  scheduleId,
  applyPartialPayment,
  dueDate,
  borrowerId,
  onOptimisticUpdate,
  remaining,
}: {
  scheduleId: string;
  applyPartialPayment: (formData: FormData) => Promise<void>;
  autoFocus?: boolean;
  dueDate?: string;
  borrowerId?: string;
  onOptimisticUpdate?: (action: ScheduleOptimisticAction) => void;
  /** What is still owed on the schedule: the amount field offers "full". */
  remaining?: number;
}) {
  const invalidateBorrowerDetails = useInvalidateBorrowerDetails();
  const defaultDate = dueDate ?? new Date().toISOString().split("T")[0];
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(v: boolean) {
    if (!v) {
      setAmount("");
      setDate(defaultDate);
      setNote("");
    }
    setOpen(v);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => {
      onOptimisticUpdate?.({
        type: "payment",
        scheduleId,
        payment: {
          id: `optimistic-${Date.now()}`,
          schedule_id: scheduleId,
          amount: Number(amount),
          payment_date: date,
          note: note || null,
          created_at: new Date().toISOString(),
        },
      });
      applyPartialPayment(fd)
        .then(() => {
          triggerHaptic("success");
          toast.success("Partial payment recorded");
          if (borrowerId) invalidateBorrowerDetails(borrowerId);
          handleOpenChange(false);
        })
        .catch(() => {
          triggerHaptic("error");
          toast.error("Failed to record payment");
        });
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg bg-[#8e6fe5]
            dark:bg-[#48396f] px-3 py-2 text-xs font-bold text-white transition
            hover:bg-[#8f7ac8]"
        >
          <Plus className="size-3.5" />
          Add payment
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle
            className="text-base font-extrabold text-slate-900
              dark:text-slate-100"
          >
            Add partial payment
          </DialogTitle>
        </DialogHeader>
        <form
          id={FORM_ID(scheduleId)}
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="scheduleId" value={scheduleId} />
          <input type="hidden" name="paymentAmount" value={amount} />
          <AmountField
            id={`partial-amt-${scheduleId}`}
            value={amount}
            onChange={setAmount}
            remaining={remaining}
            autoFocus
          />
          <DateField
            id={`partial-date-${scheduleId}`}
            name="paymentDate"
            label="Date"
            value={date}
            onChange={setDate}
            dueDate={dueDate}
          />
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`partial-note-${scheduleId}`}
              className={labelClasses}
            >
              Note (optional)
            </label>
            <textarea
              id={`partial-note-${scheduleId}`}
              name="note"
              rows={2}
              maxLength={500}
              placeholder="Add a note…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={`${inputClasses} resize-none font-normal`}
            />
          </div>
        </form>
        <DialogFooter
          className="border-slate-200 bg-white dark:border-slate-800
            dark:bg-slate-900"
        >
          <button
            type="submit"
            form={FORM_ID(scheduleId)}
            disabled={isPending || !amount}
            aria-busy={isPending}
            className="w-full rounded-xl border border-violet-200 bg-violet-100
              px-4 py-3 text-sm font-bold text-violet-900 transition
              hover:bg-violet-200 disabled:cursor-not-allowed
              disabled:opacity-50 dark:border-violet-400/20
              dark:bg-violet-400/15 dark:text-violet-100
              dark:hover:bg-violet-400/25"
          >
            {isPending ? "Recording…" : "Record payment"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
