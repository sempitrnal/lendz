"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useScheduleSelection } from "./schedule-selection-provider";
import { X, Check } from "lucide-react";
import { useInvalidateBorrowerDetails } from "@/lib/hooks/use-borrower-details";

export type PaidDateStrategy = "due_date" | "custom";

type Props = {
  allIds: string[];
  onBatchPaid: (
    ids: string[],
    strategy: PaidDateStrategy,
    customDate?: string,
  ) => Promise<void>;
  borrowerId?: string;
};

export default function BatchScheduleToolbar({
  onBatchPaid,
  borrowerId,
}: Props) {
  const router = useRouter();
  const invalidateBorrowerDetails = useInvalidateBorrowerDetails();
  const { selectedIds, clearAll } = useScheduleSelection();
  const [showModal, setShowModal] = useState(false);
  const [strategy, setStrategy] = useState<PaidDateStrategy>("due_date");
  const [customDate, setCustomDate] = useState("");
  const [isPending, startTransition] = useTransition();

  const count = selectedIds.size;
  if (count === 0) return null;

  function handleConfirm() {
    startTransition(async () => {
      await onBatchPaid(
        Array.from(selectedIds),
        strategy,
        strategy === "custom" ? customDate : undefined,
      );
      router.refresh();
      if (borrowerId) invalidateBorrowerDetails(borrowerId);
      clearAll();
      setShowModal(false);
    });
  }

  return (
    <>
      <div
        className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2
          items-center gap-3 rounded-xl border border-slate-200 bg-white px-4
          py-3 shadow-lg dark:border-slate-800 dark:bg-slate-900"
      >
        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
          {count} selected
        </span>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          disabled={isPending}
          className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold
            text-white transition hover:bg-emerald-600 disabled:cursor-wait
            disabled:opacity-70"
        >
          {isPending ? "Updating…" : "Mark as paid"}
        </button>
        <button
          type="button"
          onClick={clearAll}
          className="flex items-center justify-center rounded-lg p-1.5
            text-slate-400 transition hover:bg-slate-100
            dark:hover:bg-slate-800"
          aria-label="Clear selection"
        >
          <X className="size-4" />
        </button>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center
            bg-black/40 p-4"
        >
          <div
            className="w-full max-w-sm rounded-xl border border-slate-200
              bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900"
          >
            <h3
              className="text-base font-extrabold text-slate-900
                dark:text-slate-100"
            >
              Mark {count} as paid
            </h3>
            <p
              className="mt-1 text-xs font-semibold text-slate-500
                dark:text-slate-400"
            >
              Choose how paid dates should be set.
            </p>

            <div className="mt-4 space-y-3">
              <label
                className="flex cursor-pointer items-start gap-3 rounded-lg
                  border border-slate-200 bg-white p-3 transition
                  hover:border-sky-300 dark:border-slate-700 dark:bg-slate-900
                  dark:hover:border-sky-700"
              >
                <input
                  type="radio"
                  name="dateStrategy"
                  value="due_date"
                  checked={strategy === "due_date"}
                  onChange={() => setStrategy("due_date")}
                  className="mt-0.5 size-4 accent-sky-500"
                />
                <div>
                  <span
                    className="block text-sm font-bold text-slate-900
                      dark:text-slate-100"
                  >
                    Use due dates
                  </span>
                  <span
                    className="block text-xs text-slate-500 dark:text-slate-400"
                  >
                    Each schedule keeps its own due date as paid date.
                  </span>
                </div>
              </label>

              <label
                className="flex cursor-pointer items-start gap-3 rounded-lg
                  border border-slate-200 bg-white p-3 transition
                  hover:border-sky-300 dark:border-slate-700 dark:bg-slate-900
                  dark:hover:border-sky-700"
              >
                <input
                  type="radio"
                  name="dateStrategy"
                  value="custom"
                  checked={strategy === "custom"}
                  onChange={() => setStrategy("custom")}
                  className="mt-0.5 size-4 accent-sky-500"
                />
                <div className="min-w-0 flex-1">
                  <span
                    className="block text-sm font-bold text-slate-900
                      dark:text-slate-100"
                  >
                    Use custom date
                  </span>
                  <span
                    className="block text-xs text-slate-500 dark:text-slate-400"
                  >
                    Same paid date for all selected schedules.
                  </span>
                  {strategy === "custom" ? (
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      required
                      className="mt-2 w-full min-w-0 rounded-md border
                        border-slate-200 bg-white px-2 py-1.5 text-sm
                        font-semibold text-slate-600 outline-none
                        focus-visible:ring-2 focus-visible:ring-sky-500
                        dark:border-slate-700 dark:bg-slate-900
                        dark:text-slate-300"
                    />
                  ) : null}
                </div>
              </label>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-lg border border-slate-200 bg-white
                  px-3 py-2 text-xs font-bold text-slate-600 transition
                  hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900
                  dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending || (strategy === "custom" && !customDate)}
                className="flex flex-1 items-center justify-center gap-1.5
                  rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold
                  text-white transition hover:bg-emerald-600
                  disabled:cursor-wait disabled:opacity-70"
              >
                <Check className="size-3.5" />
                {isPending ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
