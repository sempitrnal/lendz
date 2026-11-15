"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function PaidSchedulesSection({
  count,
  totalPaid,
  children,
}: {
  count: number;
  totalPaid: number;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b-2 border-money-200 dark:border-money-400/20">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-money-50 dark:hover:bg-money-400/10"
      >
        <span className="text-[11px] font-black tracking-wide text-money-700 uppercase dark:text-money-400">
          {count} {count === 1 ? "schedule" : "schedules"} paid
        </span>
        <span className="ml-1 text-xs font-semibold text-slate-500 dark:text-muted-foreground">
          · ₱{totalPaid.toLocaleString()} total
        </span>
        <ChevronDown
          className={`ml-auto size-4 shrink-0 text-money-600 transition-transform duration-200 dark:text-money-400 ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
