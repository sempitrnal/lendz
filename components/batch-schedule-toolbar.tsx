"use client";

import { useState, useTransition } from "react";
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
      if (borrowerId) invalidateBorrowerDetails(borrowerId);
      clearAll();
      setShowModal(false);
    });
  }

  return (
    <>
      {/* Floating action bar */}
      <div
        className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2
          items-center gap-3 rounded-xl border-2 border-slate-900 bg-[#fffefa]
          px-4 py-3 shadow-[4px_4px_0px_0px_#0f172a]"
      >
        <span className="text-sm font-black text-slate-600">
          {count} selected
        </span>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          disabled={isPending}
          className="rounded-lg border-2 border-slate-900 bg-emerald-200 px-3
            py-1.5 text-xs font-black uppercase tracking-wide text-slate-600
            shadow-[2px_2px_0px_0px_#0f172a] transition hover:bg-emerald-300
            active:translate-y-0 active:shadow-none disabled:cursor-wait
            disabled:opacity-70"
        >
          {isPending ? "Updating…" : "Mark as paid"}
        </button>
        <button
          type="button"
          onClick={clearAll}
          className="flex items-center justify-center rounded-lg border-2
            border-slate-300 bg-white p-1.5 text-slate-500 transition
            hover:border-slate-900 hover:text-slate-600"
          aria-label="Clear selection"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Date strategy modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center
            bg-black/40 p-4"
        >
          <div
            className="w-full max-w-sm rounded-xl border-2 border-slate-900
              bg-[#fffefa] p-5 shadow-[6px_6px_0px_0px_#0f172a]"
          >
            <h3
              className="text-base font-black uppercase tracking-wide
                text-slate-600"
            >
              Mark {count} as paid
            </h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Choose how paid dates should be set.
            </p>

            <div className="mt-4 space-y-3">
              {/* Option: use due dates */}
              <label
                className="flex cursor-pointer items-start gap-3 rounded-lg
                  border-2 border-slate-900 bg-emerald-50 p-3
                  shadow-[2px_2px_0px_0px_#0f172a] transition
                  hover:bg-emerald-100"
              >
                <input
                  type="radio"
                  name="dateStrategy"
                  value="due_date"
                  checked={strategy === "due_date"}
                  onChange={() => setStrategy("due_date")}
                  className="mt-0.5 size-4 accent-slate-900"
                />
                <div>
                  <span className="block text-sm font-black text-slate-600">
                    Use due dates
                  </span>
                  <span className="block text-xs text-slate-500">
                    Each schedule keeps its own due date as paid date.
                  </span>
                </div>
              </label>

              {/* Option: custom date */}
              <label
                className="flex cursor-pointer items-start gap-3 rounded-lg
                  border-2 border-slate-900 bg-violet-50 p-3
                  shadow-[2px_2px_0px_0px_#0f172a] transition
                  hover:bg-violet-100"
              >
                <input
                  type="radio"
                  name="dateStrategy"
                  value="custom"
                  checked={strategy === "custom"}
                  onChange={() => setStrategy("custom")}
                  className="mt-0.5 size-4 accent-slate-900"
                />
                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-slate-600">
                    Use custom date
                  </span>
                  <span className="block text-xs text-slate-500">
                    Same paid date for all selected schedules.
                  </span>
                  {strategy === "custom" ? (
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      required
                      className="mt-2 w-full min-w-0 rounded-md border-2
                        border-slate-900 bg-white px-2 py-1.5 text-sm
                        font-semibold text-slate-600 outline-none
                        focus-visible:ring-2 focus-visible:ring-slate-900"
                    />
                  ) : null}
                </div>
              </label>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-lg border-2 border-slate-300 bg-white
                  px-3 py-2 text-xs font-black uppercase tracking-wide
                  text-slate-600 transition hover:border-slate-900
                  hover:text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending || (strategy === "custom" && !customDate)}
                className="flex-1 flex items-center justify-center gap-1.5
                  rounded-lg border-2 border-slate-900 bg-emerald-200 px-3 py-2
                  text-xs font-black uppercase tracking-wide text-slate-600
                  shadow-[2px_2px_0px_0px_#0f172a] transition
                  hover:bg-emerald-300 active:translate-y-0 active:shadow-none
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
