"use client";

import {
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { triggerHaptic } from "@/lib/haptics";
import { toast } from "sonner";
import { useInvalidateBorrowerDetails } from "@/lib/hooks/use-borrower-details";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

function formatAmount(raw: string) {
  if (!raw) return "";
  const [intPart, decPart] = raw.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${grouped}.${decPart}` : grouped;
}

const FORM_ID = (scheduleId: string) => `partial-form-${scheduleId}`;

export default function PartialPaymentForm({
  scheduleId,
  applyPartialPayment,
  autoFocus: _autoFocus,
  dueDate,
  borrowerId,
}: {
  scheduleId: string;
  applyPartialPayment: (formData: FormData) => Promise<void>;
  autoFocus?: boolean;
  dueDate?: string;
  borrowerId?: string;
}) {
  const invalidateBorrowerDetails = useInvalidateBorrowerDetails();
  const defaultDate = dueDate ?? new Date().toISOString().split("T")[0];
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAmountChange(e: ChangeEvent<HTMLInputElement>) {
    let cleaned = e.target.value.replace(/[^\d.]/g, "");
    const firstDot = cleaned.indexOf(".");
    if (firstDot !== -1) {
      cleaned =
        cleaned.slice(0, firstDot + 1) +
        cleaned.slice(firstDot + 1).replace(/\./g, "");
    }
    setAmount(cleaned);
  }

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
          className="dark:text-muted-foreground dark:hover:text-foreground flex
            cursor-pointer items-center gap-1.5 text-[10px] font-black
            tracking-wide text-slate-600 uppercase transition-colors
            hover:text-slate-900"
        >
          <span
            className="dark:border-border/50 flex size-4 items-center
              justify-center rounded border border-slate-300 bg-violet-200
              text-[9px] font-black dark:bg-violet-400/25 dark:text-violet-100"
          >
            +
          </span>
          Add partial payment
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Partial Payment</DialogTitle>
        </DialogHeader>
        <form
          id={FORM_ID(scheduleId)}
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="scheduleId" value={scheduleId} />
          <input type="hidden" name="paymentAmount" value={amount} />
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`partial-amt-${scheduleId}`}
              className="dark:text-muted-foreground text-[10px] font-black
                tracking-wide text-slate-600 uppercase"
            >
              Amount paid
            </label>
            <input
              id={`partial-amt-${scheduleId}`}
              type="text"
              inputMode="decimal"
              placeholder="0"
              required
              autoFocus
              value={formatAmount(amount)}
              onChange={handleAmountChange}
              className="dark:border-border dark:bg-card dark:text-foreground
                dark:focus-visible:ring-border w-full rounded-md border-2
                border-slate-900 bg-white px-3 py-2 text-sm font-semibold
                text-slate-900 tabular-nums shadow-[2px_2px_0px_0px_#0f172a]
                outline-none focus-visible:ring-2 focus-visible:ring-slate-900
                dark:shadow-none"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`partial-date-${scheduleId}`}
              className="dark:text-muted-foreground text-[10px] font-black
                tracking-wide text-slate-600 uppercase"
            >
              Date
            </label>
            <input
              id={`partial-date-${scheduleId}`}
              name="paymentDate"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="dark:border-border dark:bg-card dark:text-foreground
                dark:focus-visible:ring-border w-full min-w-0 rounded-md
                border-2 border-slate-900 bg-white px-3 py-2 text-sm
                font-semibold text-slate-900 shadow-[2px_2px_0px_0px_#0f172a]
                outline-none focus-visible:ring-2 focus-visible:ring-slate-900
                dark:shadow-none"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`partial-note-${scheduleId}`}
              className="dark:text-muted-foreground text-[10px] font-black
                tracking-wide text-slate-600 uppercase"
            >
              Note (optional)
            </label>
            <input
              id={`partial-note-${scheduleId}`}
              name="note"
              type="text"
              maxLength={500}
              placeholder="—"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="dark:border-border dark:bg-card dark:text-foreground
                dark:focus-visible:ring-border w-full rounded-md border-2
                border-slate-900 bg-white px-3 py-2 text-sm text-slate-900
                shadow-[2px_2px_0px_0px_#0f172a] outline-none
                focus-visible:ring-2 focus-visible:ring-slate-900
                dark:shadow-none"
            />
          </div>
        </form>
        <DialogFooter>
          <button
            type="submit"
            form={FORM_ID(scheduleId)}
            disabled={isPending || !amount}
            aria-busy={isPending}
            className="dark:border-border w-full cursor-pointer rounded-lg
              border-2 border-slate-900 bg-violet-200 px-4 py-2 text-xs
              font-black tracking-wide text-slate-900 uppercase
              shadow-[2px_2px_0px_0px_#0f172a] transition hover:bg-violet-300
              disabled:cursor-not-allowed disabled:opacity-60
              dark:bg-violet-400/25 dark:text-violet-100 dark:shadow-none
              dark:hover:bg-violet-400/40"
          >
            {isPending ? "Recording…" : "Record Payment"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
