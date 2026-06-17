"use client";

import { useEffect, useState, type ReactNode } from "react";
import { History, SlidersHorizontal } from "lucide-react";

export function ScheduleDesktopActions({
  status,
  hasHistory,
  statusForm,
  history,
  note,
}: {
  status: string;
  hasHistory: boolean;
  statusForm: ReactNode;
  history: ReactNode;
  note?: ReactNode;
}) {
  // Default to showing the status buttons only when pending or when there is
  // no payment history to display; otherwise default to the payment history.
  const [showButtons, setShowButtons] = useState(
    status === "pending" || !hasHistory,
  );

  useEffect(() => {
    if (status === "paid" && hasHistory) {
      setShowButtons(false);
    }
  }, [status, hasHistory]);

  return (
    <div className="relative flex w-full flex-col items-stretch gap-3">
      {hasHistory && (
        <button
          type="button"
          title={showButtons ? "Show payment history" : "Show status buttons"}
          onClick={() => setShowButtons((v) => !v)}
          className="absolute -top-1.5 -right-1 inline-flex size-6 items-center
            justify-center rounded-full border-2 border-slate-900 bg-white
            text-slate-700 shadow-[1px_1px_0px_0px_#0f172a] transition
            hover:bg-slate-50 hover:text-slate-600 cursor-pointer
            dark:border-border dark:bg-card dark:text-muted-foreground
            dark:shadow-none dark:hover:bg-muted dark:hover:text-foreground"
        >
          {showButtons ? (
            <History className="size-3 shrink-0" aria-hidden />
          ) : (
            <SlidersHorizontal className="size-3 shrink-0" aria-hidden />
          )}
        </button>
      )}

      {showButtons ? statusForm : history}

      {note}
    </div>
  );
}
